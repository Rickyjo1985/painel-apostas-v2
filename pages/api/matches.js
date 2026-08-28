const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
const ODDS_API_KEY = '58f5c88bdf6fb881991f31be71992249';

// Função infalível para obter a data no fuso horário de Lisboa (Formato YYYY-MM-DD)
function getLisbonDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    const todayStr = getLisbonDate(now);
    
    // Buscar jogos para os próximos 10 dias para garantir cobertura
    const dateTo = new Date(now);
    dateTo.setDate(dateTo.getDate() + 10);
    const toDateStr = getLisbonDate(dateTo);

    // 1. Buscar jogos da football-data.org
    const matchesResponse = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${toDateStr}`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );

    if (!matchesResponse.ok) {
      return res.status(500).json({ error: 'Erro ao buscar jogos' });
    }

    const matchesData = await matchesResponse.json();
    const allMatches = matchesData.matches.filter(m => 
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    );

    // 2. Buscar odds da The Odds API (se tiver chave)
    let oddsMap = {};
    if (ODDS_API_KEY && !ODDS_API_KEY.startsWith('COLOCA')) {
      try {
        const oddsResponse = await fetch(
          `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&bookmakers=betclic,bet365,unibet`
        );
        
        if (oddsResponse.ok) {
          const oddsData = await oddsResponse.json();
          oddsData.forEach(event => {
            const key = `${event.home_team.toLowerCase()}|${event.away_team.toLowerCase()}`;
            const oddsInfo = { homeWin: null, draw: null, awayWin: null, over25: null, bookmaker: null };

            const preferred = ['betclic', 'bet365', 'unibet'];
            for (const bkName of preferred) {
              const bk = event.bookmakers?.find(b => b.key === bkName);
              if (bk) {
                oddsInfo.bookmaker = bk.title;
                const h2h = bk.markets?.find(m => m.key === 'h2h');
                if (h2h) {
                  const home = h2h.outcomes?.find(o => o.name === event.home_team);
                  const draw = h2h.outcomes?.find(o => o.name === 'Draw');
                  const away = h2h.outcomes?.find(o => o.name === event.away_team);
                  if (home) oddsInfo.homeWin = home.price;
                  if (draw) oddsInfo.draw = draw.price;
                  if (away) oddsInfo.awayWin = away.price;
                }
                const totals = bk.markets?.find(m => m.key === 'totals');
                if (totals) {
                  const over = totals.outcomes?.find(o => o.name === 'Over' && o.point === 2.5);
                  if (over) oddsInfo.over25 = over.price;
                }
                break;
              }
            }
            oddsMap[key] = oddsInfo;
          });
        }
      } catch (e) {
        console.error('Erro ao buscar odds:', e);
      }
    }

    // 3. Combinar jogos com odds
    const matchesWithOdds = allMatches.map(match => {
      const home = match.homeTeam.name.toLowerCase();
      const away = match.awayTeam.name.toLowerCase();
      const key = `${home}|${away}`;
      
      let odds = null;
      if (oddsMap[key]) {
        odds = oddsMap[key];
      } else {
        for (const [k, v] of Object.entries(oddsMap)) {
          const [h, a] = k.split('|');
          if ((home.includes(h) || h.includes(home)) && (away.includes(a) || a.includes(away))) {
            odds = v;
            break;
          }
        }
      }
      return { ...match, odds };
    });

    // 4. Cálculo infalível das datas de Sexta, Sábado e Domingo (Hora de Lisboa)
    const currentDay = now.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sáb

    let targetFriday = new Date(now);
    let targetSaturday = new Date(now);
    let targetSunday = new Date(now);

    if (currentDay === 5) { // Hoje é Sexta
      targetSaturday.setDate(now.getDate() + 1);
      targetSunday.setDate(now.getDate() + 2);
    } else if (currentDay === 6) { // Hoje é Sábado
      targetFriday.setDate(now.getDate() + 6); // Próxima sexta
      targetSunday.setDate(now.getDate() + 1);
    } else if (currentDay === 0) { // Hoje é Domingo
      targetFriday.setDate(now.getDate() + 5); // Próxima sexta
      targetSaturday.setDate(now.getDate() + 6);
    } else { // Hoje é Seg, Ter, Qua ou Qui
      targetFriday.setDate(now.getDate() + (5 - currentDay));
      targetSaturday.setDate(now.getDate() + (6 - currentDay));
      targetSunday.setDate(now.getDate() + (7 - currentDay));
    }

    const fridayStr = getLisbonDate(targetFriday);
    const saturdayStr = getLisbonDate(targetSaturday);
    const sundayStr = getLisbonDate(targetSunday);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = getLisbonDate(tomorrow);

    // 5. Filtrar por categorias
    const todayMatches = matchesWithOdds.filter(m => getLisbonDate(m.utcDate) === todayStr);
    const tomorrowMatches = matchesWithOdds.filter(m => getLisbonDate(m.utcDate) === tomorrowStr);
    
    const weekendMatches = matchesWithOdds.filter(m => {
      const d = getLisbonDate(m.utcDate);
      return d === saturdayStr || d === sundayStr;
    });

    const topLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'CL', 'EC'];
    const weekendDaysMatches = matchesWithOdds.filter(m => {
      const d = getLisbonDate(m.utcDate);
      return d === fridayStr || d === saturdayStr || d === sundayStr;
    });

    const bestBets = weekendDaysMatches
      .filter(m => topLeagues.includes(m.competition.code))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
      .slice(0, 6);

    res.status(200).json({
      today: todayMatches,
      tomorrow: tomorrowMatches,
      weekend: weekendMatches,
      bestBets: bestBets.length > 0 ? bestBets : weekendDaysMatches.slice(0, 6)
    });

  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ error: error.message });
  }
}
