const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

const VALID_COMPETITIONS = [
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "PPL",
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

function sameTeam(nameA, nameB) {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  if (a.includes(b) || b.includes(a)) {
    return true;
  }

  const wordsA = a.split(" ");
  const wordsB = b.split(" ");

  const common = wordsA.filter(
    (word) =>
      word.length >= 3 &&
      wordsB.includes(word)
  );

  return common.length >= 1;
}

function calculateTeamStats(
  matches,
  teamName
) {
  const teamMatches = matches
    .filter((match) => {
      return (
        sameTeam(
          match.homeTeam?.name,
          teamName
        ) ||
        sameTeam(
          match.awayTeam?.name,
          teamName
        )
      );
    })
    .filter(
      (match) =>
        match.status === "FINISHED"
    )
    .sort(
      (a, b) =>
        new Date(b.utcDate) -
        new Date(a.utcDate)
    )
    .slice(0, 5);

  if (!teamMatches.length) {
    return null;
  }

  let games = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;

  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  for (const match of teamMatches) {
    const isHome = sameTeam(
      match.homeTeam?.name,
      teamName
    );

    const homeGoals = Number(
      match.score?.fullTime?.home
    );

    const awayGoals = Number(
      match.score?.fullTime?.away
    );

    if (
      !Number.isFinite(homeGoals) ||
      !Number.isFinite(awayGoals)
    ) {
      continue;
    }

    const gf = isHome
      ? homeGoals
      : awayGoals;

    const ga = isHome
      ? awayGoals
      : homeGoals;

    games++;

    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > ga) {
      wins++;
      points += 3;
    } else if (gf === ga) {
      draws++;
      points += 1;
    } else {
      losses++;
    }

    if (
      gf + ga >= 2
    ) {
      over15++;
    }

    if (
      gf + ga >= 3
    ) {
      over25++;
    }

    if (
      gf > 0 &&
      ga > 0
    ) {
      btts++;
    }
  }

  if (!games) {
    return null;
  }

  return {
    games,
    wins,
    draws,
    losses,
    pointsPerGame:
      points / games,
    goalsForAvg:
      goalsFor / games,
    goalsAgainstAvg:
      goalsAgainst / games,
    totalGoalsAvg:
      (goalsFor +
        goalsAgainst) /
      games,
    over15Rate:
      over15 / games,
    over25Rate:
      over25 / games,
    bttsRate:
      btts / games
  };
}

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function calculatePrediction(
  match,
  homeStats,
  awayStats
) {
  if (
    !homeStats ||
    !awayStats
  ) {
    return {
      market:
        "Dados insuficientes",
      score: 0,
      level:
        "DADOS INSUFICIENTES",
      reasons: [],
      stats: null
    };
  }

  /*
   * ------------------------------------
   * OVER 1.5 GOLOS
   * ------------------------------------
   */

  const over15Rate =
    (
      homeStats.over15Rate +
      awayStats.over15Rate
    ) / 2;

  const averageGoals =
    (
      homeStats.totalGoalsAvg +
      awayStats.totalGoalsAvg
    ) / 2;

  let over15Score =
    over15Rate * 70;

  if (
    averageGoals >= 2.5
  ) {
    over15Score += 18;
  } else if (
    averageGoals >= 2.0
  ) {
    over15Score += 12;
  } else if (
    averageGoals >= 1.7
  ) {
    over15Score += 7;
  }

  if (
    homeStats.goalsForAvg >= 1.2
  ) {
    over15Score += 6;
  }

  if (
    awayStats.goalsForAvg >= 1.0
  ) {
    over15Score += 6;
  }

  over15Score = clamp(
    Math.round(over15Score),
    0,
    100
  );

  /*
   * ------------------------------------
   * RESULTADO
   * ------------------------------------
   */

  const homeStrength =
    homeStats.pointsPerGame +
    homeStats.goalsForAvg * 0.7 -
    homeStats.goalsAgainstAvg * 0.4;

  const awayStrength =
    awayStats.pointsPerGame +
    awayStats.goalsForAvg * 0.7 -
    awayStats.goalsAgainstAvg * 0.4;

  const difference =
    homeStrength -
    awayStrength;

  let resultMarket = "1X";
  let resultScore = 60;

  if (difference >= 0.9) {
    resultMarket = "1";
    resultScore = 72;
  } else if (
    difference >= 0.35
  ) {
    resultMarket = "1X";
    resultScore = 67;
  } else if (
    difference <= -0.9
  ) {
    resultMarket = "2";
    resultScore = 72;
  } else if (
    difference <= -0.35
  ) {
    resultMarket = "X2";
    resultScore = 67;
  }

  if (
    homeStats.games >= 4 &&
    awayStats.games >= 4
  ) {
    resultScore += 5;
  }

  resultScore = clamp(
    Math.round(resultScore),
    0,
    100
  );

  /*
   * ------------------------------------
   * AMBAS MARCAM
   * ------------------------------------
   */

  let bttsScore = Math.round(
    (
      homeStats.bttsRate +
      awayStats.bttsRate
    ) /
      2 *
      100
  );

  bttsScore = clamp(
    bttsScore,
    0,
    100
  );

  /*
   * ------------------------------------
   * ESCOLHER MELHOR PROGNÓSTICO
   * ------------------------------------
   */

  const candidates = [
    {
      market:
        "Mais de 1.5 Golos",
      score:
        over15Score,
      reason:
        "Tendência recente de golos"
    },
    {
      market:
        resultMarket,
      score:
        resultScore,
      reason:
        "Força e forma recente"
    },
    {
      market:
        "Ambas Marcam",
      score:
        bttsScore,
      reason:
        "Frequência recente de ambas as equipas marcarem"
    }
  ];

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  const best =
    candidates[0];

  let level =
    "BAIXA";

  if (
    best.score >= 80
  ) {
    level =
      "MUITO ALTA";
  } else if (
    best.score >= 72
  ) {
    level =
      "ALTA";
  } else if (
    best.score >= 64
  ) {
    level =
      "MÉDIA";
  }

  return {
    market:
      best.market,

    score:
      best.score,

    level,

    reasons: [
      best.reason,

      `Média golos casa: ${homeStats.goalsForAvg.toFixed(2)}`,

      `Média golos fora: ${awayStats.goalsForAvg.toFixed(2)}`,

      `Over 1.5 recente: ${Math.round(
        over15Rate * 100
      )}%`
    ],

    stats: {
      homeGames:
        homeStats.games,

      awayGames:
        awayStats.games,

      homeOver15:
        Math.round(
          homeStats.over15Rate *
            100
        ),

      awayOver15:
        Math.round(
          awayStats.over15Rate *
            100
        ),

      homeGoalsFor:
        Number(
          homeStats.goalsForAvg.toFixed(
            2
          )
        ),

      awayGoalsFor:
        Number(
          awayStats.goalsForAvg.toFixed(
            2
          )
        )
    }
  };
}

