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

/*
 * Cache em memória para evitar repetir exactamente
 * a mesma consulta durante alguns minutos.
 */
const CACHE_TTL =
  5 * 60 * 1000;

const finishedMatchesCache =
  new Map();

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

function sameTeam(a, b) {
  const x =
    normalizeName(a);

  const y =
    normalizeName(b);

  if (!x || !y) {
    return false;
  }

  return (
    x === y ||
    x.includes(y) ||
    y.includes(x)
  );
}

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
    date.getUTCDate() + days
  );

  return formatDateUTC(
    date
  );
}

function dateDiffUTC(
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
    ) /
      86400000
  );
}

/*
 * Cria intervalos de no máximo 10 dias,
 * mas apenas para as datas realmente existentes
 * nos prognósticos pendentes.
 */
function buildRanges(
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

  let rangeStart =
    uniqueDates[0];

  let rangeEnd =
    uniqueDates[0];

  for (
    let i = 1;
    i < uniqueDates.length;
    i++
  ) {
    const currentDate =
      uniqueDates[i];

    /*
     * 9 dias de diferença =
     * 10 dias inclusivos.
     */
    if (
      dateDiffUTC(
        rangeStart,
        currentDate
      ) <= 9
    ) {
      rangeEnd =
        currentDate;
      continue;
    }

    ranges.push({
      from: rangeStart,
      to: rangeEnd
    });

    rangeStart =
      currentDate;

    rangeEnd =
      currentDate;
  }

  ranges.push({
    from: rangeStart,
    to: rangeEnd
  });

  return ranges;
}

function getCacheKey(
  competition,
  dateFrom,
  dateTo
) {
  return [
    competition,
    dateFrom,
    dateTo
  ].join("|");
}

async function getFinishedMatches(
  competition,
  dateFrom,
  dateTo
) {
  const cacheKey =
    getCacheKey(
      competition,
      dateFrom,
      dateTo
    );

  const cached =
    finishedMatchesCache.get(
      cacheKey
    );

  if (
    cached &&
    Date.now() -
      cached.timestamp <
      CACHE_TTL
  ) {
    return cached.matches;
  }

  const params =
    new URLSearchParams();

  params.set(
    "status",
    "FINISHED"
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

    throw error;
  }

  const matches =
    Array.isArray(
      data?.matches
    )
      ? data.matches
      : [];

  finishedMatchesCache.set(
    cacheKey,
    {
      timestamp:
        Date.now(),
      matches
    }
  );

  return matches;
}

