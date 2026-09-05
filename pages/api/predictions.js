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

function sameTeam(
  nameA,
  nameB
) {
  const a =
    normalizeName(nameA);

  const b =
    normalizeName(nameB);

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

/*
 * Obtém os jogos terminados da equipa.
 * Primeiro tenta os jogos no contexto pedido:
 * HOME ou AWAY.
 */
function getTeamMatches(
  matches,
  teamName,
  venue
) {
  const all = matches
    .filter(
      (match) =>
        match.status ===
        "FINISHED"
    )
    .filter((match) => {
      const isHome =
        sameTeam(
          match.homeTeam?.name,
          teamName
        );

      const isAway =
        sameTeam(
          match.awayTeam?.name,
          teamName
        );

      if (!isHome && !isAway) {
        return false;
      }

      if (
        venue === "HOME" &&
        !isHome
      ) {
        return false;
      }

      if (
        venue === "AWAY" &&
        !isAway
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.utcDate) -
        new Date(a.utcDate)
    );

  return all;
}

/*
 * Calcula estatísticas de uma equipa.
 */
function calculateTeamStats(
  matches,
  teamName
) {
  if (!matches.length) {
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

  for (const match of matches) {
    const isHome =
      sameTeam(
        match.homeTeam?.name,
        teamName
      );

    const homeGoals =
      Number(
        match.score?.fullTime?.home
      );

    const awayGoals =
      Number(
        match.score?.fullTime?.away
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

  if (games === 0) {
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

/*
 * Tenta primeiro HOME/AWAY.
 * Se não houver pelo menos 3 jogos,
 * completa com jogos gerais recentes.
 */
function buildTeamStats(
  matches,
  teamName,
  venue
) {
  const venueMatches =
    getTeamMatches(
      matches,
      teamName,
      venue
    );

  const generalMatches =
    getTeamMatches(
      matches,
      teamName,
      "ALL"
    );

  const selected = [
    ...venueMatches.slice(
      0,
      8
    )
  ];

  /*
   * Completar com jogos gerais
   * que ainda não estejam presentes.
   */
  if (selected.length < 8) {
    for (const match of generalMatches) {
      if (
        selected.some(
          (item) =>
            item.id ===
            match.id
        )
      ) {
        continue;
      }

      selected.push(match);

      if (
        selected.length >= 8
      ) {
        break;
      }
    }
  }

  return calculateTeamStats(
    selected,
    teamName
  );
}

function calculateOver15Score(
  home,
  away
) {
  const overRate =
    (
      home.over15Rate +
      away.over15Rate
    ) / 2;

  const goalAverage =
    (
      home.totalGoalsAvg +
      away.totalGoalsAvg
    ) / 2;

  const scoringAverage =
    (
      home.goalsForAvg +
      away.goalsForAvg
    ) / 2;

  let score = 55;

  /*
   * Tendência Over 1.5.
   */
  score +=
    (overRate - 0.5) *
    42;

  /*
   * Média de golos.
   */
  if (
    goalAverage >= 2.7
  ) {
    score += 8;
  } else if (
    goalAverage >= 2.3
  ) {
    score += 6;
  } else if (
    goalAverage >= 2.0
  ) {
    score += 4;
  } else if (
    goalAverage >= 1.7
  ) {
    score += 2;
  }

  /*
   * Capacidade ofensiva.
   */
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
  const homeStrength =
    home.pointsPerGame +
    home.goalsForAvg *
      0.7 -
    home.goalsAgainstAvg *
      0.35;

  const awayStrength =
    away.pointsPerGame +
    away.goalsForAvg *
      0.7 -
    away.goalsAgainstAvg *
      0.35;

  const difference =
    homeStrength -
    awayStrength;

  if (
    difference >= 1.0
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
    difference <= -1.0
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
  home,
  away
) {
  const rate =
    (
      home.bttsRate +
      away.bttsRate
    ) / 2;

  return clamp(
    Math.round(
      48 + rate * 40
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
  history
) {
  const homeStats =
    buildTeamStats(
      history,
      match.homeTeam?.name,
      "HOME"
    );

  const awayStats =
    buildTeamStats(
      history,
      match.awayTeam?.name,
      "AWAY"
    );

  /*
   * Agora apenas precisamos de 3 jogos.
   */
  if (
    !homeStats ||
    !awayStats ||
    homeStats.games < 3 ||
    awayStats.games < 3
  ) {
    return {
      market:
        "Dados insuficientes",

      score: 0,

      level:
        "DADOS INSUFICIENTES",

      reasons: [
        `Histórico casa: ${
          homeStats?.games ||
          0
        } jogos`,

        `Histórico fora: ${
          awayStats?.games ||
          0
        } jogos`
      ],

      stats: {
        homeGames:
          homeStats?.games ||
          0,

        awayGames:
          awayStats?.games ||
          0
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
        "Tendência recente de 2 ou mais golos"
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
        "Frequência recente de ambas marcarem"
    }
  ];

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  let best =
    candidates[0];

  /*
   * Penalização por amostra pequena.
   */
  const sampleSize =
    Math.min(
      homeStats.games,
      awayStats.games
    );

  let penalty = 0;

  if (
    sampleSize === 3
  ) {
    penalty = 8;
  } else if (
    sampleSize === 4
  ) {
    penalty = 5;
  } else if (
    sampleSize === 5
  ) {
    penalty = 3;
  }

  const finalScore =
    clamp(
      best.score - penalty,
      50,
      88
    );

  /*
   * Se a penalização alterar o resultado,
   * mantemos o mercado, mas baixamos a confiança.
   */
  best = {
    ...best,
    score:
      finalScore
  };

  const reasons = [
    best.reason,

    `Média golos casa: ${homeStats.goalsForAvg.toFixed(
      2
    )}`,

    `Média golos fora: ${awayStats.goalsForAvg.toFixed(
      2
    )}`,

    `Over 1.5 casa: ${Math.round(
      homeStats.over15Rate *
        100
    )}%`,

    `Over 1.5 fora: ${Math.round(
      awayStats.over15Rate *
        100
    )}%`,

    `Amostra: ${homeStats.games} casa / ${awayStats.games} fora`
  ];

  if (penalty > 0) {
    reasons.push(
      `Score ajustado devido à amostra reduzida (-${penalty})`
    );
  }

  return {
    market:
      best.market,

    score:
      best.score,

    level:
      getLevel(
        best.score
      ),

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
    await fetch(
      url,
      {
        headers: {
          "X-Auth-Token":
            FOOTBALL_API_KEY,

          Accept:
            "application/json"
        }
      }
    );

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
     * Histórico por competição.
     *
     * Fazemos uma chamada por competição,
     * de forma sequencial, para respeitar
     * o limite de pedidos.
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

      const history =
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
          history
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
