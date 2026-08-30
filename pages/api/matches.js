const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

function getDateUTC(offset) {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + offset
  );

  return date
    .toISOString()
    .slice(0, 10);
}

async function getMatchesForDate(date) {
  const url =
    "https://api.football-data.org/v4/matches?date=" +
    date;

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

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        message:
          data?.message ||
          "Erro na football-data.org",
        errorCode:
          data?.errorCode ||
          response.status,
        date: date
      })
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
        "FOOTBALL_DATA_API_KEY não está configurada na Vercel."
    });
  }

  try {
    const dates = [
      getDateUTC(0),
      getDateUTC(1),
      getDateUTC(2),
      getDateUTC(3),
      getDateUTC(4),
      getDateUTC(5),
      getDateUTC(6)
    ];

    const results =
      await Promise.all(
        dates.map(function (date) {
          return getMatchesForDate(
            date
          );
        })
      );

    const matches =
      results.flat();

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json(
      matches
    );
  } catch (error) {
    console.error(
      "Erro em /api/matches:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro ao obter jogos."
    });
  }
}
