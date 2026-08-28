const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
const ODDS_API_KEY = '58f5c88bdf6fb881991f31be71992249';

// Função infalível: retorna a data em Lisboa no formato YYYY-MM-DD
function getLisbonDate(date) {
  const lisbonDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
  const year = lisbonDate.getFullYear();
  const month = String(lisbonDate.getMonth() + 1).padStart(2, '0');
  const day = String(lisbonDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Retorna um objeto Date ajustado para o fuso horário de Lisboa
function getLisbonNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
}

export default async function handler(req, res) {
  try {
    // Usar hora de Lisboa para TUDO
    const lisbonNow = getLisbonNow();
    const todayStr = getLisbonDate(lisbonNow);
    
    const dateTo = new Date(lisbonNow);
    dateTo.setDate(dateTo.getDate() + 10);
    const toDateStr = getLisbonDate(dateTo);

    // 1. Buscar jogos
    const matchesResponse = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${toDateStr}`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );

    if (!matchesResponse.ok) {
      return res.status(500).json({ error: 'Erro ao buscar jogos: ' + matchesResponse.status });
    }

    const matchesData = await matchesResponse.json();
    const allMatches = matchesData.matches.filter(m => 
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    );

    // 2. Buscar odds
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

    // 4. Calcular dias da semana BASEADO EM LISBOA (não no servidor!)
    const currentDay = lisbonNow.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sáb

    let targetFriday = new Date(lisbonNow);
    let targetSaturday = new Date(lisbonNow);
    let targetSunday = new Date(lisbonNow);

    if (currentDay === 5) { // Sexta
      // targetFriday já é hoje
      targetSaturday.setDate(lisbonNow.getDate() + 1);
      targetSunday.setDate(lisbonNow.getDate() + 2);
    } else if (currentDay === 6) { // Sábado
      targetFriday.setDate(lisbonNow.getDate() + 6);
      // targetSaturday já é hoje
      targetSunday.setDate(lisbonNow.getDate() + 1);
    } else if (currentDay === 0) { // Domingo
      targetFriday.setDate(lisbonNow.getDate() + 5);
      targetSaturday.setDate(lisbonNow.getDate() + 6);
      // targetSunday já é hoje
    } else { // Seg, Ter, Qua, Qui
      targetFriday.setDate(lisbonNow.getDate() + (5 - currentDay));
      targetSaturday.setDate(lisbonNow.getDate() + (6 - currentDay));
      targetSunday.setDate(lisbonNow.getDate() + (7 - currentDay));
    }

    const fridayStr = getLisbonDate(targetFriday);
    const saturdayStr = getLisbonDate(targetSaturday);
    const sundayStr = getLisbonDate(targetSunday);

    const tomorrow = new Date(lisbonNow);
    tomorrow.setDate(lisbonNow.getDate() + 1);
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

    // Debug para verificar as datas calculadas
    console.log('Lisbon Now:', lisbonNow.toISOString(), 'Day:', currentDay);
    console.log('Dates:', { friday: fridayStr, saturday: saturdayStr, sunday: sundayStr });
    console.log('Weekend matches:', weekendMatches.length, '(Sat:', matchesWithOdds.filter(m => getLisbonDate(m.utcDate) === saturdayStr).length, 'Sun:', matchesWithOdds.filter(m => getLisbonDate(m.utcDate) === sundayStr).length, ')');

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
