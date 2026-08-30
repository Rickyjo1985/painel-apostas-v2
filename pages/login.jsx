import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro ao iniciar sessão."
        );
      }

      await router.replace("/");
    } catch (err) {
      setError(
        err.message ||
          "Erro ao iniciar sessão."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>
          Login - Painel Apostas Premium
        </title>

        <meta
          name="description"
          content="Acesso ao Painel Apostas Premium"
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
        className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center px-4"
        style={{
          fontFamily:
            "Inter, sans-serif"
        }}
      >
        <div className="w-full max-w-md">

          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8">

            <div className="text-center mb-8">

              <div className="inline-flex items-center justify-center bg-amber-400 text-slate-900 w-16 h-16 rounded-2xl mb-4">
                <i className="fa-solid fa-crown text-2xl"></i>
              </div>

              <h1 className="text-2xl font-extrabold text-white">
                PAINEL{" "}
                <span className="text-amber-400">
                  PREMIUM
                </span>
              </h1>

              <p className="text-gray-400 text-sm mt-2">
                Acesso reservado
              </p>

            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              <div>

                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-gray-300 mb-2"
                >
                  Utilizador
                </label>

                <div className="relative">

                  <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value
                      )
                    }
                    autoComplete="username"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-amber-400"
                    placeholder="Utilizador"
                  />

                </div>

              </div>

              <div>

                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-300 mb-2"
                >
                  Palavra-passe
                </label>

                <div className="relative">

                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-amber-400"
                    placeholder="Palavra-passe"
                  />

                </div>

              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm">

                  <i className="fa-solid fa-triangle-exclamation mr-2"></i>

                  {error}

                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-extrabold py-3 rounded-xl transition"
              >

                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                    A entrar...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket mr-2"></i>
                    Entrar
                  </>
                )}

              </button>

            </form>

            <p className="text-center text-xs text-gray-600 mt-8">
              Acesso protegido
            </p>

          </div>

        </div>
      </div>
    </>
  );
}
