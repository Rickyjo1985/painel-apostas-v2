const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

const CACHE_TTL =
  5 * 60 * 1000;

const MAX_IDS_PER_REQUEST = 20;

const matchesCache = new Map();

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
   VERIFICAR SE JÁ PODEMOS PROCURAR O RESULTADO
========================================================= */

function isReadyForResult(item) {
  if (!item?.utcDate) {
    return true;
  }

  const kickoff =
    new Date(
      item.utcDate
    ).getTime();

  if (
    Number.isNaN(kickoff)
  ) {
    return true;
  }

  /*
   * Esperamos 2h30 depois do início.
   */
  const waitTime =
    150 *
    60 *
    1000;

  return (
    Date.now() >=
    kickoff +
      waitTime
  );
}

/* =========================================================
   DIVIDIR ARRAY EM GRUPOS
========================================================= */

function chunkArray(
  array,
  size
) {
  const result = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(
        i,
        i + size
      )
    );
  }

  return result;
}

/* =========================================================
   CACHE
========================================================= */

function getCacheKey(ids) {
  return ids
    .map(String)
    .sort()
    .join(",");
}

/* =========================================================
   CONSULTAR JOGOS PELOS MATCH IDs
========================================================= */

async function getMatchesByIds(
  ids
) {
  const cacheKey =
    getCacheKey(ids);

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

  /*
   * O endpoint oficial aceita:
   * /v4/matches?ids=...
   */
  params.set(
    "ids",
    ids.join(",")
  );

  params.set(
    "limit",
    "100"
  );

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
          requestedIds: 0,
          returnedMatches: 0,
          found: 0,
          apiRequests: 0
        }
      });
    }

    /* =====================================================
       PENDENTES QUE JÁ PODEM SER VERIFICADOS
    ===================================================== */

    const readyItems =
      items.filter(
        (item) =>
          item &&
          item.matchId &&
          item.market &&
          item.status !== "HIT" &&
          item.status !== "MISS" &&
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

          requestedIds: 0,

          returnedMatches: 0,

          found: 0,

          apiRequests: 0,

          reason:
            "Nenhum prognóstico está pronto para verificação."
        }
      });
    }

    /* =====================================================
       MATCH IDs
    ===================================================== */

    const matchIds = [
      ...new Set(
        readyItems
          .map(
            (item) =>
              String(
                item.matchId
              )
          )
          .filter(
            (id) =>
              id &&
              id !==
                "undefined" &&
              id !==
                "null"
          )
      )
    ];

    if (
      !matchIds.length
    ) {
      return res.status(200).json({
        results: [],

        meta: {
          checked:
            items.length,

          ready:
            readyItems.length,

          requestedIds: 0,

          returnedMatches: 0,

          found: 0,

          apiRequests: 0,

          reason:
            "Não existem matchIds válidos."
        }
      });
    }

    /* =====================================================
       DIVIDIR IDS
    ===================================================== */

    const chunks =
      chunkArray(
        matchIds,
        MAX_IDS_PER_REQUEST
      );

    const matchesById =
      new Map();

    let apiRequests = 0;

    let requestsAvailable =
      null;

    let resetSeconds =
      null;

    /* =====================================================
       CONSULTAS SEQUENCIAIS
    ===================================================== */

    for (
      const chunk of chunks
    ) {
      try {
        apiRequests++;

        const response =
          await getMatchesByIds(
            chunk
          );

        requestsAvailable =
          response.headers
            ?.available ||
          requestsAvailable;

        resetSeconds =
          response.headers
            ?.reset ||
          resetSeconds;

        for (
          const match of
          response.matches
        ) {
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
          error.message
        );

        /*
         * 429 = quota temporariamente atingida.
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

                requestedIds:
                  matchIds.length,

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

        /*
         * 403 = problema de autenticação/permissão.
         */
        if (
          error.status ===
          403
        ) {
          return res
            .status(403)
            .json({
              error:
                "football-data.org recusou o acesso à API.",

              results: [],

              meta: {
                checked:
                  items.length,

                ready:
                  readyItems.length,

                requestedIds:
                  matchIds.length,

                apiRequests
              }
            });
        }

        /*
         * Outros erros não apagam o que
         * já tenha sido encontrado.
         */
      }
    }

    /* =====================================================
       AVALIAR OS RESULTADOS
    ===================================================== */

    const results = [];

    for (
      const item of readyItems
    ) {
      const found =
        matchesById.get(
          String(
            item.matchId
          )
        );

      /*
       * O jogo não foi devolvido pela API.
       */
      if (!found) {
        continue;
      }

      /*
       * Só concluímos quando o jogo
       * está oficialmente FINISHED.
       */
      if (
        found.status !==
        "FINISHED"
      ) {
        continue;
      }

      /*
       * FORMATO CORRETO DA API:
       *
       * score.fullTime.home
       * score.fullTime.away
       */
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

      if (
        hit === null
      ) {
        continue;
      }

      results.push({
        matchId:
          item.matchId,

        homeTeam:
          found.homeTeam?.name ||
          item.homeTeam,

        awayTeam:
          found.awayTeam?.name ||
          item.awayTeam,

        competition:
          found.competition
            ?.code ||
          item.competition ||
          "",

        utcDate:
          found.utcDate ||
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

        requestedIds:
          matchIds.length,

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
