import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [allMatchesData, setAllMatchesData] = useState(null);
  const [currentTab, setCurrentTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('A carregar...');

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      const response = await fetch('/api/matches');
      if (!response.ok) throw new Error('Erro ao carregar');
      
      const data = await response.json();
      
      // Processar dados no frontend
      const processed = processData(data);
      setAllMatchesData(processed);
      
      const total = processed.today.length + processed.tomorrow.length + processed.weekend.length;
      setStatusText(`${total} jogos carregados`);
      setLoading(false);
    } catch (error) {
      console.error('Erro:', error);
      setStatusText('Erro ao carregar');
      setLoading(false);
    }
  }

  function processData(data) {
    const today = data.today;
    const allMatches = data.allMatches;
    
    // Calcular datas em Lisboa no frontend
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now);
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(tomorrow);
    
    // Encontrar sexta, sábado e domingo
    let fridayStr = null, saturdayStr = null, sundayStr = null;
    for (let i = 0; i < 10; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(d);
      
      if (dayOfWeek === 5 && !fridayStr) fridayStr = dateStr;
      if (dayOfWeek === 6 && !saturdayStr) saturdayStr = dateStr;
      if (dayOfWeek === 0 && !sundayStr) sundayStr = dateStr;
      
      if (fridayStr && saturdayStr && sundayStr) break;
    }
    
    // Filtrar jogos por categoria
    const todayMatches = allMatches.filter(m => m.lisbonDate === todayStr);
    const tomorrowMatches = allMatches.filter(m => m.lisbonDate === tomorrowStr);
    const weekendMatches = allMatches.filter(m => m.lisbonDate === saturdayStr || m.lisbonDate === sundayStr);
    
    const topLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'CL', 'EC'];
    const weekendDaysMatches = allMatches.filter(m => 
      m.lisbonDate === fridayStr || m.lisbonDate === saturdayStr || m.lisbonDate === sundayStr
    );
    
    const bestBets = weekendDaysMatches
      .filter(m => topLeagues.includes(m.competition.code))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
      .slice(0, 6);
    
    return {
      today: todayMatches,
      tomorrow: tomorrowMatches,
      weekend: weekendMatches,
      bestBets: bestBets.length > 0 ? bestBets : weekendDaysMatches.slice(0, 6)
    };
  }

  function switchTab(tabName) {
    setCurrentTab(tabName);
  }

  function displayCurrentTab() {
    if (!allMatchesData) return null;
    let matches = [];
    let tabTitle = '';

    switch(currentTab) {
      case 'today': matches = allMatchesData.today || []; tabTitle = 'Hoje'; break;
      case 'tomorrow': matches = allMatchesData.tomorrow || []; tabTitle = 'Amanhã'; break;
      case 'weekend': matches = allMatchesData.weekend || []; tabTitle = 'Fim de Semana'; break;
      case 'bestBets': matches = allMatchesData.bestBets || []; tabTitle = 'Top 6'; break;
    }

    if (matches.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400 bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <i className="fa-solid fa-circle-info text-4xl mb-3 text-amber-400"></i>
          <p className="font-bold text-lg mb-2">Sem jogos para "{tabTitle}"</p>
          <p className="text-sm text-gray-500">Não há jogos agendados para esta categoria.</p>
        </div>
      );
    }

    return displayMatches(matches, currentTab === 'bestBets');
  }

  function displayMatches(matches, isBestBets = false) {
    const matchesToShow = isBestBets ? matches.slice(0, 6) : matches.slice(0, 15);

    return (
      <div className="space-y-6">
        {matchesToShow.map((match, index) => {
          const date = new Date(match.utcDate);
          const time = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
          const dateStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Lisbon' });
          const isGold = isBestBets || index === 0;
          const goldLabel = isBestBets ? `⭐ APOSTA #${index + 1}` : '⭐ JOGO DE OURO';

          const odds = match.odds;
          const homeOdd = odds?.homeWin ? odds.homeWin.toFixed(2) : '-';
          const drawOdd = odds?.draw ? odds.draw.toFixed(2) : '-';
          const awayOdd = odds?.awayWin ? odds.awayWin.toFixed(2) : '-';
          const over25Odd = odds?.over25 ? odds.over25.toFixed(2) : '-';
          const bookmakerName = odds?.bookmaker || 'Betclic';
          const hasOdds = odds && odds.homeWin;

          return (
            <div key={match.id || index} className={`bg-slate-800 border rounded-2xl p-5 relative ${isGold ? 'border-amber-400/30' : 'border-slate-700'}`}>
              {isGold && (
                <div className="absolute top-0 right-0 bg-amber-400 text-slate-900 text-xs font-extrabold px-3 py-1 rounded-bl-lg rounded-tr-2xl">
                  {goldLabel}
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold mb-4">
                <i className="fa-solid fa-trophy text-amber-400"></i>
                <span>{match.competition.name}</span>
                <span className="text-gray-600">•</span>
                <span><i className="fa-regular fa-clock mr-1"></i>{dateStr} às {time}</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-gray-300">
                    {match.homeTeam.shortName || match.homeTeam.name.substring(0, 3).toUpperCase()}
                  </div>
                  <p className="font-bold text-sm">{match.homeTeam.name}</p>
                </div>
                <div className="text-gray-600 font-bold text-xl px-2">VS</div>
                <div className="text-center flex-1">
                  <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-gray-300">
                    {match.awayTeam.shortName || match.awayTeam.name.substring(0, 3).toUpperCase()}
                  </div>
                  <p className="font-bold text-sm">{match.awayTeam.name}</p>
                </div>
              </div>

              {hasOdds ? (
                <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                      <i className="fa-solid fa-chart-bar mr-1"></i> Odds Reais
                    </p>
                    <span className="text-xs text-gray-500 bg-slate-700 px-2 py-0.5 rounded-full">{bookmakerName}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-700 rounded-lg p-2 text-center border border-slate-600">
                      <p className="text-[10px] text-gray-400 uppercase">Casa</p>
                      <p className="text-emerald-400 font-extrabold text-lg">{homeOdd}</p>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-2 text-center border border-slate-600">
                      <p className="text-[10px] text-gray-400 uppercase">Empate</p>
                      <p className="text-emerald-400 font-extrabold text-lg">{drawOdd}</p>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-2 text-center border border-slate-600">
                      <p className="text-[10px] text-gray-400 uppercase">Fora</p>
                      <p className="text-emerald-400 font-extrabold text-lg">{awayOdd}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-400 font-bold">Mais de 2.5 Golos</p>
                    <div className="bg-emerald-500 text-slate-900 font-extrabold text-lg px-4 py-1.5 rounded-lg">
                      {over25Odd}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-600">
                  <p className="text-xs text-amber-400 font-bold uppercase mb-3">
                    <i className="fa-solid fa-chart-bar mr-1"></i> Sugestão
                  </p>
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-400 font-bold">Mais de 1.5 Golos</p>
                    <div className="bg-emerald-500 text-slate-900 font-extrabold text-lg px-4 py-1.5 rounded-lg">
                      @1.45
                    </div>
                  </div>
                </div>
              )}
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div className="bg-slate-900 text-gray-100 min-h-screen flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
        <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-400 text-slate-900 p-2 rounded-lg">
                <i className="fa-solid fa-crown text-xl"></i>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  PAINEL <span className="text-amber-400">PREMIUM</span>
                </h1>
                <p className="text-xs text-gray-400">{statusText}</p>
              </div>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20 flex items-center">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Ao Vivo
            </div>
          </div>
        </header>

        <nav className="bg-slate-800/50 border-b border-slate-700 sticky top-[73px] z-40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-6">
              {['today', 'tomorrow', 'weekend', 'bestBets'].map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`py-4 px-1 text-sm whitespace-nowrap transition-colors ${
                    currentTab === tab 
                      ? 'border-b-2 border-amber-400 text-amber-400 font-bold' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab === 'today' && 'Hoje'}
                  {tab === 'tomorrow' && 'Amanhã'}
                  {tab === 'weekend' && 'Fim de Semana'}
                  {tab === 'bestBets' && '⭐ Top 6'}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main className="flex-grow max-w-3xl mx-auto px-4 py-6 w-full">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400 mb-3"></div>
              <p className="text-gray-400">A carregar jogos reais...</p>
            </div>
          ) : (
            displayCurrentTab()
          )}
        </main>

        <footer className="bg-slate-800 border-t border-slate-700 mt-8 py-6">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-gray-500 text-xs">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              Jogue com responsabilidade. Proibido para menores de 18 anos.
            </p>
            <p className="text-gray-600 text-xs mt-2">© 2026 Painel Apostas Premium.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
