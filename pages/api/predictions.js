javascript
const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

const COMPETITIONS = {
  PL: "PL",
  PD: "PD",
  BL1: "BL1",
  SA: "SA",
  FL1: "FL1",
  PPL: "PPL",
  CL: "CL",
  EL: "EL",
  ECL: "ECL"
};

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

  return false;
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
        match.status ===
        "FINISHED"
    )
    .sort((a, b) => {
      return (
        new Date(b.utcDate) -
        new Date(a.utcDate)
      );
    })
    .slice(0, 5);

  if (teamMatches.length === 0) {
    return null;
  }

  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  const homeMatches = [];
  const awayMatches = [];

  for (const match of teamMatches) {
    const home = sameTeam(
      match.homeTeam?.name,
      teamName
    );

    const isHome = home;

    const gf = isHome
      ? Number(
          match.score?.fullTime?.home
        )
      : Number(
          match.score?.fullTime?.away
        );

    const ga = isHome
      ? Number(
          match.score?.fullTime?.away
        )
      : Number(
          match.score?.fullTime?.home
        );

    if (
      !Number.isFinite(gf) ||
      !Number.isFinite(ga)
    ) {
      continue;
    }

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

    if (gf > 0 && ga > 0) {
      btts++;
    }

    if (isHome) {
      homeMatches.push({
        gf,
        ga
      });
    } else {
      awayMatches.push({
        gf,
        ga
      });
    }
  }

  const validGames =
    wins + draws + losses;

  if (validGames === 0) {
    return null;
  }

  function average(items, field) {
    if (!items.length) {
      return 0;
    }

    return (
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item[field] || 0
          ),
        0
      ) / items.length
    );
  }

  return {
    games: validGames,
    wins,
    draws,
    losses,
    pointsPerGame:
      points / validGames,
    goalsForAvg:
      goalsFor / validGames,
    goalsAgainstAvg:
      goalsAgainst / validGames,
    totalGoalsAvg:
      (goalsFor +
        goalsAgainst) /
      validGames,
    over15Rate:
      over15 / validGames,
    over25Rate:
      over25 / validGames,
    bttsRate:
      btts / validGames,
    homeGoalsForAvg:
      average(
        homeMatches,
        "gf"
      ),
    homeGoalsAgainstAvg:
      average(
        homeMatches,
        "ga"
      ),
    awayGoalsForAvg:
      average(
        awayMatches,
        "gf"
      ),
    awayGoalsAgainstAvg:
      average(
        awayMatches,
        "ga"
      )
  };
}