function getItemDate(item) {
  if (
    item?.utcDate &&
    !Number.isNaN(
      new Date(
        item.utcDate
      ).getTime()
    )
  ) {
    return formatDateUTC(
      new Date(item.utcDate)
    );
  }

  return null;
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
          valid: 0,
          found: 0
        }
      });
    }

    const validItems =
      items.filter(
        (item) =>
          item &&
          VALID_COMPETITIONS.includes(
            item.competition
          ) &&
          item.homeTeam &&
          item.awayTeam &&
          item.market
      );

    if (!validItems.length) {
      return res.status(200).json({
        results: [],
        meta: {
          checked: items.length,
          valid: 0,
          found: 0
        }
      });
    }

    /*
     * Hora/data actual em UTC.
     */
    const now =
      new Date();

    const todayUTC =
      formatDateUTC(now);

    /*
     * Agrupamos os prognósticos por competição.
     */
    const itemsByCompetition =
      {};

    for (
      const item of validItems
    ) {
      const competition =
        item.competition;

      const itemDate =
        getItemDate(item);

      /*
       * Não procuramos resultados de jogos
       * que ainda estão no futuro.
       */
      if (
        itemDate &&
        itemDate > todayUTC
      ) {
        continue;
      }

      if (
        !itemsByCompetition[
          competition
        ]
      ) {
        itemsByCompetition[
          competition
        ] = [];
      }

      itemsByCompetition[
        competition
      ].push(item);
    }

    /*
     * Resultados encontrados por competição.
     */
    const matchesByCompetition =
      {};

    /*
     * Informação de diagnóstico.
     */
    let apiRequests = 0;

    /*
     * Consultamos apenas as datas necessárias
     * para cada competição.
     */
    for (
      const competition of Object.keys(
        itemsByCompetition
      )
    ) {
      const competitionItems =
        itemsByCompetition[
          competition
        ];

      const dates =
        competitionItems
          .map(
            getItemDate
          )
          .filter(Boolean);

      const ranges =
        buildRanges(
          dates
        );

      matchesByCompetition[
        competition
      ] = [];

      for (
        const range of ranges
      ) {
        try {
          apiRequests++;

          const matches =
            await getFinishedMatches(
              competition,
              range.from,
              range.to
            );

          matchesByCompetition[
            competition
          ].push(
            ...matches
          );
        } catch (error) {
          console.error(
            "Erro resultados:",
            competition,
            range,
            error.message
          );

          /*
           * Se for limite da API,
           * devolvemos o erro ao frontend.
           */
          if (
            error.status ===
              429 ||
            /rate limit|too many requests|limit/i.test(
              error.message
            )
          ) {
            res.setHeader(
              "Cache-Control",
              "no-store, max-age=0"
            );

            return res
              .status(429)
              .json({
                error:
                  "football-data.org atingiu temporariamente o limite de pedidos.",
                results: [],
                meta: {
                  checked:
                    items.length,
                  valid:
                    validItems.length,
                  found: 0,
                  apiRequests
                }
              });
          }

          /*
           * Para outros erros, não destruímos
           * os restantes resultados.
           */
        }
      }
    }

    /*
     * Remover duplicados por ID.
     */
    for (
      const competition of Object.keys(
        matchesByCompetition
      )
    ) {
      const unique =
        new Map();

      for (
        const match of
        matchesByCompetition[
          competition
        ]
      ) {
        unique.set(
          String(match.id),
          match
        );
      }

      matchesByCompetition[
        competition
      ] = [
        ...unique.values()
      ];
    }

    const results = [];

    /*
     * Apenas avaliamos itens que têm
     * resultados efectivamente encontrados.
     */
    for (
      const item of validItems
    ) {
      const itemDate =
        getItemDate(item);

      /*
       * Jogos futuros ainda não podem ser
       * concluídos.
       */
      if (
        itemDate &&
        itemDate > todayUTC
      ) {
        continue;
      }

      const history =
        matchesByCompetition[
          item.competition
        ] || [];

      if (
        history.length === 0
      ) {
        continue;
      }

      let candidates =
        history;

      /*
       * Primeiro pela mesma data UTC.
       */
      if (itemDate) {
        candidates =
          history.filter(
            (match) =>
              getItemDate(
                match
              ) === itemDate
          );
      }

      /*
       * Procuramos casa -> fora.
       */
      let found =
        candidates.find(
          (match) =>
            sameTeam(
              match.homeTeam?.name,
              item.homeTeam
            ) &&
            sameTeam(
              match.awayTeam?.name,
              item.awayTeam
            )
        );

      /*
       * Fallback caso exista pequena diferença
       * temporal entre os registos.
       */
      if (!found) {
        found =
          history.find(
            (match) =>
              sameTeam(
                match.homeTeam?.name,
                item.homeTeam
              ) &&
              sameTeam(
                match.awayTeam?.name,
                item.awayTeam
              )
          );
      }

      if (!found) {
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
          found.homeTeam?.name,

        awayTeam:
          found.awayTeam?.name,

        competition:
          item.competition,

        utcDate:
          found.utcDate,

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

    /*
     * Não deixar caches HTTP antigos
     * interferirem na verificação.
     */
    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    return res.status(200).json({
      results,

      meta: {
        checked:
          items.length,

        valid:
          validItems.length,

        found:
          results.length,

        apiRequests,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/results:",
      error
    );

    return res.status(
      error.status === 429
        ? 429
        : 500
    ).json({
      error:
        error.message ||
        "Erro ao verificar resultados.",

      results: []
    });
  }
}
