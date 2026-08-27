export default async function handler(req, res) {
  const API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
  
  try {
    // Calcular datas (fuso horário de Lisboa)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Amanhã
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    // Fim de semana (próximo sábado e domingo)
    const dayOfWeek = now.getDay(); // 0 = domingo, 6 = sábado
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(now);
    saturday.setDate(saturday.getDate() + daysUntilSaturday);
    const saturdayDate = saturday.toISOString().split('T')[0];
    
    const sunday = new Date(saturday);
    sunday.setDate(sunday.getDate() + 1);
    const sundayDate = sunday.toISOString().split('T')[0];
    
    // Buscar jogos dos próximos 10 dias (para cobrir tudo)
    const dateTo = new Date(now);
    dateTo.setDate(dateTo.getDate() + 10);
    const toDate = dateTo.toISOString().split('T')[0];
    
    const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${toDate}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Erro da API: ${response.status}` });
    }
    
    const data = await response.json();
    
    // Filtrar jogos futuros
    const allMatches = data.matches.filter(m => 
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    );
    
    // Organizar por categorias
    const todayMatches = allMatches.filter(m => m.utcDate.startsWith(today));
    const tomorrowMatches = allMatches.filter(m => m.utcDate.startsWith(tomorrowDate));
    const weekendMatches = allMatches.filter(m => 
      m.utcDate.startsWith(saturdayDate) || m.utcDate.startsWith(sundayDate)
    );
    
    // Melhores 6 apostas (ligas principais, ordenadas por importância)
    const topLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'CL', 'EC'];
    const bestBets = allMatches
      .filter(m => topLeagues.includes(m.competition.code))
      .slice(0, 6);
    
    res.status(200).json({
      today: todayMatches,
      tomorrow: tomorrowMatches,
      weekend: weekendMatches,
      bestBets: bestBets
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