function clamp(value, min, max) {
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
      reasons: []
    };
  }

  /*
   * Tendência de Mais de 1.5
   */
  const over15Base =
    (
      homeStats.over15Rate +
      awayStats.over15Rate
    ) / 2;

  const goalsBase =
    (
      homeStats.totalGoalsAvg +
      awayStats.totalGoalsAvg
    ) / 2;

  let over15Score =
    over15Base * 70;

  if (goalsBase >= 2.0) {
    over15Score += 12;
  } else if (goalsBase >= 1.6) {
    over15Score += 7;
  }

  if (
    homeStats.goalsForAvg >= 1.2
  ) {
    over15Score += 5;
  }

  if (
    awayStats.goalsForAvg >= 1.0
  ) {
    over15Score += 5;
  }

  over15Score = clamp(
    Math.round(over15Score),
    0,
    100
  );

  /*
   * Tendência 1X / X2 / 1 / 2
   */
  const homeStrength =
    homeStats.pointsPerGame +
    homeStats.goalsForAvg * 0.7 -
    homeStats.goalsAgainstAvg * 0.4;

  const awayStrength =
    awayStats.pointsPerGame +
    awayStats.goalsForAvg * 0.7 -
    awayStats.goalsAgainstAvg * 0.4;

  const strengthDifference =
    homeStrength -
    awayStrength;

  let resultMarket = "1X";
  let resultScore = 58;

  if (strengthDifference >= 0.8) {
    resultMarket = "1";
    resultScore = 68;
  } else if (
    strengthDifference >= 0.3
  ) {
    resultMarket = "1X";
    resultScore = 64;
  } else if (
    strengthDifference <= -0.8
  ) {
    resultMarket = "2";
    resultScore = 68;
  } else if (
    strengthDifference <= -0.3
  ) {
    resultMarket = "X2";
    resultScore = 64;
  }

  if (
    homeStats.games >= 3 &&
    awayStats.games >= 3
  ) {
    resultScore += 5;
  }

  resultScore = clamp(
    Math.round(resultScore),
    0,
    100
  );

  /*
   * BTTS
   */
  const bttsBase =
    (
      homeStats.bttsRate +
      awayStats.bttsRate
    ) / 2;

  let bttsScore = Math.round(
    bttsBase * 100
  );

  bttsScore = clamp(
    bttsScore,
    0,
    100
  );

  /*
   * Escolher o melhor prognóstico.
   *
   * Damos uma ligeira preferência ao
   * Over 1.5 porque é uma linha mais
   * abrangente e costuma exigir menos
   * condições para ser válida.
   */
  const candidates = [
    {
      market:
        "Mais de 1.5 Golos",
      score: over15Score,
      reason:
        "Tendência recente de golos"
    },
    {
      market:
        resultMarket,
      score: resultScore,
      reason:
        "Força e forma recente"
    },
    {
      market:
        "Ambas Marcam",
      score: bttsScore,
      reason:
        "Frequência recente de golos das duas equipas"
    }
  ];

  candidates.sort(
    (a, b) => {
      return b.score - a.score;
    }
  );

  const best =
    candidates[0];

  let level =
    "BAIXA";

  if (best.score >= 80) {
    level = "MUITO ALTA";
  } else if (
    best.score >= 72
  ) {
    level = "ALTA";
  } else if (
    best.score >= 64
  ) {
    level = "MÉDIA";
  }

  return {
    market: best.market,
    score: best.score,
    level,
    reasons: [
      best.reason,
      `Forma casa: ${Math.round(
        homeStats.pointsPerGame * 100
      ) / 100} pontos/jogo`,
      `Forma visitante: ${Math.round(
        awayStats.pointsPerGame * 100
      ) / 100} pontos/jogo`,
      `Over 1.5 recente: ${Math.round(
        over15Base * 100
      )}%`
    ],
    stats: {
      homeGames:
        homeStats.games,
      awayGames:
        awayStats.games,
      homeOver15:
        Math.round(
          homeStats.over15Rate * 100
        ),
      awayOver15:
        Math.round(
          awayStats.over15Rate * 100
        )
    }
  };
}

async function getCompetitionMatches(
  competition,
  dateFrom,
  dateTo
) {
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
    "status",
    "FINISHED"
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
  if (!FOOTBALL_API_KEY) {
    return res.status(500).json({
      error:
        "FOOTBALL_DATA_API_KEY não está configurada."
    });
  }

  try {
    const raw =
      req.query.competitions
        ? String(
            req.query.competitions
          )
        : "";

    const competitions =
      raw
        .split(",")
        .map((item) =>
          item.trim().toUpperCase()
        )
        .filter((code) =>
          Object.prototype.hasOwnProperty.call(
            COMPETITIONS,
            code
          )
        );

    if (!competitions.length) {
      return res.status(400).json({
        error:
          "Nenhuma competição válida foi indicada."
      });
    }

    /*
     * Para respeitar o limite da API,
     * usamos somente os últimos 10 dias.
     */
    const dateTo =
      getDateUTC(0);

    const dateFrom =
      getDateUTC(-9);

    const historyByCompetition =
      {};

    for (const competition of competitions) {
      try {
        historyByCompetition[
          competition
        ] =
          await getCompetitionMatches(
            competition,
            dateFrom,
            dateTo
          );
      } catch (error) {
        console.error(
          "Erro no histórico",
          competition,
          error.message
        );

        historyByCompetition[
          competition
        ] = [];
      }
    }

    const targetMatches =
      Array.isArray(
        req.body?.matches
      )
        ? req.body.matches
        : [];

    if (!targetMatches.length) {
      return res.status(200).json({
        predictions: {},
        meta: {
          dateFrom,
          dateTo,
          competitions:
            competitions.length,
          predictions:
            0,
          updatedAt:
            new Date().toISOString()
        }
      });
    }

    const predictions = {};

    for (const match of targetMatches) {
      const competitionCode =
        match.competition?.code;

      const history =
        historyByCompetition[
          competitionCode
        ] || [];

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

      const prediction =
        calculatePrediction(
          match,
          homeStats,
          awayStats
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
        ...prediction
      };
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      predictions,
      meta: {
        dateFrom,
        dateTo,
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