function getDateUTC(
  offset
) {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() +
      offset
  );

  return date
    .toISOString()
    .slice(0, 10);
}

async function getHistoricalMatches(
  competitions
) {
  /*
   * Uma única chamada à API.
   *
   * Intervalo de 9 dias:
   * suficientemente pequeno para
   * respeitar o limite da API.
   */

  const dateFrom =
    getDateUTC(-9);

  const dateTo =
    getDateUTC(0);

  const params =
    new URLSearchParams();

  params.set(
    "competitions",
    competitions.join(",")
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
    "status",
    "FINISHED"
  );

  const url =
    "https://api.football-data.org/v4/matches?" +
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
    if (
      response.status ===
      429
    ) {
      throw new Error(
        "A football-data.org atingiu o limite de pedidos. Aguarda alguns segundos e tenta novamente."
      );
    }

    throw new Error(
      typeof data === "string"
        ? data
        : data?.message ||
          "Erro ao obter histórico."
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
    const matches =
      Array.isArray(
        req.body?.matches
      )
        ? req.body.matches
        : [];

    if (!matches.length) {
      return res.status(200).json({
        predictions: {},
        meta: {
          predictions: 0,
          updatedAt:
            new Date().toISOString()
        }
      });
    }

    const competitions = [
      ...new Set(
        matches
          .map(
            (match) =>
              match.competition
                ?.code
          )
          .filter((code) =>
            VALID_COMPETITIONS.includes(
              code
            )
          )
      )
    ];

    if (
      !competitions.length
    ) {
      return res.status(200).json({
        predictions: {},
        meta: {
          predictions: 0,
          reason:
            "Nenhuma competição suportada.",
          updatedAt:
            new Date().toISOString()
        }
      });
    }

    /*
     * UMA chamada à football-data.org
     */
    const historicalMatches =
      await getHistoricalMatches(
        competitions
      );

    const predictions = {};

    for (const match of matches) {
      const history =
        historicalMatches.filter(
          (historical) =>
            historical
              .competition
              ?.code ===
            match.competition
              ?.code
        );

      const homeStats =
        calculateTeamStats(
          history,
          match.homeTeam?.name
        );

      const awayStats =
        calculateTeamStats(
          history,
          match.awayTeam?.name
        );

      predictions[
        String(match.id)
      ] =
        {
          matchId:
            match.id,

          homeTeam:
            match.homeTeam
              ?.name,

          awayTeam:
            match.awayTeam
              ?.name,

          competition:
            match.competition
              ?.name,

          utcDate:
            match.utcDate,

          ...calculatePrediction(
            match,
            homeStats,
            awayStats
          )
        };
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      predictions,

      meta: {
        historyMatches:
          historicalMatches.length,

        competitions:
          competitions.length,

        predictions:
          Object.keys(
            predictions
          ).length,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/predictions:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao calcular prognósticos."
    });
  }
}
