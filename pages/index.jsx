import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [matchesData, setMatchesData] = useState(null);
  const [currentTab, setCurrentTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/matches');

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao carregar jogos');
      }

      const allMatches = await response.json();

      // Apenas jogos ainda não terminados
      const futureMatches = allMatches.filter(
        (match) =>
          match.status === 'SCHEDULED' ||
          match.status === 'TIMED'
      );

      // Data local de Portugal/browser
      const getLocalDate = (date) => {
        const d = new Date(date);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
      };

      const today = new Date();

      const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };

      const todayStr = getLocalDate(today);
      const tomorrowStr = getLocalDate(addDays(today, 1));

      // Próximo sábado e domingo
      let saturdayStr = null;
      let sundayStr = null;

      for (let i = 0; i < 10; i++) {
        const date = addDays(today, i);
        const day = date.getDay();
        const dateStr = getLocalDate(date);

        if (day === 6 && !saturdayStr) {
          saturdayStr = dateStr;
        }

        if (day === 0 && !sundayStr) {
          sundayStr = dateStr;
        }

        if (saturdayStr && sundayStr) break;
      }

      const todayMatches = futureMatches
        .filter((match) => getLocalDate(match.utcDate) === todayStr)
        .sort(
          (a, b) =>
            new Date(a.utcDate) - new Date(b.utcDate)
        );

      const tomorrowMatches = futureMatches
        .filter(
          (match) => getLocalDate(match.utcDate) === tomorrowStr
        )
        .sort(
          (a, b) =>
            new Date(a.utcDate) - new Date(b.utcDate)
        );

      const weekendMatches = futureMatches
        .filter((match) => {
          const date = getLocalDate(match.utcDate);

          return (
            date === saturdayStr ||
            date === sundayStr
          );
        })
        .sort(
          (a, b) =>
            new Date(a.utcDate) - new Date(b.utcDate)
        );

      const topLeagues = [
        'PL',
        'PD',
        'BL1',
        'SA',
        'FL1',
        'PPL',
        'CL',
        'EC'
      ];

      const weekendDaysMatches = futureMatches.filter((match) => {
        const date = getLocalDate(match.utcDate);

        return (
          date === saturdayStr ||
          date === sundayStr
        );
      });

      const bestBets = weekendDaysMatches
        .filter((match) =>
          topLeagues.includes(match.competition?.code)
        )
        .sort(
          (a, b) =>
            new Date(a.utcDate) - new Date(b.utcDate)
        )
        .slice(0, 6);

      setMatchesData({
        today: todayMatches,
        tomorrow: tomorrowMatches,
        weekend: weekendMatches,
        bestBets:
          bestBets.length > 0
            ? bestBets
            : weekendDaysMatches.slice(0, 6)
      });
    } catch (error) {
      console.error('Erro:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function displayCurrentTab() {
    if (!matchesData) return null;

    let matches = [];
    let tabTitle = '';

    switch (currentTab) {
      case 'today':
        matches = matchesData.today;
        tabTitle = 'Hoje';
        break;

      case 'tomorrow':
        matches = matchesData.tomorrow;
        tabTitle = 'Amanhã';
        break;

      case 'weekend':
        matches = matchesData.weekend;
        tabTitle = 'Fim de Semana';
        break;

      case 'bestBets':
        matches = matchesData.bestBets;
        tabTitle = 'Top 6';
        break;
    }

    if (matches.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400 bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <p className="font-bold text-lg mb-2">
            Sem jogos para "{tabTitle}"
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {matches
          .slice(
            0,
            currentTab === 'bestBets' ? 6 : 15
          )
          .map((match, index) => {
            const date = new Date(match.utcDate);

            const time = date.toLocaleTimeString(
              'pt-PT',
              {
                hour: '2-digit',
                minute: '2-digit'
              }
            );

            const dateStr = date.toLocaleDateString(
              'pt-PT',
              {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }
            );

            const isGold =
              currentTab === 'bestBets' ||
              index === 0;

            const goldLabel =
              currentTab === 'bestBets'
                ? `⭐ APOSTA #${index + 1}`
                : '⭐ JOGO DE OURO';

            return (
              <div
                key={match.id || index}
                className={`bg-slate-800 border rounded-2xl p-5 relative ${
                  isGold
                    ? 'border-amber-400/30'
                    : 'border-slate-700'
                }`}
              >
                {isGold && (
                  <div className="absolute top-0 right-0 bg-amber-400 text-slate-900 text-xs font-extrabold px-3 py-1 rounded-bl-lg rounded-tr-2xl">
                    {goldLabel}
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold mb-4">
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
                    {dateStr} às {time}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
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
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-400 font-bold">
                      Mais de 1.5 Golos
                    </p>

                    <div className="bg-slate-700 text-gray-300 font-bold text-sm px-3 py-2 rounded-lg">
                      Odd indisponível
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Painel Apostas Premium</title>

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
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-400 text-slate-900 p-2 rounded-lg">
                <i className="fa-solid fa-crown text-xl"></i>
              </div>

              <h1 className="text-xl font-extrabold tracking-tight text-white">
                PAINEL{' '}
                <span className="text-amber-400">
                  PREMIUM
                </span>
              </h1>
            </div>

            <button
              onClick={loadMatches}
              className="text-gray-300 hover:text-white text-sm"
              title="Actualizar jogos"
            >
              <i className="fa-solid fa-rotate-right"></i>
            </button>
          </div>
        </header>

        <nav className="bg-slate-800/50 border-b border-slate-700 sticky top-[73px] z-40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-6">
              {[
                'today',
                'tomorrow',
                'weekend',
                'bestBets'
              ].map((tab) => (
                <button
                  key={tab}
                  onClick={() =>
                    setCurrentTab(tab)
                  }
                  className={`py-4 px-1 text-sm whitespace-nowrap ${
                    currentTab === tab
                      ? 'border-b-2 border-amber-400 text-amber-400 font-bold'
                      : 'text-gray-400'
                  }`}
                >
                  {tab === 'today'
                    ? 'Hoje'
                    : tab === 'tomorrow'
                    ? 'Amanhã'
                    : tab === 'weekend'
                    ? 'Fim de Semana'
                    : '⭐ Top 6'}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main className="flex-grow max-w-3xl mx-auto px-4 py-6 w-full">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400 mb-3"></div>

              <p className="text-gray-400">
                A carregar jogos...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400 bg-slate-800 rounded-2xl border border-red-900 p-6">
              <p className="font-bold text-lg mb-2">
                Erro ao carregar jogos
              </p>

              <p className="text-sm mb-4">
                {error}
              </p>

              <button
                onClick={loadMatches}
                className="bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            displayCurrentTab()
          )}
        </main>
      </div>
    </>
  );
}
