const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
const ODDS_API_KEY = 'COLOCA_AQUI_A_TUA_CHAVE_DA_THE_ODDS_API';

// Retorna YYYY-MM-DD no fuso de Lisboa
function getLisbonDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
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

    // 3. Combinar jogos com odds e adicionar data em Lisboa
    const matchesWithDate = allMatches.map(match => {
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
      
      const lisbonDate = getLisbonDate(match.utcDate);
      
      return { ...match, odds, lisbonDate };
    });

    // 4. Agrupar jogos por data
    const matchesByDate = {};
    matchesWithDate.forEach(match => {
      if (!matchesByDate[match.lisbonDate]) {
        matchesByDate[match.lisbonDate] = [];
      }
      matchesByDate[match.lisbonDate].push(match);
    });

    // 5. Retornar tudo para o frontend decidir
    res.status(200).json({
      today: todayStr,
      matchesByDate: matchesByDate,
      allMatches: matchesWithDate
    });

  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ error: error.message });
  }
}
