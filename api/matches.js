export default async function handler(req, res) {
  const API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
  
  try {
    // Função para obter a data no fuso horário de Lisboa
    function getLisbonDate(date = new Date()) {
      const lisbonTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
      return lisbonTime.toISOString().split('T')[0];
    }
    
    // Função para adicionar dias a uma data
    function addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }
    
    // Função para converter UTC para data de Lisboa
    function getMatchLisbonDate(utcDate) {
      const date = new Date(utcDate);
      return getLisbonDate(date);
    }
    
    // Data atual em Lisboa
    const now = new Date();
    const today = getLisbonDate(now);
    
    // Amanhã
    const tomorrow = getLisbonDate(addDays(now, 1));
    
    // Calcular próxima sexta, sábado e domingo
    const dayOfWeek = now.getDay(); // 0 = domingo, 1 = segunda, ..., 5 = sexta, 6 = sábado
    
    let daysUntilFriday, daysUntilSaturday, daysUntilSunday;
    
    if (dayOfWeek === 5) {
      // Hoje é sexta
      daysUntilFriday = 0;
      daysUntilSaturday = 1;
      daysUntilSunday = 2;
    } else if (dayOfWeek === 6) {
      // Hoje é sábado
      daysUntilFriday = 6; // Próxima sexta
      daysUntilSaturday = 0;
      daysUntilSunday = 1;
    } else if (dayOfWeek === 0) {
      // Hoje é domingo
      daysUntilFriday = 5; // Próxima sexta
      daysUntilSaturday = 6;
      daysUntilSunday = 0;
    } else {
      // Dia de semana (segunda a quinta)
      daysUntilFriday = 5 - dayOfWeek;
      daysUntilSaturday = 6 - dayOfWeek;
      daysUntilSunday = 7 - dayOfWeek;
    }
    
    const friday = getLisbonDate(addDays(now, daysUntilFriday));
    const saturday = getLisbonDate(addDays(now, daysUntilSaturday));
    const sunday = getLisbonDate(addDays(now, daysUntilSunday));
    
    // Buscar jogos dos próximos 10 dias
    const dateTo = getLisbonDate(addDays(now, 10));
    
    const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${dateTo}`, {
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
    
    // Organizar por categorias (usando datas de Lisboa)
    const todayMatches = allMatches.filter(m => getMatchLisbonDate(m.utcDate) === today);
    const tomorrowMatches = allMatches.filter(m => getMatchLisbonDate(m.utcDate) === tomorrow);
    
    const weekendMatches = allMatches.filter(m => {
      const matchDate = getMatchLisbonDate(m.utcDate);
      return matchDate === saturday || matchDate === sunday;
    });
    
    // Melhores 6 apostas: jogos de sexta, sábado e domingo (priorizando ligas principais)
    const topLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'CL', 'EC'];
    
    const weekendDaysMatches = allMatches.filter(m => {
      const matchDate = getMatchLisbonDate(m.utcDate);
      return matchDate === friday || matchDate === saturday || matchDate === sunday;
    });
    
    // Priorizar ligas principais, depois ordenar por data
    const bestBets = weekendDaysMatches
      .sort((a, b) => {
        // Primeiro: ligas principais
        const aIsTop = topLeagues.includes(a.competition.code) ? 0 : 1;
        const bIsTop = topLeagues.includes(b.competition.code) ? 0 : 1;
        if (aIsTop !== bIsTop) return aIsTop - bIsTop;
        
        // Depois: ordenar por data
        return new Date(a.utcDate) - new Date(b.utcDate);
      })
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
