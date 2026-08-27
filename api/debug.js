const ODDS_API_KEY = 'COLOCA_A_TUA_CHAVE_DA_THE_ODDS_API_AQUI';

export default async function handler(req, res) {
  try {
    // Buscar odds da The Odds API
    const oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&bookmakers=betclic,bet365,unibet`,
      { next: { revalidate: 1800 } }
    );

    if (!oddsResponse.ok) {
      return res.status(oddsResponse.status).json({ 
        error: `Erro The Odds API: ${oddsResponse.status}`,
        message: oddsResponse.statusText
      });
    }

    const oddsData = await oddsResponse.json();

    // Mostrar apenas os primeiros 5 jogos com os nomes das equipas
    const sample = oddsData.slice(0, 5).map(event => ({
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      sport_title: event.sport_title,
      bookmakers: event.bookmakers?.map(b => b.title) || []
    }));

    res.status(200).json({
      total_events: oddsData.length,
      sample_events: sample
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
