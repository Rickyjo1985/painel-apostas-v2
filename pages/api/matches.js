const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';
const ODDS_API_KEY = 'COLOCA_AQUI_A_TUA_CHAVE_DA_THE_ODDS_API';

export default async function handler(req, res) {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dateTo = new Date(now);
    dateTo.setDate(dateTo.getDate() + 10);
    const toDate = dateTo.toISOString().split('T')[0];

    // 1. Buscar jogos da football-data.org
    const matchesResponse = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${toDate}`,
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
        // Tentar match parcial
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

    // 4. Organizar por categorias
    function getLisbonDate(dateString) {
      return new Date(dateString).toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }).split(',')[0];
    }

    const todayStr = getLisbonDate(now);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLisbonDate(tomorrow);

    const dayOfWeek = now.getDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    let daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    if (dayOfWeek === 5) { daysUntilFriday = 0; daysUntilSaturday = 1; }
    if (dayOfWeek === 6) { daysUntilFriday = 6; daysUntilSaturday = 0; }
    if (dayOfWeek === 0) { daysUntilFriday = 5; daysUntilSaturday = 6; }
    
    const friday = new Date(now); friday.setDate(friday.getDate() + daysUntilFriday);
    const fridayStr = getLisbonDate(friday);
    const saturday = new Date(now); saturday.setDate(saturday.getDate() + daysUntilSaturday);
    const saturdayStr = getLisbonDate(saturday);
    const sunday = new Date(saturday); sunday.setDate(sunday.getDate() + 1);
    const sundayStr = getLisbonDate(sunday);

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
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
