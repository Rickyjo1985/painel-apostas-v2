// ⚠️ COLOCA A TUA CHAVE DA THE ODDS API AQUI
const ODDS_API_KEY = '58f5c88bdf6fb881991f31be71992249';
const FOOTBALL_API_KEY = '56031cfaefbb448f836803d7b7d01c4b';

// Cache simples para poupar pedidos (guarda os dados por 30 minutos)
let cache = { data: null, timestamp: 0 };
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

export default async function handler(req, res) {
  try {
    // Verificar se temos dados em cache
    if (cache.data && (Date.now() - cache.timestamp) < CACHE_DURATION) {
      return res.status(200).json(cache.data);
    }

    // Função para obter a data no fuso horário de Lisboa
    function getLisbonDate(date = new Date()) {
      const lisbonTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
      return lisbonTime.toISOString().split('T')[0];
    }

    function addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }

    function getMatchLisbonDate(utcDate) {
      return getLisbonDate(new Date(utcDate));
    }

    const now = new Date();
    const today = getLisbonDate(now);
    const tomorrow = getLisbonDate(addDays(now, 1));

    const dayOfWeek = now.getDay();
    let daysUntilFriday, daysUntilSaturday, daysUntilSunday;

    if (dayOfWeek === 5) {
      daysUntilFriday = 0; daysUntilSaturday = 1; daysUntilSunday = 2;
    } else if (dayOfWeek === 6) {
      daysUntilFriday = 6; daysUntilSaturday = 0; daysUntilSunday = 1;
    } else if (dayOfWeek === 0) {
      daysUntilFriday = 5; daysUntilSaturday = 6; daysUntilSunday = 0;
    } else {
      daysUntilFriday = 5 - dayOfWeek; daysUntilSaturday = 6 - dayOfWeek; daysUntilSunday = 7 - dayOfWeek;
    }

    const friday = getLisbonDate(addDays(now, daysUntilFriday));
    const saturday = getLisbonDate(addDays(now, daysUntilSaturday));
    const sunday = getLisbonDate(addDays(now, daysUntilSunday));
    const dateTo = getLisbonDate(addDays(now, 10));

    // 1. Buscar jogos da Football-Data.org
    const matchesResponse = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${dateTo}`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });

    if (!matchesResponse.ok) {
      return res.status(matchesResponse.status).json({ error: `Erro Football API: ${matchesResponse.status}` });
    }

    const matchesData = await matchesResponse.json();
    const allMatches = matchesData.matches.filter(m =>
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    );

    // 2. Buscar odds reais da The Odds API (Betclic e outras)
    let oddsMap = {};
    try {
      const oddsResponse = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&bookmakers=betclic,bet365,unibet&dateFormat=iso`,
        { next: { revalidate: 1800 } }
      );

      if (oddsResponse.ok) {
        const oddsData = await oddsResponse.json();

        // Criar mapa de odds por equipa (para fazer match com os jogos)
        oddsData.forEach(event => {
          const homeTeam = event.home_team.toLowerCase();
          const awayTeam = event.away_team.toLowerCase();
          const key = `${homeTeam}|${awayTeam}`;

          const oddsInfo = {
            homeWin: null,
            draw: null,
            awayWin: null,
            over25: null,
            bookmaker: null
          };

          // Procurar odds da Betclic primeiro, depois outras
          const preferredBookmakers = ['betclic', 'bet365', 'unibet'];

          for (const bookmakerName of preferredBookmakers) {
            const bookmaker = event.bookmakers?.find(b => b.key === bookmakerName);
            if (bookmaker) {
              oddsInfo.bookmaker = bookmaker.title;

              // Odds 1X2 (resultado final)
              const h2h = bookmaker.markets?.find(m => m.key === 'h2h');
              if (h2h) {
                const home = h2h.outcomes?.find(o => o.name === event.home_team);
                const drawOutcome = h2h.outcomes?.find(o => o.name === 'Draw');
                const away = h2h.outcomes?.find(o => o.name === event.away_team);

                if (home) oddsInfo.homeWin = home.price;
                if (drawOutcome) oddsInfo.draw = drawOutcome.price;
                if (away) oddsInfo.awayWin = away.price;
              }

              // Odds Over/Under 2.5
              const totals = bookmaker.markets?.find(m => m.key === 'totals');
              if (totals) {
                const over = totals.outcomes?.find(o => o.name === 'Over' && o.point === 2.5);
                if (over) oddsInfo.over25 = over.price;
              }

              break; // Usar o primeiro bookmaker encontrado
            }
          }

          oddsMap[key] = oddsInfo;
        });
      }
    } catch (oddsError) {
      console.error('Erro ao buscar odds:', oddsError);
      // Continua sem odds se falhar
    }

    // 3. Função para encontrar odds de um jogo
    function findOdds(match) {
      const home = match.homeTeam.name.toLowerCase();
      const away = match.awayTeam.name.toLowerCase();

      // Tentar match exato
      const exactKey = `${home}|${away}`;
      if (oddsMap[exactKey]) return oddsMap[exactKey];

      // Tentar match parcial (nomes curtos)
      for (const [key, odds] of Object.entries(oddsMap)) {
        const [oddsHome, oddsAway] = key.split('|');
        if (
          (home.includes(oddsHome) || oddsHome.includes(home)) &&
          (away.includes(oddsAway) || oddsAway.includes(away))
        ) {
          return odds;
        }
      }

      return null;
    }

    // 4. Adicionar odds a cada jogo
    const matchesWithOdds = allMatches.map(match => ({
      ...match,
      odds: findOdds(match)
    }));

    // 5. Organizar por categorias
    const todayMatches = matchesWithOdds.filter(m => getMatchLisbonDate(m.utcDate) === today);
    const tomorrowMatches = matchesWithOdds.filter(m => getMatchLisbonDate(m.utcDate) === tomorrow);

    const weekendMatches = matchesWithOdds.filter(m => {
      const matchDate = getMatchLisbonDate(m.utcDate);
      return matchDate === saturday || matchDate === sunday;
    });

    const topLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'CL', 'EC'];
    const weekendDaysMatches = matchesWithOdds.filter(m => {
      const matchDate = getMatchLisbonDate(m.utcDate);
      return matchDate === friday || matchDate === saturday || matchDate === sunday;
    });

    const bestBets = weekendDaysMatches
      .filter(m => m.odds !== null) // Priorizar jogos que têm odds
      .sort((a, b) => {
        const aIsTop = topLeagues.includes(a.competition.code) ? 0 : 1;
        const bIsTop = topLeagues.includes(b.competition.code) ? 0 : 1;
        if (aIsTop !== bIsTop) return aIsTop - bIsTop;
        return new Date(a.utcDate) - new Date(b.utcDate);
      })
      .slice(0, 6);

    const result = {
      today: todayMatches,
      tomorrow: tomorrowMatches,
      weekend: weekendMatches,
      bestBets: bestBets
    };

    // Guardar em cache
    cache = { data: result, timestamp: Date.now() };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
