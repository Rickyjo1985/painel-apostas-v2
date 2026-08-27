export default async function handler(req, res) {
  const API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
  
  try {
    // Calcular data de hoje (fuso horário de Lisboa)
    const now = new Date();
    const lisbonOffset = 0; // UTC+0 em inverno, UTC+1 em verão
    const localDate = new Date(now.getTime() + (lisbonOffset * 60 * 60 * 1000));
    const today = localDate.toISOString().split('T')[0];
    
    // Procurar jogos de hoje até 7 dias (para garantir que há jogos)
    const dateTo = new Date(localDate);
    dateTo.setDate(dateTo.getDate() + 7);
    const toDate = dateTo.toISOString().split('T')[0];
    
    const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${toDate}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Erro da API: ${response.status}` });
    }
    
    const data = await response.json();
    
    // Filtrar apenas jogos futuros ou de hoje (sem filtro de liga)
    const matches = data.matches.filter(m => 
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    ).slice(0, 10); // Mostrar até 10 jogos
    
    res.status(200).json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
