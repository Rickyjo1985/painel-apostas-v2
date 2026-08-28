const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
const ODDS_API_KEY = 'COLOCA_AQUI_A_TUA_CHAVE_DA_THE_ODDS_API';

// Função infalível: retorna YYYY-MM-DD no fuso de Lisboa
function getLisbonDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

// Retorna o dia da semana em Lisboa (0=Dom, 1=Seg, ..., 6=Sáb)
function getLisbonDayOfWeek(date) {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    weekday: 'short'
  }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dayName];
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    const todayStr = getLisbonDate(now);
    
    const dateTo = new Date(now);
    dateTo.setUTCDate(dateTo.getUTCDate() + 10);
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

    // 2. Buscar odds (se tiver chave)
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

    // 4. Calcular sexta, sábado e domingo ITERANDO pelos próximos 10 dias
    // Esta abordagem é 100% fiável porque usa o nome do dia em Lisboa
    const nextWeekend = { friday: null, saturday: null, sunday: null };
    const targetDays = { 5: 'friday', 6: 'saturday', 0: 'sunday' };
    
    for (let i = 0; i < 10; i++) {
      const datePlusI = new Date(now);
      datePlusI.setUTCDate(datePlusI.getUTCDate() + i);
      const lisbonDayOfWeek = getLisbonDayOfWeek(datePlusI);
      const targetKey = targetDays[lisbonDayOfWeek];
      
      if (targetKey && !nextWeekend[targetKey]) {
        nextWeekend[targetKey] = getLisbonDate(datePlusI);
      }
      
      if (nextWeekend.friday && nextWeekend.saturday && nextWeekend.sunday) break;
    }

    const fridayStr = nextWeekend.friday;
    const saturdayStr = nextWeekend.saturday;
    const sundayStr = nextWeekend.sunday;
    
    const tomorrowDate = new Date(now);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrowStr = getLisbonDate(tomorrowDate);

    // Debug
    console.log('Lisbon Today:', todayStr);
    console.log('Weekend dates:', { friday: fridayStr, saturday: saturdayStr, sunday: sundayStr });

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

    console.log('Matches count:', {
      today: todayMatches.length,
      tomorrow: tomorrowMatches.length,
      weekend: weekendMatches.length,
      bestBets: bestBets.length
    });

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
