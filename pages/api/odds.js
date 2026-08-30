
const ODDS_API_KEY =
  process.env.ODDS_API_KEY;

const SPORT_KEYS = {
  PL: "soccer_epl",
  PD: "soccer_spain_la_liga",
  BL1: "soccer_germany_bundesliga",
  SA: "soccer_italy_serie_a",
  FL1: "soccer_france_ligue_one",
  PPL: "soccer_portugal_primeira_liga",
  CL: "soccer_uefa_champs_league",
  EL: "soccer_uefa_europa_league",
  ECL: "soccer_uefa_europa_conference_league"
};

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /\b(fc|cf|sc|ac|afc|cd|club|football|clube)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchKey(
  homeTeam,
  awayTeam
) {
  return (
    normalizeName(homeTeam) +
    "__" +
    normalizeName(awayTeam)
  );
}

function findOver15(event) {
  const results = [];

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "totals") {
        continue;
      }

      for (const outcome of market.outcomes || []) {
        if (
          String(outcome.name).toLowerCase() ===
            "over" &&
          Number(outcome.point) === 1.5
        ) {
          const price =
            Number(outcome.price);

          if (Number.isFinite(price)) {
            results.push({
              bookmaker:
                bookmaker.title,
              bookmakerKey:
                bookmaker.key,
              price: price
            });
          }
        }
      }
    }
  }

  if (results.length === 0) {
    return null;
  }

  results.sort(function (a, b) {
    return b.price - a.price;
  });

  const best = results[0];

  return {
    bookmaker: best.bookmaker,
    bookmakerKey:
      best.bookmakerKey,
    price: best.price,
    alternatives: results.slice(0, 5)
  };
}

async function getOdds(sportKey) {
  const url =
    "https://api.the-odds-api.com/v4/sports/" +
    sportKey +
    "/odds" +
    "?regions=eu" +
    "&markets=totals" +
    "&oddsFormat=decimal" +
    "&dateFormat=iso" +
    "&apiKey=" +
    encodeURIComponent(
      ODDS_API_KEY
    );

  const response =
    await fetch(url);

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
      "The Odds API respondeu " +
        response.status +
        ": " +
        (typeof data ===
        "string"
          ? data
          : JSON.stringify(data))
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export default async function handler(
  req,
  res
) {
  if (!ODDS_API_KEY) {
    return res.status(500).json({
      error:
        "ODDS_API_KEY não está configurada na Vercel."
    });
  }

  try {
    let competitions = [];

    if (req.query.competitions) {
      competitions = String(
        req.query.competitions
      )
        .split(",")
        .map(function (item) {
          return item
            .trim()
            .toUpperCase();
        })
        .filter(Boolean);
    }

    if (
      competitions.length === 0
    ) {
      competitions = [
        "PPL",
        "PL",
        "PD",
        "BL1",
        "SA",
        "FL1",
        "CL",
        "EL",
        "ECL"
      ];
    }

    const sportKeys =
      competitions
        .map(function (code) {
          return SPORT_KEYS[code];
        })
        .filter(Boolean);

    const uniqueSportKeys = [
      ...new Set(sportKeys)
    ];

    const allEvents = [];

    for (const sportKey of uniqueSportKeys) {
      try {
        const events =
          await getOdds(
            sportKey
          );

        for (const event of events) {
          allEvents.push({
            ...event,
            sportKey:
              sportKey
          });
        }
      } catch (error) {
        console.error(
          "Erro ao obter odds:",
          sportKey,
          error.message
        );
      }
    }

    const odds = {};

    for (const event of allEvents) {
      const over15 =
        findOver15(event);

      if (!over15) {
        continue;
      }

      const key =
        getMatchKey(
          event.home_team,
          event.away_team
        );

      odds[key] = {
        eventId: event.id,

        sportKey:
          event.sportKey,

        homeTeam:
          event.home_team,

        awayTeam:
          event.away_team,

        commenceTime:
          event.commence_time,

        over15:
          over15
      };
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=300"
    );

    return res.status(200).json({
      odds: odds,

      meta: {
        eventsFound:
          allEvents.length,

        matchesWithOver15:
          Object.keys(odds).length,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/odds:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao carregar odds."
    });
  }
}
