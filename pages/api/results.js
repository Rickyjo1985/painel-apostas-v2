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
   JOGO JÁ PODE SER VERIFICADO?
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
   * Esperamos 2h30 depois do início
   * antes de consultar o resultado.
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
   * IMPORTANTE:
   * Usamos apenas os IDs.
   *
   * NÃO usamos:
   * status=FINISHED
   *
   * Porque queremos recuperar também
   * jogos terminados em dias anteriores.
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
     * Apenas itens válidos e que estejam
     * suficientemente afastados do kickoff.
     */
    const readyItems =
      items.filter(
        (item) =>
          item &&
          item.matchId &&
          item.market &&
          (
            !item.competition ||
            VALID_COMPETITIONS.includes(
              item.competition
            )
          ) &&
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

    /*
     * IDs únicos.
     */
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
              id !== "undefined" &&
              id !== "null"
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

          found: 0,

          apiRequests: 0,

          reason:
            "Não existem IDs de jogos válidos."
        }
      });
    }

    /* =====================================================
       UMA ÚNICA CHAMADA À API
    ===================================================== */

    let apiRequests = 0;

    let apiData;

    try {
      apiRequests++;

      apiData =
        await getMatchesByIds(
          matchIds
        );
    } catch (error) {
      console.error(
        "Erro ao consultar jogos:",
        error.message
      );

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

      if (
        error.status ===
        403
      ) {
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
                readyItems.length,

              found: 0,

              apiRequests
            }
          });
      }

      throw error;
    }

    const matches =
      Array.isArray(
        apiData?.matches
      )
        ? apiData.matches
        : [];

    const matchesById =
      new Map();

    matches.forEach(
      (match) => {
        matchesById.set(
          String(
            match.id
          ),
          match
        );
      }
    );

    /* =====================================================
       AVALIAR PROGNÓSTICOS
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
       * Não encontrado.
       */
      if (!found) {
        continue;
      }

      /*
       * Só concluímos quando a API diz
       * explicitamente FINISHED.
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
          matches.length,

        found:
          results.length,

        apiRequests,

        requestsAvailable:
          apiData?.headers
            ?.available ||
          null,

        resetSeconds:
          apiData?.headers
            ?.reset ||
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
