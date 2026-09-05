
import { useState, useEffect, useMemo } from "react";
import Head from "next/head";

const TOP_LEAGUES = [
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "PPL",
  "ELC",
  "CL",
  "EL",
  "ECL"
];

function getLocalDate(dateString) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(date);
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
    const date = addDays(
      today,
      i
    );

    if (
      date.getDay() === 6 &&
      !saturday
    ) {
      saturday =
        getLocalDate(date);
    }

    if (
      date.getDay() === 0 &&
      !sunday
    ) {
      sunday =
        getLocalDate(date);
    }

    if (
      saturday &&
      sunday
    ) {
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
  ).toLocaleTimeString(
    "pt-PT",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "Europe/Lisbon"
    }
  );
}

function formatDate(dateString) {
  return new Date(
    dateString
  ).toLocaleDateString(
    "pt-PT",
    {
      day: "2-digit",
      month: "2-digit",
      timeZone:
        "Europe/Lisbon"
    }
  );
}

function PredictionBadge({
  prediction
}) {
  if (!prediction) {
    return (
      <div className="mt-4 bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-500">
          PROGNÓSTICO
        </p>

        <p className="text-sm text-gray-600 mt-1">
          A calcular...
        </p>
      </div>
    );
  }

  if (
    prediction.score === 0
  ) {
    return (
      <div className="mt-4 bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500">
              PROGNÓSTICO
            </p>

            <p className="text-sm text-gray-400 mt-1">
              Dados insuficientes
            </p>
          </div>

          <span className="text-[10px] font-bold text-gray-500 bg-slate-700 px-2 py-1 rounded">
            SEM SCORE
          </span>
        </div>
      </div>
    );
  }

  let scoreLabel =
    "CONFIANÇA BAIXA";

  if (
    prediction.score >= 80
  ) {
    scoreLabel =
      "CONFIANÇA MUITO ALTA";
  } else if (
    prediction.score >= 72
  ) {
    scoreLabel =
      "CONFIANÇA ALTA";
  } else if (
    prediction.score >= 64
  ) {
    scoreLabel =
      "CONFIANÇA MÉDIA";
  }

  return (
    <div className="mt-4 bg-slate-900 border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-emerald-400 font-extrabold">
            🎯 PROGNÓSTICO
          </p>

          <p className="text-lg font-extrabold text-white mt-1">
            {prediction.market}
          </p>

          <p className="text-[11px] text-gray-500 mt-1">
            {prediction.level}
          </p>
        </div>

        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-lg font-extrabold text-emerald-400">
              {prediction.score}
            </span>
          </div>

          <p className="text-[9px] uppercase text-gray-600 mt-1">
            Score
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>
            {scoreLabel}
          </span>

          <span>
            {prediction.score}/100
          </span>
        </div>

        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{
              width: `${prediction.score}%`
            }}
          />
        </div>
      </div>

      {prediction.reasons?.length > 0 && (
        <div className="mt-4 space-y-1">
          {prediction.reasons
            .slice(0, 3)
            .map(
              (
                reason,
                reasonIndex
              ) => (
                <p
                  key={
                    reasonIndex
                  }
                  className="text-[11px] text-gray-500"
                >
                  • {reason}
                </p>
              )
            )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  prediction,
  index,
  isTopBet
}) {
  return (
    <div
      className={`bg-slate-800 border rounded-2xl p-5 relative ${
        isTopBet
          ? "border-amber-400/40 shadow-lg shadow-amber-400/5"
          : "border-slate-700"
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
            "Competição"}
        </span>

        <span className="text-gray-600">
          •
        </span>

        <span>
          <i className="fa-regular fa-clock mr-1"></i>

          {formatDate(
            match.utcDate
          )}

          {" às "}

          {formatTime(
            match.utcDate
          )}
        </span>
      </div>

      <div className="flex items-center justify-between">
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

      <PredictionBadge
        prediction={prediction}
      />
    </div>
  );
}

export default function Home() {
  const [matches, setMatches] =
    useState([]);

  const [predictions, setPredictions] =
    useState({});

  const [currentTab, setCurrentTab] =
    useState("today");

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
        await fetch(
          "/api/matches",
          {
            cache:
              "no-store"
          }
        );

      if (
        !matchesResponse.ok
      ) {
        const data =
          await matchesResponse
            .json()
            .catch(
              () => ({})
            );

        throw new Error(
          data.error ||
            "Erro ao carregar jogos."
        );
      }

      const matchesData =
        await matchesResponse.json();

      const allMatches =
        Array.isArray(
          matchesData
        )
          ? matchesData
          : Array.isArray(
                matchesData.matches
              )
            ? matchesData.matches
            : [];

      const futureMatches =
        allMatches
          .filter(
            (match) =>
              match.status ===
                "SCHEDULED" ||
              match.status ===
                "TIMED"
          )
          .filter(
            (match) =>
              match.utcDate
          )
          .sort(
            (a, b) =>
              new Date(
                a.utcDate
              ) -
              new Date(
                b.utcDate
              )
          );

      setMatches(
        futureMatches
      );

      /*
       * Descobrimos apenas as competições
       * que existem realmente nos jogos.
       */
      const competitions = [
        ...new Set(
          futureMatches
            .map(
              (match) =>
                match.competition
                  ?.code
            )
            .filter((code) =>
              TOP_LEAGUES.includes(
                code
              )
            )
        )
      ];

      /*
       * Pedimos os prognósticos.
       *
       * Enviamos os jogos no body para
       * o endpoint calcular as estatísticas
       * desses jogos.
       */
      if (
        competitions.length > 0 &&
        futureMatches.length > 0
      ) {
        const predictionsResponse =
          await fetch(
            `/api/predictions?competitions=${encodeURIComponent(
              competitions.join(",")
            )}`,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                matches:
                  futureMatches
              })
            }
          );

        if (
          !predictionsResponse.ok
        ) {
          const data =
            await predictionsResponse
              .json()
              .catch(
                () => ({})
              );

          throw new Error(
            data.error ||
              "Erro ao calcular prognósticos."
          );
        }

        const predictionData =
          await predictionsResponse.json();

        setPredictions(
          predictionData.predictions ||
            {}
        );

        setLastUpdate(
          predictionData.meta
            ?.updatedAt ||
            new Date().toISOString()
        );
      } else {
        setPredictions({});
        setLastUpdate(null);
      }
    } catch (err) {
      console.error(
        "Erro:",
        err
      );

      setError(
        err.message ||
          "Erro ao carregar dados."
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
      clearInterval(
        interval
      );
  }, []);

  const groupedMatches =
    useMemo(() => {
      const today =
        new Date();

      const todayStr =
        getLocalDate(
          today
        );

      const tomorrowStr =
        getLocalDate(
          addDays(
            today,
            1
          )
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
            ) ===
            todayStr
        );

      const tomorrowMatches =
        matches.filter(
          (match) =>
            getLocalDate(
              match.utcDate
            ) ===
            tomorrowStr
        );

      const weekendMatches =
        matches.filter(
          (match) => {
            const date =
              getLocalDate(
                match.utcDate
              );

            return (
              date ===
                saturday ||
              date ===
                sunday
            );
          }
        );

      /*
       * TOP 6
       *
       * Agora é baseado no SCORE
       * do algoritmo e não em odds.
       */
      const topCandidates =
        matches
          .filter((match) =>
            TOP_LEAGUES.includes(
              match.competition?.code
            )
          )
          .map((match) => ({
            match,
            prediction:
              predictions[
                String(
                  match.id
                )
              ]
          }))
          .filter(
            (item) =>
              item.prediction &&
              Number(
                item.prediction
                  .score
              ) > 0
          )
          .sort(
            (a, b) => {
              const scoreA =
                Number(
                  a.prediction
                    ?.score || 0
                );

              const scoreB =
                Number(
                  b.prediction
                    ?.score || 0
                );

              if (
                scoreA !==
                scoreB
              ) {
                return (
                  scoreB -
                  scoreA
                );
              }

              return (
                new Date(
                  a.match
                    .utcDate
                ) -
                new Date(
                  b.match
                    .utcDate
                )
              );
            }
          )
          .slice(0, 6)
          .map(
            (item) =>
              item.match
          );

      return {
        today:
          todayMatches,

        tomorrow:
          tomorrowMatches,

        weekend:
          weekendMatches,

        bestBets:
          topCandidates
      };
    }, [
      matches,
      predictions
    ]);

  function getCurrentMatches() {
    switch (
      currentTab
    ) {
      case "today":
        return groupedMatches.today;

      case "tomorrow":
        return groupedMatches.tomorrow;

      case "weekend":
        return groupedMatches.weekend;

      case "bestBets":
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
          Painel Prognósticos Premium
        </title>

        <meta
          name="description"
          content="Painel de jogos e prognósticos de futebol"
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
            "Inter, sans-serif"
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
                  PAINEL{" "}
                  <span className="text-amber-400">
                    PREMIUM
                  </span>
                </h1>

                {lastUpdate && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Prognósticos actualizados automaticamente
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={
                  loadData
                }
                disabled={
                  loading
                }
                className="text-gray-300 hover:text-white text-sm disabled:opacity-50"
                title="Actualizar jogos e prognósticos"
              >
                <i
                  className={`fa-solid fa-rotate-right ${
                    loading
                      ? "animate-spin"
                      : ""
                  }`}
                ></i>
              </button>

              <button
                onClick={async () => {
                  try {
                    await fetch(
                      "/api/logout",
                      {
                        method:
                          "POST"
                      }
                    );
                  } catch (
                    error
                  ) {
                    console.error(
                      "Erro ao terminar sessão:",
                      error
                    );
                  }

                  window.location.href =
                    "/login";
                }}
                className="text-gray-400 hover:text-red-400 text-sm"
                title="Terminar sessão"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </header>

        <nav className="bg-slate-800/50 border-b border-slate-700 sticky top-[73px] z-40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-6">
              {[
                [
                  "today",
                  "Hoje"
                ],
                [
                  "tomorrow",
                  "Amanhã"
                ],
                [
                  "weekend",
                  "Fim de Semana"
                ],
                [
                  "bestBets",
                  "⭐ Top 6"
                ]
              ].map(
                ([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() =>
                      setCurrentTab(
                        tab
                      )
                    }
                    className={`py-4 px-1 text-sm whitespace-nowrap ${
                      currentTab ===
                      tab
                        ? "border-b-2 border-amber-400 text-amber-400 font-bold"
                        : "text-gray-400 hover:text-gray-200"
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
                A calcular prognósticos...
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
                onClick={
                  loadData
                }
                className="bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg"
              >
                Tentar novamente
              </button>
            </div>
          ) : currentMatches.length ===
            0 ? (
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
                  currentTab ===
                    "bestBets"
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
                      prediction={
                        predictions[
                          String(
                            match.id
                          )
                        ]
                      }
                      index={index}
                      isTopBet={
                        currentTab ===
                        "bestBets"
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
              Prognósticos calculados automaticamente a partir de dados estatísticos.
            </p>

            <p className="text-xs text-gray-700 mt-1">
              O score é um indicador interno de confiança e não garante o resultado.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
