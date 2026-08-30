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

    const dateFrom =
      now.toISOString().slice(0, 10);

    const dateToObject =
      new Date(now);

    dateToObject.setUTCDate(
      dateToObject.getUTCDate() + 6
    );

    const dateTo =
      dateToObject
        .toISOString()
        .slice(0, 10);

    const url =
      "https://api.football-data.org/v4/matches" +
      "?dateFrom=" +
      dateFrom +
      "&dateTo=" +
      dateTo;

    console.log(
      "Football-data.org:",
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
      console.error(
        "Football-data.org erro:",
        response.status,
        data
      );

      if (
        response.status === 429
      ) {
        return res.status(429).json({
          error:
            "A football-data.org atingiu o limite de pedidos. Aguarda alguns minutos e tenta novamente."
        });
      }

      return res.status(
        response.status
      ).json({
        error:
          typeof data === "string"
            ? data
            : data?.message ||
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
      "s-maxage=300, stale-while-revalidate=600"
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
        "Erro interno ao obter jogos."
    });
  }
}

