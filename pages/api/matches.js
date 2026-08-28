const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';

export default async function handler(req, res) {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dateTo = new Date(now);
    dateTo.setDate(dateTo.getDate() + 10);
    const toDate = dateTo.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${toDate}`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Erro: ' + response.status });
    }

    const data = await response.json();
    res.status(200).json(data.matches || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
