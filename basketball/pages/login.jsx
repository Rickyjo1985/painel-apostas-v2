import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function BasketballLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar sessão.");
      await router.replace("/");
    } catch (err) {
      setError(err.message || "Erro ao iniciar sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Login | Basketball Premium</title>
        <meta name="description" content="Acesso reservado ao Basketball Premium" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10" style={{ fontFamily: "Inter, sans-serif" }}>
        <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-9 shadow-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-3xl shadow-lg shadow-orange-500/20">🏀</div>
            <p className="text-xs font-extrabold tracking-[0.28em] text-orange-400">NBA • STATISTICS</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">BASKETBALL <span className="text-orange-400">PREMIUM</span></h1>
            <p className="mt-3 text-sm text-slate-400">Prognósticos estatísticos e histórico</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-300">Utilizador</label>
              <input id="username" type="text" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="O teu utilizador" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-orange-400" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-300">Palavra-passe</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="A tua palavra-passe" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-orange-400" />
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-extrabold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "A entrar..." : "Entrar no painel"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-slate-600">Acesso privado • Dados da NBA</p>
        </section>
      </main>
    </>
  );
}