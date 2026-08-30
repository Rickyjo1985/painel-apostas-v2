```js
const ODDS_API_KEY = process.env.ODDS_API_KEY;

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
  TKL: 'soccer_turkey_super_league',
  GSL: 'soccer_greece_super_league'
};

function normalizeTeamName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|afc|club|football|clube)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamsMatch(name1, name2) {
  const a = normalizeTeamName(name1);
  const b = normalizeTeamName(name2);

  if (!a || !b) return false;

  if (a === b) return true;

  if (a.includes(b) || b.includes(a)) {
    return true;
  }

  const wordsA = a.split(' ');
  const wordsB = b.split(' ');

  const commonWords = wordsA.filter(
    (word) =>
      word.length >= 3 &&
      wordsB.includes(word)
  );

  return commonWords.length >= 2;
}

function findOver15(event) {
  const candidates = [];

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== 'totals') {
        continue;
      }

      for (const outcome of market.outcomes || []) {
        const outcomeName = String(
          outcome.name || ''
        ).toLowerCase();

        const point = Number(
          outcome.point
        );

        if (
          outcomeName === 'over' &&
          point === 1.5 &&
          Number.isFinite(
            Number(outcome.price)
          )
        ) {
          candidates.push({
            bookmaker:
              bookmaker.title,
            bookmakerKey:
              bookmaker.key,
            price: Number(
              outcome.price
            ),
            point: point
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (a, b) => b.price - a.price
  );

  return {
    best: candidates[0],
    alternatives:
      candidates.slice(0, 5)
  };
}

async function fetchOdds(sportKey) {
  const params = new URLSearchParams({
    regions: 'eu',
    markets: 'totals',
    oddsFormat: 'decimal',
    dateFormat: 'iso',
    apiKey: ODDS_API_KEY
  });

  const url =
    'https://api.the-odds-api.com/v4/sports/' +
    sportKey +
    '/odds?' +
    params.toString();

  console.log(
    'A consultar The Odds API:',
    sportKey
  );

  const response = await fetch(url);

  const data =
    await response.json().catch(
      () => null
    );

  if (!response.ok) {
    throw new Error(
      `The Odds API ${response.status}: ${
        data?.message ||
        JSON.stringify(data)
      }`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export default async function handler(
  req,
  res
) {
  if (!ODDS_API_KEY) {
    return res.status(500).json({
      error:
        'ODDS_API_KEY não está configurada na Vercel.'
    });
  }

  try {
    let competitions = [];

    if (req.query.competitions) {
      competitions = String(
        req.query.competitions
      )
        .split(',')
        .map((item) =>
          item.trim().toUpperCase()
        )
        .filter(Boolean);
    }

    if (competitions.length === 0) {
      competitions = [
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
        competitions
          .map(
            (competition) =>
              SPORT_KEYS[
                competition
              ]
          )
          .filter(Boolean)
      )
    ];

    if (sportKeys.length === 0) {
      return res.status(200).json({
        odds: {},
        meta: {
          competitions: [],
          eventsFound: 0
        }
      });
    }

    const results =
      await Promise.allSettled(
        sportKeys.map(
          (sportKey) =>
            fetchOdds(sportKey)
        )
      );

    const allEvents = [];

    results.forEach(
      (result, index) => {
        if (
          result.status ===
          'fulfilled'
        ) {
          result.value.forEach(
            (event) => {
              allEvents.push({
                ...event,
                sportKey:
                  sportKeys[index]
              });
            }
          );
        } else {
          console.error(
            'Erro ao consultar',
            sportKeys[index],
            result.reason
          );
        }
      }
    );

    const odds = {};

    for (const event of allEvents) {
      const over15 =
        findOver15(event);

      if (!over15) {
        continue;
      }

      const home =
        normalizeTeamName(
          event.home_team
        );

      const away =
        normalizeTeamName(
          event.away_team
        );

      const key =
        home + '__' + away;

      odds[key] = {
        eventId: event.id,
        sportKey:
          event.sportKey,
        homeTeam:
          event.home_team,
        awayTeam:
          event.away_team,
        commenceTime:
          event.commence_time,
        over15: {
          price:
            over15.best.price,
          point:
            over15.best.point,
          bookmaker:
            over15.best.bookmaker,
          bookmakerKey:
            over15.best
              .bookmakerKey,
          alternatives:
            over15.alternatives
        }
      };
    }

    res.setHeader(
      'Cache-Control',
      's-maxage=120, stale-while-revalidate=300'
    );

    return res.status(200).json({
      odds: odds,
      meta: {
        competitions:
          competitions,
        sportsRequested:
          sportKeys.length,
        eventsFound:
          allEvents.length,
        matchesWithOver15:
          Object.keys(odds)
            .length,
        updatedAt:
          new Date().toISOString()
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
