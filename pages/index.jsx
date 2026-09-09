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

function sameTeam(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);

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
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return formatDateUTC(date);
}

async function getFinishedMatches(
  competition,
  dateFrom,
  dateTo
) {
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
    throw new Error(
      typeof data === "string"
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
     * Descobrimos o intervalo total das datas
     * dos prognósticos pendentes.
     */
    const dates =
      validItems
        .map(getItemDate)
        .filter(Boolean)
        .sort();

    let globalFrom = null;
    let globalTo = null;

    if (dates.length > 0) {
      globalFrom = dates[0];
      globalTo = dates[dates.length - 1];
    } else {
      const today =
        new Date();

      globalTo =
        formatDateUTC(today);

      globalFrom =
        addDaysUTC(
          globalTo,
          -30
        );
    }

    /*
     * A API aceita no máximo 10 dias por pedido.
     * Por isso dividimos o intervalo em blocos
     * de 9 dias.
     */
    const ranges = [];

    let rangeStart =
      globalFrom;

    while (
      rangeStart <= globalTo
    ) {
      let rangeEnd =
        addDaysUTC(
          rangeStart,
          9
        );

      if (
        rangeEnd > globalTo
      ) {
        rangeEnd =
          globalTo;
      }

      ranges.push({
        from:
          rangeStart,
        to:
          rangeEnd
      });

      const nextStart =
        addDaysUTC(
          rangeEnd,
          1
        );

      if (
        nextStart >
        globalTo
      ) {
        break;
      }

      rangeStart =
        nextStart;
    }

    /*
     * Guardamos resultados por competição
     * para evitar chamadas repetidas.
     */
    const matchesByCompetition =
      {};

    for (
      const competition of [
        ...new Set(
          validItems.map(
            (item) =>
              item.competition
          )
        )
      ]
    ) {
      matchesByCompetition[
        competition
      ] = [];

      for (
        const range of ranges
      ) {
        try {
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

    for (
      const item of validItems
    ) {
      const history =
        matchesByCompetition[
          item.competition
        ] || [];

      const itemDate =
        getItemDate(item);

      let candidates =
        history;

      /*
       * Primeiro tentamos restringir pela data
       * do próprio prognóstico.
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
       * Procuramos correspondência exacta de
       * casa -> fora.
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
       * Caso a API tenha uma pequena diferença
       * de data/hora, tentamos novamente em todo
       * o histórico dessa competição.
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

        ranges:
          ranges.length,

        updatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "Erro em /api/results:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro ao verificar resultados."
    });
  }
}
