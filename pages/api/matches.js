const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

export default async function handler(req, res) {
  if (!FOOTBALL_API_KEY) {
    return res.status(500).json({
      error:
        "FOOTBALL_DATA_API_KEY não está configurada na Vercel."
    });
  }

  try {
    const now = new Date();

    // Data de hoje em UTC
    const dateFrom =
      now.toISOString().slice(0, 10);

    // Pedimos apenas mais 6 dias.
    // Assim o período total fica dentro do
    // limite de 10 dias da football-data.org.
    const dateToObject =
      new Date(now);

    dateToObject.setUTCDate(
      dateToObject.getUTCDate() + 6
    );

    const dateTo =
      dateToObject
        .toISOString()
        .slice(0, 10);

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
      "SCHEDULED,TIMED"
    );

    const url =
      "https://api.football-data.org/v4/matches?" +
      params.toString();

    console.log(
      "Football-data.org período:",
      dateFrom,
      "até",
      dateTo
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

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Football-data.org:",
        response.status,
        data
      );

      return res.status(
        response.status
      ).json({
        error:
          data?.message ||
          "Erro na football-data.org",
        errorCode:
          data?.errorCode ||
          response.status
      });
    }

    const matches =
      Array.isArray(
        data?.matches
      )
        ? data.matches
        : [];

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json(
      matches
    );
  } catch (error) {
    console.error(
      "Erro interno em /api/matches:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao obter jogos."
    });
  }
}
