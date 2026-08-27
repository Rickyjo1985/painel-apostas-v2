export default async function handler(req, res) {
  const API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const dateTo = new Date();
    dateTo.setDate(dateTo.getDate() + 3);
    const toDate = dateTo.toISOString().split('T')[0];
    
    const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${toDate}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Erro da API: ${response.status}` });
    }
    
    const data = await response.json();
    
    const popularLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL'];
    const matches = data.matches.filter(m => 
      popularLeagues.includes(m.competition.code) && 
      m.status === 'SCHEDULED'
    ).slice(0, 5);
    
    res.status(200).json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
