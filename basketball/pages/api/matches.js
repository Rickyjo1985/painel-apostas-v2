const API_KEY = process.env.BALLDONTLIE_API_KEY;
const CACHE_TTL = 8 * 60 * 1000;
const MAX_PAGES = 4;

let cachedPayload = null;
let cachedAt = 0;

function lisbonDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return values.year + "-" + values.month + "-" + values.day;
}

function shiftDate(dateString, amount) {
  const date = new Date(dateString + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function currentSeason(dateString) {
  const parts = dateString.split("-").map(Number);
  return parts[1] >= 10 ? parts[0] : parts[0] - 1;
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const first = new Date(a.datetime || a.date || 0).getTime();
    const second = new Date(b.datetime || b.date || 0).getTime();
    return first - second;
  });
}

async function fetchGames() {
  const today = lisbonDate(new Date());
  const startDate = shiftDate(today, -35);
  const endDate = shiftDate(today, 7);
  const season = currentSeason(today);

  let cursor = null;
  const all = [];
  const seen = new Set();
  let requests = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams();
    params.set("start_date", startDate);
    params.set("end_date", endDate);
    params.set("seasons[]", String(season));
    params.set("per_page", "100");
    if (cursor !== null && cursor !== undefined) {
      params.set("cursor", String(cursor));
    }

    const response = await fetch(
      "https://api.balldontlie.io/v1/games?" + params.toString(),
      {
        method: "GET",
        headers: {
          Authorization: API_KEY,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    requests += 1;

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        response.status === 429
          ? "A API da NBA atingiu o limite de pedidos. O painel tentará novamente mais tarde."
          : "A API da NBA respondeu com erro HTTP " + response.status + "."
      );
      error.status = response.status;
      error.details = body.slice(0, 500);
      throw error;
    }

    const json = await response.json();
    const games = Array.isArray(json.data) ? json.data : [];

    for (const game of games) {
      if (game && game.id !== undefined && !seen.has(String(game.id))) {
        seen.add(String(game.id));
        all.push(game);
      }
    }

    const nextCursor = json.meta && json.meta.next_cursor;
    if (!nextCursor || games.length === 0 || nextCursor === cursor) {
      truncated = false;
      break;
    }

    cursor = nextCursor;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const matches = sortMatches(all);
  return {
    matches: matches,
    meta: {
      source: "BALLDONTLIE NBA API",
      dateFrom: startDate,
      dateTo: endDate,
      season: season,
      requests: requests,
      truncated: truncated,
      updatedAt: new Date().toISOString()
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  res.setHeader("Cache-Control", "s-maxage=480, stale-while-revalidate=300");

  if (!API_KEY) {
    return res.status(500).json({
      error: "Falta configurar BALLDONTLIE_API_KEY nas variáveis de ambiente da Vercel."
    });
  }

  if (cachedPayload && Date.now() - cachedAt < CACHE_TTL) {
    return res.status(200).json({
      ...cachedPayload,
      meta: { ...cachedPayload.meta, cached: true }
    });
  }

  try {
    const payload = await fetchGames();
    cachedPayload = payload;
    cachedAt = Date.now();
    return res.status(200).json({
      ...payload,
      meta: { ...payload.meta, cached: false }
    });
  } catch (error) {
    console.error("Erro em /api/matches NBA:", error.message, error.details || "");
    if (cachedPayload) {
      return res.status(200).json({
        ...cachedPayload,
        meta: { ...cachedPayload.meta, cached: true, stale: true }
      });
    }
    return res.status(error.status || 502).json({
      error: error.message || "Não foi possível obter os jogos da NBA.",
      apiStatus: error.status || null
    });
  }
}