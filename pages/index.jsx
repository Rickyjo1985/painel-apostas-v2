import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';

const TOP_LEAGUES = [
  'PL',
  'PD',
  'BL1',
  'SA',
  'FL1',
  'PPL',
  'CL',
  'EL',
  'ECL'
];

function getLocalDate(dateString) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function addDays(date, days) {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function getWeekendDates() {
  const today = new Date();

  let saturday = null;
  let sunday = null;

  for (let i = 0; i < 10; i++) {
    const date = addDays(today, i);

    if (
      date.getDay() === 6 &&
      !saturday
    ) {
      saturday = getLocalDate(date);
    }

    if (
      date.getDay() === 0 &&
      !sunday
    ) {
      sunday = getLocalDate(date);
    }

    if (saturday && sunday) {
      break;
    }
  }

  return {
    saturday,
    sunday
  };
}

function formatTime(dateString) {
  return new Date(
    dateString
  ).toLocaleTimeString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(dateString) {
  return new Date(
    dateString
  ).toLocaleDateString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit'
  });
}

function normalizeTeamName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(
      /\b(fc|cf|sc|ac|afc|cd|club|football|clube)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchKey(
  homeTeam,
  awayTeam
) {
  return `${normalizeTeamName(
    homeTeam
  )}__${normalizeTeamName(
    awayTeam
  )}`;
}

function findOddsForMatch(
  match,
  odds
) {
  const home = normalizeTeamName(
    match.homeTeam?.name
  );

  const away = normalizeTeamName(
    match.awayTeam?.name
  );

  if (!home || !away) {
    return null;
  }

  const exactKey =
    `${home}__${away}`;

  if (odds[exactKey]) {
    return odds[exactKey];
  }

  const candidates =
    Object.values(odds);

  const matchTime =
    new Date(
      match.utcDate
    ).getTime();

  return (
    candidates.find((item) => {
      const oddsHome =
        normalizeTeamName(
          item.homeTeam
        );

      const oddsAway =
        normalizeTeamName(
          item.awayTeam
        );

      if (!oddsHome || !oddsAway) {
        return false;
      }

      const homeMatch =
        oddsHome === home ||
        oddsHome.includes(home) ||
        home.includes(oddsHome);

      const awayMatch =
        oddsAway === away ||
        oddsAway.includes(away) ||
        away.includes(oddsAway);

      if (!homeMatch || !awayMatch) {
        return false;
      }

      const oddsTime =
        new Date(
          item.commenceTime
        ).getTime();

      if (
        Number.isNaN(matchTime) ||
        Number.isNaN(oddsTime)
      ) {
        return true;
      }

      const difference =
        Math.abs(
          matchTime - oddsTime
        ) / (1000 * 60);

      return difference <= 30;
    }) || null
  );
}

function MatchCard({
  match,
  oddsData,
  index,
  isTopBet
}) {
  const matchOdds =
    findOddsForMatch(
      match,
      oddsData
    );

  const over15 =
    matchOdds?.over15 || null;

  const price =
    over15?.price;

  return (
    <div
      className={`bg-slate-800 border rounded-2xl p-5 relative ${
        isTopBet
          ? 'border-amber-400/40 shadow-lg shadow-amber-400/5'
          : 'border-slate-700'
      }`}
    >
      {isTopBet && (
        <div className="absolute top-0 right-0 bg-amber-400 text-slate-900 text-xs font-extrabold px-3 py-1 rounded-bl-lg rounded-tr-2xl">
          ⭐ APOSTA #{index + 1}
        </div>
      )}

      <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold mb-4 pr-20">
        <i className="fa-solid fa-trophy text-amber-400"></i>

        <span>
          {match.competition?.name ||
            'Competição'}
        </span>

        <span className="text-gray-600">
          •
        </span>

        <span>
          <i className="fa-regular fa-clock mr-1"></i>

          {formatDate(
            match.utcDate
          )}

          {' às '}

          {formatTime(
            match.utcDate
          )}
        </span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="text-center flex-1">
          <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-gray-300">
            {match.homeTeam?.shortName ||
              match.homeTeam?.name
                ?.substring(0, 3)
                .toUpperCase()}
          </div>

          <p className="font-bold text-sm">
            {match.homeTeam?.name}
          </p>
        </div>

        <div className="text-gray-600 font-bold text-xl px-2">
          VS
        </div>

        <div className="text-center flex-1">
          <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-gray-300">
            {match.awayTeam?.shortName ||
              match.awayTeam?.name
                ?.substring(0, 3)
                .toUpperCase()}
          </div>

          <p className="font-bold text-sm">
            {match.awayTeam?.name}
          </p>
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-600">
        <div className="flex items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <div>
            <p className="text-xs text-emerald-400 font-bold">
              MAIS DE 1.5 GOLOS
            </p>

            {over15?.bookmaker && (
              <p className="text-[11px] text-gray-500 mt-1">
                {over15.bookmaker}
              </p>
            )}
          </div>

          {price ? (
            <div className="bg-emerald-500 text-slate-950 font-extrabold text-lg px-4 py-2 rounded-lg">
              @{Number(price).toFixed(2)}
            </div>
          ) : (
            <div className="bg-slate-700 text-gray-400 font-bold text-xs px-3 py-2 rounded-lg text-center">
              Odd indisponível
            </div>
          )}
        </div>

        {over15?.alternatives?.length > 1 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
              Outras odds
            </p>

            <div className="flex flex-wrap gap-2">
              {over15.alternatives
                .slice(1, 4)
                .map(
                  (alternative) => (
                    <span
                      key={`${alternative.bookmakerKey}-${alternative.price}`}
                      className="text-[11px] bg-slate-700 text-gray-400 px-2 py-1 rounded"
                    >
                      {alternative.bookmaker}: @
                      {Number(
                        alternative.price
                      ).toFixed(2)}
                    </span>
                  )
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [matches, setMatches] =
    useState([]);

  const [odds, setOdds] =
    useState({});

  const [currentTab, setCurrentTab] =
    useState('today');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [lastUpdate, setLastUpdate] =
    useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const matchesResponse =
        await fetch('/api/matches', {
          cache: 'no-store'
        });

      if (!matchesResponse.ok) {
        const data =
          await matchesResponse
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            'Erro ao carregar jogos.'
        );
      }

      const matchesData =
        await matchesResponse.json();

      const allMatches =
        Array.isArray(matchesData)
          ? matchesData
          : [];

      const futureMatches =
        allMatches
          .filter(
            (match) =>
              match.status === 'SCHEDULED' ||
              match.status === 'TIMED'
          )
          .sort(
            (a, b) =>
              new Date(a.utcDate) -
              new Date(b.utcDate)
          );

      setMatches(
        futureMatches
      );

      const competitions = [
        ...new Set(
          futureMatches
            .map(
              (match) =>
                match.competition?.code
            )
            .filter((code) =>
              TOP_LEAGUES.includes(code)
            )
        )
      ];

      if (competitions.length > 0) {
        const oddsResponse =
          await fetch(
            `/api/odds?competitions=${encodeURIComponent(
              competitions.join(',')
            )}`,
            {
              cache: 'no-store'
            }
          );

        if (!oddsResponse.ok) {
          const data =
            await oddsResponse
              .json()
              .catch(() => ({}));

          throw new Error(
            data.error ||
              'Erro ao carregar odds.'
          );
        }

        const oddsData =
          await oddsResponse.json();

        setOdds(
          oddsData.odds || {}
        );

        setLastUpdate(
          oddsData.meta?.updatedAt ||
            new Date().toISOString()
        );
      } else {
        setOdds({});
        setLastUpdate(null);
      }
    } catch (err) {
      console.error(
        'Erro:',
        err
      );

      setError(
        err.message ||
          'Erro ao carregar dados.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const interval =
      setInterval(
        loadData,
        5 * 60 * 1000
      );

    return () =>
      clearInterval(interval);
  }, []);

  const groupedMatches =
    useMemo(() => {
      const today =
        new Date();

      const todayStr =
        getLocalDate(today);

      const tomorrowStr =
        getLocalDate(
          addDays(today, 1)
        );

      const {
        saturday,
        sunday
      } =
        getWeekendDates();

      const todayMatches =
        matches.filter(
          (match) =>
            getLocalDate(
              match.utcDate
            ) === todayStr
        );

      const tomorrowMatches =
        matches.filter(
          (match) =>
            getLocalDate(
              match.utcDate
            ) === tomorrowStr
        );

      const weekendMatches =
        matches.filter(
          (match) => {
            const date =
              getLocalDate(
                match.utcDate
              );

            return (
              date === saturday ||
              date === sunday
            );
          }
        );

      const weekendTop =
        weekendMatches
          .filter((match) =>
            TOP_LEAGUES.includes(
              match.competition?.code
            )
          )
          .map((match) => ({
            match,
            oddsData:
              findOddsForMatch(
                match,
                odds
              )
          }))
          .sort(
            (a, b) => {
              const priceA =
                a.oddsData?.over15?.price ||
                0;

              const priceB =
                b.oddsData?.over15?.price ||
                0;

              if (
                priceA > 0 &&
                priceB === 0
              ) {
                return -1;
              }

              if (
                priceA === 0 &&
                priceB > 0
              ) {
                return 1;
              }

              return priceB - priceA;
            }
          )
          .slice(0, 6)
          .map(
            (item) =>
              item.match
          );

      return {
        today: todayMatches,
        tomorrow: tomorrowMatches,
        weekend: weekendMatches,
        bestBets:
          weekendTop.length > 0
            ? weekendTop
            : weekendMatches.slice(0, 6)
      };
    }, [matches, odds]);

  function getCurrentMatches() {
    switch (currentTab) {
      case 'today':
        return groupedMatches.today;

      case 'tomorrow':
        return groupedMatches.tomorrow;

      case 'weekend':
        return groupedMatches.weekend;

      case 'bestBets':
        return groupedMatches.bestBets;

      default:
        return [];
    }
  }

  const currentMatches =
    getCurrentMatches();

  return (
    <>
      <Head>
        <title>
          Painel Apostas Premium
        </title>

        <meta
          name="description"
          content="Painel de jogos e odds de futebol"
        />

        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />

        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div
        className="bg-slate-900 text-gray-100 min-h-screen flex flex-col"
        style={{
          fontFamily:
            'Inter, sans-serif'
        }}
      >
        <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-400 text-slate-900 p-2 rounded-lg">
                <i className="fa-solid fa-crown text-xl"></i>
              </div>

              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  PAINEL{' '}
                  <span className="text-amber-400">
                    PREMIUM
                  </span>
                </h1>

                {lastUpdate && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Odds actualizadas automaticamente
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="text-gray-300 hover:text-white text-sm disabled:opacity-50"
              title="Actualizar jogos e odds"
            >
              <i
                className={`fa-solid fa-rotate-right ${
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              ></i>
            </button>
          </div>
        </header>

        <nav className="bg-slate-800/50 border-b border-slate-700 sticky top-[73px] z-40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-6">
              {[
                ['today', 'Hoje'],
                ['tomorrow', 'Amanhã'],
                ['weekend', 'Fim de Semana'],
                ['bestBets', '⭐ Top 6']
              ].map(
                ([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() =>
                      setCurrentTab(tab)
                    }
                    className={`py-4 px-1 text-sm whitespace-nowrap ${
                      currentTab === tab
                        ? 'border-b-2 border-amber-400 text-amber-400 font-bold'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>
        </nav>

        <main className="flex-grow max-w-3xl mx-auto px-4 py-6 w-full">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400 mb-3"></div>

              <p className="text-gray-400">
                A carregar jogos e odds...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400 bg-slate-800 rounded-2xl border border-red-900 p-6">
              <i className="fa-solid fa-triangle-exclamation text-3xl mb-4"></i>

              <p className="font-bold text-lg mb-2">
                Erro ao carregar dados
              </p>

              <p className="text-sm mb-4">
                {error}
              </p>

              <button
                onClick={loadData}
                className="bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg"
              >
                Tentar novamente
              </button>
            </div>
          ) : currentMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <i className="fa-regular fa-calendar-xmark text-3xl mb-4 text-gray-500"></i>

              <p className="font-bold text-lg mb-2">
                Sem jogos disponíveis
              </p>

              <p className="text-sm">
                Não existem jogos nesta categoria neste momento.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentMatches
                .slice(
                  0,
                  currentTab === 'bestBets'
                    ? 6
                    : 15
                )
                .map(
                  (
                    match,
                    index
                  ) => (
                    <MatchCard
                      key={
                        match.id ||
                        `${match.homeTeam?.name}-${match.awayTeam?.name}-${match.utcDate}`
                      }
                      match={match}
                      oddsData={odds}
                      index={index}
                      isTopBet={
                        currentTab ===
                        'bestBets'
                      }
                    />
                  )
                )}
            </div>
          )}
        </main>

        <footer className="border-t border-slate-800 py-6 mt-8">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-xs text-gray-600">
              Dados de jogos e odds sujeitos à disponibilidade das APIs.
            </p>

            <p className="text-xs text-gray-700 mt-1">
              Odds podem mudar a qualquer momento.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

