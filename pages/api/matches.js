const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

export default async function handler(req, res) {
  if (!FOOTBALL_API_KEY) {
    return res.status(500).json({
      error: 'FOOTBALL_DATA_API_KEY não está configurada na Vercel.'
    });
  }

  try {
    const now = new Date();

    // Margem de 1 dia para evitar problemas de timezone
    // entre UTC e a hora local de Portugal.
    const dateFrom = new Date(now);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);

    const dateTo = new Date(now);
    dateTo.setUTCDate(dateTo.getUTCDate() + 10);

    const fromDate = dateFrom.toISOString().split('T')[0];
    const toDate = dateTo.toISOString().split('T')[0];

    const url =
      `https://api.football-data.org/v4/matches` +
      `?dateFrom=${fromDate}&dateTo=${toDate}`;

    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: errorText || `Erro da API: ${response.status}`
      });
    }

    const data = await response.json();

    // Cache curto para não gastar pedidos desnecessariamente
    res.setHeader(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
    );

    return res.status(200).json(data.matches || []);
  } catch (error) {
    console.error('Football Data API:', error);

    return res.status(500).json({
      error: error.message || 'Erro interno ao obter jogos.'
    });
  }
}
