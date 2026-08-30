```js
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Correspondência entre os códigos das competições
// usados pelo football-data.org e os sport keys da The Odds API.
const SPORT_KEYS = {
  PL: 'soccer_epl',
  PD: 'soccer_spain_la_liga',
  BL1: 'soccer_germany_bundesliga',
  SA: 'soccer_italy_serie_a',
  FL1: 'soccer_france_ligue_one',
  PPL: 'soccer_portugal_primeira_liga',
  CL: 'soccer_uefa_champs_league',
  EL: 'soccer_uefa_europa_league',
  ECL: 'soccer_uefa_europa_conference_league',
  DED: 'soccer_netherlands_eredivisie',
  BSA: 'soccer_brazil_campeonato',
  MLS: 'soccer_usa_mls',
  SPL: 'soccer_spl',
  TKL: 'soccer_turkey_super_league',
  GSL: 'soccer_greece_super_league'
};

function normalizeTeamName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|afc|club|football|clube)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamNamesMatch(name1, name2) {
  const a = normalizeTeamName(name1);
  const b = normalizeTeamName(name2);

  if (!a || !b) return false;

  if (a === b) return true;

  if (a.includes(b) || b.includes(a)) return true;

  const wordsA = new Set(a.split(' ').filter(Boolean));
  const wordsB = new Set(b.split(' ').filter(Boolean));

  let common = 0;

  for (const word of wordsA) {
    if (word.length >= 3 && wordsB.has(word)) {
      common++;
    }
  }

  return common >= 2;
}

function sameMatch(footballMatch, oddsMatch) {
  if (!footballMatch || !oddsMatch) return false;

  const homeMatches = teamNamesMatch(
    footballMatch.homeTeam?.name,
    oddsMatch.home_team
  );

  const awayMatches = teamNamesMatch(
    footballMatch.awayTeam?.name,
    oddsMatch.away_team
  );

  if (!homeMatches || !awayMatches) {
    return false;
  }

  // Confirmamos também o horário.
  // Permitimos até 6 horas de diferença para tolerar
  // pequenas diferenças de timezone/horário publicado.
  const footballTime = new Date(
    footballMatch.utcDate
  ).getTime();

  const oddsTime = new Date(
    oddsMatch.commence_time
  ).getTime();

  if (
    Number.isNaN(footballTime) ||
    Number.isNaN(oddsTime)
  ) {
    return true;
  }

  const differenceHours =
    Math.abs(footballTime - oddsTime) /
    (1000 * 60 * 60);

  return differenceHours <= 6;
}

function findOver15(match) {
  const candidates = [];

  for (const bookmaker of match.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== 'totals') continue;

      for (const outcome of market.outcomes || []) {
        const name = String(
          outcome.name || ''
        ).toLowerCase();

        const point = Number(outcome.point);

        const isOver =
          name === 'over' ||
          name.includes('over');

        if (
          isOver &&
          point === 1.5 &&
          Number.isFinite(Number(outcome.price))
        ) {
          candidates.push({
            bookmaker: bookmaker.title,
            bookmakerKey: bookmaker.key,
            price: Number(outcome.price),
            point,
            lastUpdate:
              market.last_update ||
              bookmaker.last_update ||
              null
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Melhor odd = maior preço decimal.
  candidates.sort(
    (a, b) => b.price - a.price
  );

  return {
    ...candidates[0],
    alternatives: candidates.slice(0, 5)
  };
}

async function fetchSportOdds(sportKey) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
    `?regions=eu` +
    `&markets=totals` +
    `&oddsFormat=decimal` +
    `&dateFormat=iso` +
    `&apiKey=${encodeURIComponent(ODDS_API_KEY)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `The Odds API (${sportKey}) respondeu ${response.status}: ${text}`
    );
  }

  return response.json();
}

export default async function handler(req, res) {
  if (!ODDS_API_KEY) {
    return res.status(500).json({
      error:
        'ODDS_API_KEY não está configurada na Vercel.'
    });
  }

  try {
    /*
     * O frontend pode enviar os códigos das competições
     * que realmente estão nos jogos.
     *
     * Exemplo:
     * /api/odds?competitions=PPL,PL,PD
     */

    let requestedCompetitions = [];

    if (req.query.competitions) {
      requestedCompetitions = String(
        req.query.competitions
      )
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
    }

    // Se não forem enviados códigos, usamos as
    // competições principais.
    if (requestedCompetitions.length === 0) {
      requestedCompetitions = [
        'PPL',
        'PL',
        'PD',
        'BL1',
        'SA',
        'FL1',
        'CL',
        'EL',
        'ECL'
      ];
    }

    const sportKeys = [
      ...new Set(
        requestedCompetitions
          .map((code) => SPORT_KEYS[code])
          .filter(Boolean)
      )
    ];

    if (sportKeys.length === 0) {
      return res.status(200).json({
        odds: {},
        meta: {
          sportsRequested: 0,
          eventsFound: 0
        }
      });
    }

    /*
     * Fazemos as chamadas em paralelo.
     *
     * Cada combinação região + mercado custa 1 crédito
     * na The Odds API. Como usamos apenas:
     *
     * regions=eu
     * markets=totals
     *
     * cada competição corresponde a 1 crédito.
     */
    const results = await Promise.allSettled(
      sportKeys.map((sportKey) =>
        fetchSportOdds(sportKey)
      )
    );

    const oddsEvents = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const events = Array.isArray(result.value)
          ? result.value
          : [];

        events.forEach((event) => {
          oddsEvents.push({
            ...event,
            _sportKey: sportKeys[index]
          });
        });
      } else {
        console.error(
          `Erro ao obter ${sportKeys[index]}:`,
          result.reason
        );
      }
    });

    /*
     * A API devolve os eventos agrupados por competição.
     * O frontend recebe-os numa estrutura simples.
     */
    const odds = {};

    oddsEvents.forEach((event) => {
      const over15 = findOver15(event);

      if (!over15) return;

      const key = `${normalizeTeamName(
        event.home_team
      )}__${normalizeTeamName(event.away_team)}`;

      odds[key] = {
        eventId: event.id,
        sportKey: event._sportKey,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: event.commence_time,
        over15: {
          price: over15.price,
          point: over15.point,
          bookmaker: over15.bookmaker,
          bookmakerKey: over15.bookmakerKey,
          lastUpdate: over15.lastUpdate,
          alternatives: over15.alternatives
        }
      };
    });

    /*
     * Cache de 2 minutos no edge/CDN da Vercel.
     * Evita fazer pedidos à API a cada refresh da página.
     */
    res.setHeader(
      'Cache-Control',
      's-maxage=120, stale-while-revalidate=300'
    );

    return res.status(200).json({
      odds,
      meta: {
        sportsRequested: sportKeys.length,
        eventsFound: oddsEvents.length,
        matchesWithOver15: Object.keys(odds).length,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      'Erro em /api/odds:',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'Erro ao obter odds.'
    });
  }
}
```
