const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

const VALID_COMPETITIONS = [
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "PPL",
  "ELC",
  "CL",
  "EL",
  "ECL"
];

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /\b(fc|cf|sc|ac|afc|cd|se|club|football|clube)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTeam(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);

  if (!x || !y) {
    return false;
  }

  return (
    x === y ||
    x.includes(y) ||
    y.includes(x)
  );
}

function predictionHit(
  market,
  homeGoals,
  awayGoals
) {
  const total =
    homeGoals + awayGoals;

  switch (market) {
    case "1":
      return homeGoals > awayGoals;

    case "2":
      return awayGoals > homeGoals;

    case "1X":
      return homeGoals >= awayGoals;

    case "X2":
      return awayGoals >= homeGoals;

    case "Mais de 1.5 Golos":
      return total >= 2;

    case "Ambas Marcam":
      return (
        homeGoals >= 1 &&
        awayGoals >= 1
      );

    default:
      return null;
  }
}

async function getFinishedMatches(
  competition,
  dateFrom,
  dateTo
) {
  const params =
    new URLSearchParams();

  params.set(
    "status",
    "FINISHED"
  );

  params.set(
    "dateFrom",
    dateFrom
  );

  params.set(
    "dateTo",
    dateTo
  );

  params.set(
    "limit",
    "100"
  );

  const url =
    "https://api.football-data.org/v4/competitions/" +
    competition +
    "/matches?" +
    params.toString();

  const response =
    await fetch(url, {
      headers: {
        "X-Auth-Token":
          FOOTBALL_API_KEY,
        Accept:
          "application/json"
      }
    });

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  let data;

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    data =
      await response.json();
  } else {
    data =
      await response.text();
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : data?.message ||
          `Erro HTTP ${response.status}`
    );
  }

  return Array.isArray(
    data?.matches
  )
    ? data.matches
    : [];
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error:
        "Método não permitido."
    });
  }

  if (!FOOTBALL_API_KEY) {
    return res.status(500).json({
      error:
        "FOOTBALL_DATA_API_KEY não está configurada."
    });
  }

  try {
    const items =
      Array.isArray(
        req.body?.items
      )
        ? req.body.items
        : [];

    if (!items.length) {
      return res.status(200).json({
        results: []
      });
    }

    const competitions = [
      ...new Set(
        items
          .map(
            (item) =>
              item.competition
          )
          .filter((code) =>
            VALID_COMPETITIONS.includes(
              code
            )
          )
      )
    ];

    if (!competitions.length) {
      return res.status(200).json({
        results: []
      });
    }

    /*
     * Procuramos apenas os últimos 10 dias.
     * Isso é suficiente para os prognósticos
     * pendentes recentes.
     */
    const today =
      new Date();

    const from =
      new Date(today);

    from.setUTCDate(
      from.getUTCDate() - 9
    );

    const dateFrom =
      from
        .toISOString()
        .slice(0, 10);

    const dateTo =
      today
        .toISOString()
        .slice(0, 10);

    const matchesByCompetition =
      {};

    /*
     * Uma chamada por competição,
     * executada sequencialmente.
     */
    for (
      const competition of competitions
    ) {
      try {
        matchesByCompetition[
          competition
        ] =
          await getFinishedMatches(
            competition,
            dateFrom,
            dateTo
          );
      } catch (error) {
        console.error(
          "Erro resultados:",
          competition,
          error.message
        );

        matchesByCompetition[
          competition
        ] = [];
      }
    }

    const results = [];

    for (
      const item of items
    ) {
      const history =
        matchesByCompetition[
          item.competition
        ] || [];

      const found =
        history.find(
          (match) =>
            (
              sameTeam(
                match.homeTeam?.name,
                item.homeTeam
              ) &&
              sameTeam(
                match.awayTeam?.name,
                item.awayTeam
              )
            )
        );

      if (!found) {
        continue;
      }

      const homeGoals =
        Number(
          found.score
            ?.fullTime
            ?.home
        );

      const awayGoals =
        Number(
          found.score
            ?.fullTime
            ?.away
        );

      if (
        !Number.isFinite(
          homeGoals
        ) ||
        !Number.isFinite(
          awayGoals
        )
      ) {
        continue;
      }

      const hit =
        predictionHit(
          item.market,
          homeGoals,
          awayGoals
        );

      results.push({
        matchId:
          item.matchId,

        homeTeam:
          found.homeTeam?.name,

        awayTeam:
          found.awayTeam?.name,

        competition:
          item.competition,

        utcDate:
          found.utcDate,

        homeGoals,
        awayGoals,

        market:
          item.market,

        score:
          Number(item.score || 0),

        hit
      });
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=900"
    );

    return res.status(200).json({
      results,
      meta: {
        checked:
          items.length,

        found:
          results.length,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/results:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro ao verificar resultados."
    });
  }
}
