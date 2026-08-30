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
    const url =
      'https://api.football-data.org/v4/matches';

    console.log(
      'A chamar football-data.org:',
      url
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
        'Football-data.org:',
        response.status,
        data
      );

      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          'Erro na football-data.org',
        errorCode:
          data?.errorCode ||
          response.status
      });
    }

    const matches =
      Array.isArray(data?.matches)
        ? data.matches
        : [];

    /*
     * Devolvemos apenas jogos futuros/agendados.
     */
    const now = new Date();

    const futureMatches =
      matches.filter((match) => {
        const status =
          match.status;

        const isScheduled =
          status === 'SCHEDULED' ||
          status === 'TIMED';

        const matchDate =
          new Date(
            match.utcDate
          );

        return (
          isScheduled &&
          matchDate >= now
        );
      });

    res.setHeader(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
    );

    return res.status(200).json(
      futureMatches
    );
  } catch (error) {
    console.error(
      'Erro interno:',
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
