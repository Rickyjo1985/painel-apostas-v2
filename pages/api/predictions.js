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

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function calculateTeamStats(
  matches,
  teamName,
  venue
) {
  const relevantMatches = matches
    .filter((match) => {
      const isHome = sameTeam(
        match.homeTeam?.name,
        teamName
      );

      const isAway = sameTeam(
        match.awayTeam?.name,
        teamName
      );

      if (!isHome && !isAway) {
        return false;
      }

      if (venue === "HOME" && !isHome) {
        return false;
      }

      if (venue === "AWAY" && !isAway) {
        return false;
      }

      return (
        match.status === "FINISHED"
      );
    })
    .sort(
      (a, b) =>
        new Date(b.utcDate) -
        new Date(a.utcDate)
    )
    .slice(0, 8);

  if (
    relevantMatches.length < 4
  ) {
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

  for (const match of relevantMatches) {
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

    if (gf + ga >= 2) {
      over15++;
    }

    if (gf + ga >= 3) {
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

function calculateOver15Score(
  homeStats,
  awayStats
) {
  const overRate =
    (
      homeStats.over15Rate +
      awayStats.over15Rate
    ) / 2;

  const goalAverage =
    (
      homeStats.totalGoalsAvg +
      awayStats.totalGoalsAvg
    ) / 2;

  const scoringAverage =
    (
      homeStats.goalsForAvg +
      awayStats.goalsForAvg
    ) / 2;

  let score = 55;

  score +=
    (overRate - 0.5) * 45;

  if (
    goalAverage >= 2.6
  ) {
    score += 8;
  } else if (
    goalAverage >= 2.2
  ) {
    score += 6;
  } else if (
    goalAverage >= 1.9
  ) {
    score += 3;
  }

  if (
    scoringAverage >= 1.5
  ) {
    score += 5;
  } else if (
    scoringAverage >= 1.2
  ) {
    score += 3;
  }

  return clamp(
    Math.round(score),
    50,
    88
  );
}

function calculateResultPrediction(
  homeStats,
  awayStats
) {
  const homeStrength =
    homeStats.pointsPerGame +
    homeStats.goalsForAvg * 0.7 -
    homeStats.goalsAgainstAvg *
      0.35;

  const awayStrength =
    awayStats.pointsPerGame +
    awayStats.goalsForAvg * 0.7 -
    awayStats.goalsAgainstAvg *
      0.35;

  const difference =
    homeStrength -
    awayStrength;

  if (
    difference >= 1
  ) {
    return {
      market: "1",
      score: 72
    };
  }

  if (
    difference >= 0.4
  ) {
    return {
      market: "1X",
      score: 68
    };
  }

  if (
    difference <= -1
  ) {
    return {
      market: "2",
      score: 72
    };
  }

  if (
    difference <= -0.4
  ) {
    return {
      market: "X2",
      score: 68
    };
  }

  return {
    market: "1X",
    score: 61
  };
}

function calculateBTTSScore(
  homeStats,
  awayStats
) {
  const bttsRate =
    (
      homeStats.bttsRate +
      awayStats.bttsRate
    ) / 2;

  return clamp(
    Math.round(
      48 +
        bttsRate * 40
    ),
    50,
    88
  );
}

function getLevel(score) {
  if (score >= 82) {
    return "MUITO ALTA";
  }

  if (score >= 75) {
    return "ALTA";
  }

  if (score >= 67) {
    return "MÉDIA";
  }

  return "BAIXA";
}

function calculatePrediction(
  match,
  historicalMatches
) {
  /*
   * Para a equipa da casa usamos apenas
   * os últimos jogos em casa.
   */
  const homeStats =
    calculateTeamStats(
      historicalMatches,
      match.homeTeam?.name,
      "HOME"
    );

  /*
   * Para a equipa visitante usamos apenas
   * os últimos jogos fora.
   */
  const awayStats =
    calculateTeamStats(
      historicalMatches,
      match.awayTeam?.name,
      "AWAY"
    );

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

      reasons: [
        `Histórico casa: ${
          homeStats?.games || 0
        } jogos`,

        `Histórico fora: ${
          awayStats?.games || 0
        } jogos`
      ],

      stats: {
        homeGames:
          homeStats?.games || 0,

        awayGames:
          awayStats?.games || 0
      }
    };
  }

  const over15Score =
    calculateOver15Score(
      homeStats,
      awayStats
    );

  const result =
    calculateResultPrediction(
      homeStats,
      awayStats
    );

  const bttsScore =
    calculateBTTSScore(
      homeStats,
      awayStats
    );

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
        result.market,

      score:
        result.score,

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
      b.score -
      a.score
  );

  const best =
    candidates[0];

  const reasons = [
    best.reason,

    `Média golos casa: ${homeStats.goalsForAvg.toFixed(
      2
    )}`,

    `Média golos fora: ${awayStats.goalsForAvg.toFixed(
      2
    )}`,

    `Over 1.5 casa: ${Math.round(
      homeStats.over15Rate * 100
    )}%`,

    `Over 1.5 fora: ${Math.round(
      awayStats.over15Rate * 100
    )}%`,

    `Amostra: ${homeStats.games} casa / ${awayStats.games} fora`
  ];

  return {
    market:
      best.market,

    score:
      best.score,

    level:
      getLevel(best.score),

    reasons,

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

      homeGoals:
        Number(
          homeStats.goalsForAvg.toFixed(
            2
          )
        ),

      awayGoals:
        Number(
          awayStats.goalsForAvg.toFixed(
            2
          )
        )
    }
  };
}

async function getHistoricalMatches(
  competition
) {
  /*
   * Pedimos a época atual da competição,
   * apenas jogos terminados.
   *
   * Assim conseguimos uma amostra muito
   * maior que os últimos 9 dias.
   */
  const params =
    new URLSearchParams();

  params.set(
    "status",
    "FINISHED"
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
    if (
      response.status ===
      429
    ) {
      throw new Error(
        "A football-data.org atingiu o limite de pedidos."
      );
    }

    throw new Error(
      typeof data ===
        "string"
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

    if (!competitions.length) {
      return res.status(200).json({
        predictions: {},
        meta: {
          predictions: 0,
          updatedAt:
            new Date().toISOString()
        }
      });
    }

    /*
     * Carregar o histórico por competição.
     *
     * Fazemos no máximo uma chamada
     * por competição.
     */
    const historicalByCompetition =
      {};

    for (
      const competition of competitions
    ) {
      try {
        historicalByCompetition[
          competition
        ] =
          await getHistoricalMatches(
            competition
          );
      } catch (error) {
        console.error(
          "Erro histórico",
          competition,
          error.message
        );

        historicalByCompetition[
          competition
        ] = [];
      }
    }

    const predictions = {};

    for (
      const match of matches
    ) {
      const competition =
        match.competition
          ?.code;

      const historicalMatches =
        historicalByCompetition[
          competition
        ] || [];

      predictions[
        String(match.id)
      ] = {
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
          historicalMatches
        )
      };
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=900"
    );

    return res.status(200).json({
      predictions,

      meta: {
        competitions:
          competitions.length,

        historyMatches:
          Object.values(
            historicalByCompetition
          ).reduce(
            (total, list) =>
              total +
              list.length,
            0
          ),

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
