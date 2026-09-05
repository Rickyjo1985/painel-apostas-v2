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

function getDateUTC(offset) {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + offset
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\b(fc|cf|sc|ac|afc|cd|se|club|football|clube)\b/g,
      " "
    )
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function teamsMatch(
  teamA,
  teamB
) {
  const a = normalizeName(teamA);
  const b = normalizeName(teamB);

  if (!a || !b) {
    return false;
  }

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
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

function getTrendTeam(
  trend,
  side
) {
  if (!trend) {
    return null;
  }

  return trend.trend?.[side] || null;
}

function getGamesFromTrend(
  trendTeam
) {
  if (!trendTeam) {
    return 0;
  }

  if (
    Array.isArray(
      trendTeam.match_ids
    )
  ) {
    return trendTeam.match_ids.length;
  }

  return 0;
}

function calculateOver15Score(
  home,
  away
) {
  const homeOver =
    Number(
      home?.pct_o_15
    );

  const awayOver =
    Number(
      away?.pct_o_15
    );

  const homeGoals =
    Number(
      home?.avg_goals
    );

  const awayGoals =
    Number(
      away?.avg_goals
    );

  const homeScored =
    Number(
      home?.avg_goals_scored
    );

  const awayScored =
    Number(
      away?.avg_goals_scored
    );

  if (
    !Number.isFinite(
      homeOver
    ) ||
    !Number.isFinite(
      awayOver
    )
  ) {
    return 0;
  }

  const overRate =
    (homeOver +
      awayOver) /
    2;

  const goalAverage =
    Number.isFinite(
      homeGoals
    ) &&
    Number.isFinite(
      awayGoals
    )
      ? (homeGoals +
          awayGoals) /
        2
      : 0;

  const scoringAverage =
    Number.isFinite(
      homeScored
    ) &&
    Number.isFinite(
      awayScored
    )
      ? (homeScored +
          awayScored) /
        2
      : 0;

  /*
   * Base 55
   *
   * A tendência estatística representa
   * a maior parte do score.
   */
  let score = 55;

  score +=
    (overRate - 0.5) *
    45;

  if (
    goalAverage >= 3
  ) {
    score += 8;
  } else if (
    goalAverage >= 2.5
  ) {
    score += 6;
  } else if (
    goalAverage >= 2.0
  ) {
    score += 4;
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
  home,
  away
) {
  const homePoints =
    Number(
      home?.avg_points
    );

  const awayPoints =
    Number(
      away?.avg_points
    );

  const homeScored =
    Number(
      home?.avg_goals_scored
    );

  const awayScored =
    Number(
      away?.avg_goals_scored
    );

  const homeConceded =
    Number(
      home?.avg_goals_conceded
    );

  const awayConceded =
    Number(
      away?.avg_goals_conceded
    );

  if (
    !Number.isFinite(
      homePoints
    ) ||
    !Number.isFinite(
      awayPoints
    )
  ) {
    return {
      market: "1X",
      score: 0
    };
  }

  const homeStrength =
    homePoints +
    (Number.isFinite(
      homeScored
    )
      ? homeScored * 0.7
      : 0) -
    (Number.isFinite(
      homeConceded
    )
      ? homeConceded * 0.35
      : 0);

  const awayStrength =
    awayPoints +
    (Number.isFinite(
      awayScored
    )
      ? awayScored * 0.7
      : 0) -
    (Number.isFinite(
      awayConceded
    )
      ? awayConceded * 0.35
      : 0);

  const difference =
    homeStrength -
    awayStrength;

  let market = "1X";
  let score = 60;

  if (
    difference >= 1.0
  ) {
    market = "1";
    score = 72;
  } else if (
    difference >= 0.45
  ) {
    market = "1X";
    score = 68;
  } else if (
    difference <= -1.0
  ) {
    market = "2";
    score = 72;
  } else if (
    difference <= -0.45
  ) {
    market = "X2";
    score = 68;
  } else {
    market = "1X";
    score = 61;
  }

  return {
    market,
    score: clamp(
      Math.round(score),
      50,
      80
    )
  };
}

function calculateBTTSScore(
  home,
  away
) {
  const homeBTTS =
    Number(
      home?.pct_bts
    );

  const awayBTTS =
    Number(
      away?.pct_bts
    );

  if (
    !Number.isFinite(
      homeBTTS
    ) ||
    !Number.isFinite(
      awayBTTS
    )
  ) {
    return 0;
  }

  const rate =
    (homeBTTS +
      awayBTTS) /
    2;

  return clamp(
    Math.round(
      48 + rate * 40
    ),
    50,
    88
  );
}

function getConfidenceLevel(
  score
) {
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
  trend
) {
  if (!trend) {
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

  const home =
    getTrendTeam(
      trend,
      "home"
    );

  const away =
    getTrendTeam(
      trend,
      "away"
    );

  if (
    !home ||
    !away
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

  const homeGames =
    getGamesFromTrend(
      home
    );

  const awayGames =
    getGamesFromTrend(
      away
    );

  /*
   * Não queremos previsões fortes
   * com amostras demasiado pequenas.
   */
  if (
    homeGames < 5 ||
    awayGames < 5
  ) {
    return {
      market:
        "Dados insuficientes",
      score: 0,
      level:
        "DADOS INSUFICIENTES",
      reasons: [
        `Histórico casa: ${homeGames} jogos`,
        `Histórico fora: ${awayGames} jogos`
      ],
      stats: {
        homeGames,
        awayGames
      }
    };
  }

  const over15Score =
    calculateOver15Score(
      home,
      away
    );

  const result =
    calculateResultPrediction(
      home,
      away
    );

  const bttsScore =
    calculateBTTSScore(
      home,
      away
    );

  const candidates = [
    {
      market:
        "Mais de 1.5 Golos",
      score:
        over15Score,
      reason:
        "Tendência de 2 ou mais golos"
    },
    {
      market:
        result.market,
      score:
        result.score,
      reason:
        "Forma e força recente"
    },
    {
      market:
        "Ambas Marcam",
      score:
        bttsScore,
      reason:
        "Frequência de ambas marcarem"
    }
  ];

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  const best =
    candidates[0];

  const homeOver15 =
    Number(
      home.pct_o_15
    );

  const awayOver15 =
    Number(
      away.pct_o_15
    );

  const homeGoals =
    Number(
      home.avg_goals
    );

  const awayGoals =
    Number(
      away.avg_goals
    );

  const reasons = [
    best.reason
  ];

  if (
    Number.isFinite(
      homeOver15
    ) &&
    Number.isFinite(
      awayOver15
    )
  ) {
    reasons.push(
      `Over 1.5: casa ${Math.round(
        homeOver15 * 100
      )}% / fora ${Math.round(
        awayOver15 * 100
      )}%`
    );
  }

  if (
    Number.isFinite(
      homeGoals
    ) &&
    Number.isFinite(
      awayGoals
    )
  ) {
    reasons.push(
      `Média de golos: casa ${homeGoals.toFixed(
        2
      )} / fora ${awayGoals.toFixed(
        2
      )}`
    );
  }

  reasons.push(
    `Amostra: ${homeGames} jogos casa / ${awayGames} jogos fora`
  );

  return {
    market:
      best.market,

    score:
      best.score,

    level:
      getConfidenceLevel(
        best.score
      ),

    reasons,

    stats: {
      homeGames,
      awayGames,

      homeOver15:
        Number.isFinite(
          homeOver15
        )
          ? Math.round(
              homeOver15 *
                100
            )
          : null,

      awayOver15:
        Number.isFinite(
          awayOver15
        )
          ? Math.round(
              awayOver15 *
                100
            )
          : null,

      homeGoals:
        Number.isFinite(
          homeGoals
        )
          ? Number(
              homeGoals.toFixed(
                2
              )
            )
          : null,

      awayGoals:
        Number.isFinite(
          awayGoals
        )
          ? Number(
              awayGoals.toFixed(
                2
              )
            )
          : null
    }
  };
}

async function getTrends(competitions) {
  const dateFrom =
    getDateUTC(0);

  const dateTo =
    getDateUTC(7);

  const params =
    new URLSearchParams();

  params.set(
    "dateFrom",
    dateFrom
  );

  params.set(
    "dateTo",
    dateTo
  );

  params.set(
    "competitions",
    competitions.join(",")
  );

  params.set(
    "window",
    "8"
  );

  const url =
    "https://api.football-data.org/v4/trends?" +
    params.toString() +
    "&consider_side";

  console.log(
    "Trends URL:",
    url
  );

  const response =
    await fetch(url, {
      method: "GET",
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
    console.error(
      "Trends API:",
      response.status,
      data
    );

    let message =
      "Erro ao obter tendências.";

    if (
      typeof data ===
      "string"
    ) {
      message = data;
    } else if (
      data?.message
    ) {
      message =
        data.message;
    } else if (
      data?.error
    ) {
      message =
        data.error;
    }

    throw new Error(
      "HTTP " +
        response.status +
        ": " +
        message
    );
  }

  return Array.isArray(
    data?.trends
  )
    ? data.trends
    : [];
}

function findTrendForMatch(
  match,
  trends
) {
  /*
   * Preferimos IDs das equipas.
   */
  const homeId =
    match.homeTeam?.id;

  const awayId =
    match.awayTeam?.id;

  const byId =
    trends.find(
      (item) =>
        item.homeTeam?.id ===
          homeId &&
        item.awayTeam?.id ===
          awayId
    );

  if (byId) {
    return byId;
  }

  /*
   * Fallback pelos nomes.
   */
  return (
    trends.find(
      (item) =>
        teamsMatch(
          item.homeTeam?.name,
          match.homeTeam?.name
        ) &&
        teamsMatch(
          item.awayTeam?.name,
          match.awayTeam?.name
        )
    ) || null
  );
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
     * Apenas UMA chamada à API
     * para obter as tendências.
     */
    const trends =
      await getTrends(
        competitions
      );

    const predictions = {};

    for (const match of matches) {
      const trend =
        findTrendForMatch(
          match,
          trends
        );

      predictions[
        String(match.id)
      ] = {
        matchId:
          match.id,

        homeTeam:
          match.homeTeam?.name,

        awayTeam:
          match.awayTeam?.name,

        competition:
          match.competition?.name,

        utcDate:
          match.utcDate,

        ...calculatePrediction(
          match,
          trend
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
        trendsFound:
          trends.length,

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
