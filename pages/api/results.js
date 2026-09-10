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

const CACHE_TTL =
  5 * 60 * 1000;

const matchesCache =
  new Map();

/* =========================================================
   RESULTADO DO PROGNÓSTICO
========================================================= */

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

/* =========================================================
   DATAS
========================================================= */

function formatDateUTC(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function addDaysUTC(
  dateString,
  days
) {
  const date =
    new Date(
      `${dateString}T00:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return formatDateUTC(
    date
  );
}

function dateDifference(
  fromDate,
  toDate
) {
  const from =
    new Date(
      `${fromDate}T00:00:00Z`
    );

  const to =
    new Date(
      `${toDate}T00:00:00Z`
    );

  return Math.round(
    (
      to.getTime() -
      from.getTime()
    ) / 86400000
  );
}

/*
 * Extrai a data UTC do prognóstico.
 */
function getItemDate(item) {
  if (
    !item?.utcDate
  ) {
    return null;
  }

  const date =
    new Date(
      item.utcDate
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return formatDateUTC(
    date
  );
}

/*
 * Só verificamos jogos 2h30 depois
 * do início.
 */
function isReadyForResult(item) {
  if (
    !item?.utcDate
  ) {
    return true;
  }

  const kickoff =
    new Date(
      item.utcDate
    ).getTime();

  if (
    Number.isNaN(
      kickoff
    )
  ) {
    return true;
  }

  return (
    Date.now() >=
    kickoff +
      150 *
        60 *
        1000
  );
}

/* =========================================================
   CONSTRUIR INTERVALOS
========================================================= */

/*
 * A API não deve receber intervalos maiores
 * do que 10 dias.
 *
 * Usamos 9 dias para manter margem.
 */
function buildDateRanges(
  dates
) {
  const uniqueDates = [
    ...new Set(
      dates.filter(Boolean)
    )
  ].sort();

  if (
    uniqueDates.length === 0
  ) {
    return [];
  }

  const ranges = [];

  let start =
    uniqueDates[0];

  let end =
    uniqueDates[0];

  for (
    let i = 1;
    i < uniqueDates.length;
    i++
  ) {
    const current =
      uniqueDates[i];

    if (
      dateDifference(
        start,
        current
      ) <= 9
    ) {
      end =
        current;

      continue;
    }

    ranges.push({
      from: start,
      to: end
    });

    start =
      current;

    end =
      current;
  }

  ranges.push({
    from: start,
    to: end
  });

  return ranges;
}

/* =========================================================
   CACHE
========================================================= */

function getCacheKey(
  competitions,
  dateFrom,
  dateTo
) {
  return [
    [...competitions].sort().join(","),
    dateFrom,
    dateTo
  ].join("|");
}

/* =========================================================
   CONSULTAR JOGOS POR DATA + COMPETIÇÕES
========================================================= */

async function getMatchesByRange(
  competitions,
  dateFrom,
  dateTo
) {
  const cacheKey =
    getCacheKey(
      competitions,
      dateFrom,
      dateTo
    );

  const cached =
    matchesCache.get(
      cacheKey
    );

  if (
    cached &&
    Date.now() -
      cached.timestamp <
      CACHE_TTL
  ) {
    return {
      matches:
        cached.matches,

      headers:
        cached.headers
    };
  }

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

  /*
   * Até 500 resultados.
   */
  params.set(
    "limit",
    "500"
  );

  /*
   * IMPORTANTE:
   *
   * NÃO usamos:
   * status=FINISHED
   *
   * porque esse filtro no endpoint
   * geral é limitado ao dia atual.
   *
   * Filtramos FINISHED depois,
   * no nosso próprio código.
   */
  const url =
    "https://api.football-data.org/v4/matches?" +
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

  const headers = {
    available:
      response.headers.get(
        "X-Requests-Available-Minute"
      ),

    reset:
      response.headers.get(
        "X-RequestCounter-Reset"
      ),

    retryAfter:
      response.headers.get(
        "Retry-After"
      )
  };

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

  if (
    !response.ok
  ) {
    const message =
      typeof data ===
      "string"
        ? data
        : data?.message ||
          `Erro HTTP ${response.status}`;

    const error =
      new Error(
        message
      );

    error.status =
      response.status;

    error.apiHeaders =
      headers;

    throw error;
  }

  const matches =
    Array.isArray(
      data?.matches
    )
      ? data.matches
      : [];

  matchesCache.set(
    cacheKey,
    {
      timestamp:
        Date.now(),

      matches,

      headers
    }
  );

  return {
    matches,

    headers
  };
}

/* =========================================================
   HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  if (
    req.method !==
    "POST"
  ) {
    return res.status(405).json({
      error:
        "Método não permitido."
    });
  }

  if (
    !FOOTBALL_API_KEY
  ) {
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

    if (
      !items.length
    ) {
      return res.status(200).json({
        results: [],

        meta: {
          checked: 0,
          ready: 0,
          found: 0,
          apiRequests: 0
        }
      });
    }

    /* =====================================================
       PENDENTES PRONTOS
    ===================================================== */

    const readyItems =
      items.filter(
        (item) =>
          item &&
          item.matchId &&
          item.market &&
          isReadyForResult(item)
      );

    if (
      !readyItems.length
    ) {
      return res.status(200).json({
        results: [],

        meta: {
          checked:
            items.length,

          ready: 0,

          found: 0,

          apiRequests: 0,

          reason:
            "Nenhum prognóstico está pronto para verificação."
        }
      });
    }

    /* =====================================================
       COMPETIÇÕES
    ===================================================== */

    const competitions = [
      ...new Set(
        readyItems
          .map(
            (item) =>
              item.competition
          )
          .filter(
            (competition) =>
              VALID_COMPETITIONS.includes(
                competition
              )
          )
      )
    ];

    if (
      !competitions.length
    ) {
      return res.status(200).json({
        results: [],

        meta: {
          checked:
            items.length,

          ready:
            readyItems.length,

          found: 0,

          apiRequests: 0,

          reason:
            "Nenhuma competição válida encontrada."
        }
      });
    }

    /* =====================================================
       DATAS
    ===================================================== */

    const dates =
      readyItems
        .map(
          getItemDate
        )
        .filter(Boolean);

    const ranges =
      buildDateRanges(
        dates
      );

    /* =====================================================
       BUSCAR JOGOS
    ===================================================== */

    const matchesById =
      new Map();

    let apiRequests = 0;

    let requestsAvailable =
      null;

    let resetSeconds =
      null;

    for (
      const range of ranges
    ) {
      try {
        apiRequests++;

        const response =
          await getMatchesByRange(
            competitions,
            range.from,
            range.to
          );

        requestsAvailable =
          response.headers
            ?.available ||
          requestsAvailable;

        resetSeconds =
          response.headers
            ?.reset ||
          resetSeconds;

        /*
         * Só guardamos FINISHED.
         */
        for (
          const match of
          response.matches
        ) {
          if (
            match.status !==
            "FINISHED"
          ) {
            continue;
          }

          matchesById.set(
            String(
              match.id
            ),
            match
          );
        }
      } catch (error) {
        console.error(
          "Erro ao consultar resultados:",
          range,
          error.message
        );

        /*
         * Limite da API.
         */
        if (
          error.status ===
          429
        ) {
          res.setHeader(
            "Cache-Control",
            "no-store, max-age=0"
          );

          return res
            .status(429)
            .json({
              error:
                "football-data.org atingiu o limite temporário de pedidos.",

              results: [],

              meta: {
                checked:
                  items.length,

                ready:
                  readyItems.length,

                found: 0,

                apiRequests,

                requestsAvailable:
                  error.apiHeaders
                    ?.available ||
                  null,

                resetSeconds:
                  error.apiHeaders
                    ?.reset ||
                  null,

                retryAfter:
                  error.apiHeaders
                    ?.retryAfter ||
                  null
              }
            });
        }
      }
    }

    /* =====================================================
       CRUZAR MATCH ID
    ===================================================== */

    const results = [];

    for (
      const item of readyItems
    ) {
      const match =
        matchesById.get(
          String(
            item.matchId
          )
        );

      /*
       * Não encontramos o jogo.
       */
      if (!match) {
        continue;
      }

      /*
       * Segurança.
       */
      if (
        match.status !==
        "FINISHED"
      ) {
        continue;
      }

      const homeGoals =
        Number(
          match.score
            ?.fullTime
            ?.home
        );

      const awayGoals =
        Number(
          match.score
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

      if (
        hit === null
      ) {
        continue;
      }

      results.push({
        matchId:
          item.matchId,

        homeTeam:
          match.homeTeam?.name ||
          item.homeTeam,

        awayTeam:
          match.awayTeam?.name ||
          item.awayTeam,

        competition:
          match.competition
            ?.code ||
          item.competition ||
          "",

        utcDate:
          match.utcDate ||
          item.utcDate,

        homeGoals,

        awayGoals,

        market:
          item.market,

        score:
          Number(
            item.score || 0
          ),

        hit
      });
    }

    /* =====================================================
       RESPOSTA
    ===================================================== */

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    return res.status(200).json({
      results,

      meta: {
        checked:
          items.length,

        ready:
          readyItems.length,

        competitions:
          competitions.length,

        ranges:
          ranges.length,

        returnedMatches:
          matchesById.size,

        found:
          results.length,

        apiRequests,

        requestsAvailable,

        resetSeconds,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/results:",
      error
    );

    return res
      .status(
        error.status ===
        429
          ? 429
          : 500
      )
      .json({
        error:
          error.message ||
          "Erro ao verificar resultados.",

        results: []
      });
  }
}
