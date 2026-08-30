```js
const FOOTBALL_API_KEY =
  process.env.FOOTBALL_DATA_API_KEY;

export default async function handler(req, res) {
  if (!FOOTBALL_API_KEY) {
    return res.status(500).json({
      error:
        'FOOTBALL_DATA_API_KEY não está configurada na Vercel.'
    });
  }

  try {
    const now = new Date();

    // Hoje, em UTC
    const dateFrom =
      now.toISOString().split('T')[0];

    // Apenas os próximos 7 dias.
    // O limite da football-data.org é 10 dias.
    const futureDate = new Date(now);

    futureDate.setUTCDate(
      futureDate.getUTCDate() + 7
    );

    const dateTo =
      futureDate.toISOString().split('T')[0];

    const url =
      'https://api.football-data.org/v4/matches' +
      `?dateFrom=${dateFrom}` +
      `&dateTo=${dateTo}` +
      '&status=SCHEDULED,TIMED';

    console.log(
      'Football-data.org:',
      url.replace(
        /dateFrom=[^&]+/,
        `dateFrom=${dateFrom}`
      )
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token':
          FOOTBALL_API_KEY,
        Accept: 'application/json'
      }
    });

    const data =
      await response.json().catch(
        () => null
      );

    if (!response.ok) {
      console.error(
        'Football-data.org error:',
        response.status,
        data
      );

      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          `Football-data.org respondeu com HTTP ${response.status}`,
        errorCode:
          data?.errorCode || response.status
      });
    }

    const matches =
      Array.isArray(data?.matches)
        ? data.matches
        : [];

    /*
     * Cache curto na Vercel.
     * A página pode actualizar sem fazer
     * uma chamada à API a cada refresh.
     */
    res.setHeader(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
    );

    return res.status(200).json(matches);
  } catch (error) {
    console.error(
      'Erro interno em /api/matches:',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'Erro interno ao obter jogos.'
    });
  }
}
```
