const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

/*
 * Cache local para evitar repetir a mesma consulta
 * durante alguns minutos.
 */
const CACHE_TTL =
  5 * 60 * 1000;

/*
 * Número máximo de IDs enviados num pedido.
 *
 * Com 49 prognósticos pendentes:
 * 49 / 20 = 3 pedidos.
 */
const MAX_IDS_PER_REQUEST = 20;

const matchCache =
  new Map();

/* =========================================================
   PREDIÇÃO -> RESULTADO
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
   CACHE
========================================================= */

function getCacheKey(ids) {
  return ids
    .map(String)
    .sort()
    .join(",");
}

/* =========================================================
   CONSULTAR JOGOS PELOS IDs
========================================================= */

async function getFinishedMatchesByIds(
  ids
) {
  const cacheKey =
    getCacheKey(ids);

  const cached =
    matchCache.get(cacheKey);

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
        cached.headers || {}
    };
  }

  const params =
    new URLSearchParams();

  params.set(
    "ids",
    ids.join(",")
  );

  params.set(
    "status",
    "FINISHED"
  );

  params.set(
    "limit",
    "100"
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

  if (!response.ok) {
    const message =
      typeof data ===
      "string"
        ? data
        : data?.message ||
          `Erro HTTP ${response.status}`;

    const error =
      new Error(message);

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

  matchCache.set(
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
   CHUNK
========================================================= */

function chunkArray(
  array,
  size
) {
  const chunks = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    chunks.push(
      array.slice(
        i,
        i + size
      )
    );
  }

  return chunks;
}

/* =========================================================
   HORA MÍNIMA PARA VERIFICAR
========================================================= */

function isReadyForResult(item) {
  /*
   * Para registos antigos sem utcDate,
   * tentamos consultar directamente pelo matchId.
   */
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

  /*
   * 2h30 depois do início.
   */
  const checkAfter =
    150 *
    60 *
    1000;

  return (
    Date.now() >=
    kickoff +
      checkAfter
  );
}

/* =========================================================
   HANDLER
========================================================= */

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
        results: [],

        meta: {
          checked: 0,
          ready: 0,
          found: 0,
          apiRequests: 0
        }
      });
    }

    /*
     * Só consideramos PENDING.
     *
     * Jogos ainda demasiado recentes ficam
     * para a próxima verificação.
     */
    const pendingItems =
      items.filter(
        (item) =>
          item &&
          item.status !==
            "HIT" &&
          item.status !==
            "MISS" &&
          isReadyForResult(item)
      );

    if (
      !pendingItems.length
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
            "Nenhum jogo está pronto para verificação."
        }
      });
    }

    /*
     * Extraímos os matchIds.
     */
    const matchIds = [
      ...new Set(
        pendingItems
          .map(
            (item) =>
              item.matchId
          )
          .filter(
            (id) =>
              id !==
                undefined &&
              id !== null &&
              String(id).trim() !==
                ""
          )
          .map(String)
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
            pendingItems.length,

          found: 0,

          apiRequests: 0,

          reason:
            "Não existem matchIds válidos."
        }
      });
    }

    /*
     * Dividimos os IDs em pequenos blocos.
     */
    const chunks =
      chunkArray(
        matchIds,
        MAX_IDS_PER_REQUEST
      );

    /*
     * Mapa final dos jogos.
     */
    const matchesById =
      new Map();

    let apiRequests = 0;

    let lastHeaders = {};

    /*
     * Consultas sequenciais para respeitar
     * a limitação da API.
     */
    for (
      const chunk of chunks
    ) {
      try {
        apiRequests++;

        const response =
          await getFinishedMatchesByIds(
            chunk
          );

        lastHeaders =
          response.headers ||
          lastHeaders;

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
         * Limite da API.
         *
         * Não alteramos o Histórico.
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
                  pendingItems.length,

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

        /*
         * Recurso não disponível / problema de
         * autenticação / permissão.
         */
        if (
          error.status ===
          403
        ) {
          res.setHeader(
            "Cache-Control",
            "no-store, max-age=0"
          );

          return res
            .status(403)
            .json({
              error:
                "football-data.org recusou o acesso aos resultados.",

              results: [],

              meta: {
                checked:
                  items.length,

                ready:
                  pendingItems.length,

                found: 0,

                apiRequests
              }
            });
        }

        /*
         * Para outros erros, não destruímos
         * resultados já encontrados.
         */
      }
    }

    /* =====================================================
       AVALIAR RESULTADOS
    ===================================================== */

    const results = [];

    for (
      const item of pendingItems
    ) {
      const found =
        matchesById.get(
          String(
            item.matchId
          )
        );

      /*
       * O jogo ainda não apareceu como
       * FINISHED ou não foi encontrado.
       */
      if (!found) {
        continue;
      }

      /*
       * Segurança adicional.
       */
      if (
        found.status !==
        "FINISHED"
      ) {
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
          pendingItems.length,

        requestedIds:
          matchIds.length,

        found:
          results.length,

        apiRequests,

        requestsAvailable:
          lastHeaders.available ||
          null,

        resetSeconds:
          lastHeaders.reset ||
          null,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/results:",
      error
    );

    const status =
      error.status === 429
        ? 429
        : error.status === 403
        ? 403
        : 500;

    return res
      .status(status)
      .json({
        error:
          error.message ||
          "Erro ao verificar resultados.",

        results: []
      });
  }
}
