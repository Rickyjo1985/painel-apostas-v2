import { SignJWT } from "jose";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const correctUsername = process.env.BASKETBALL_LOGIN_USERNAME;
  const correctPassword = process.env.BASKETBALL_LOGIN_PASSWORD;
  const secret = process.env.BASKETBALL_AUTH_SECRET;

  if (!correctUsername || !correctPassword || !secret) {
    return res.status(500).json({
      error: "Configura BASKETBALL_LOGIN_USERNAME, BASKETBALL_LOGIN_PASSWORD e BASKETBALL_AUTH_SECRET na Vercel."
    });
  }

  if (username !== correctUsername || password !== correctPassword) {
    return res.status(401).json({ error: "Utilizador ou palavra-passe incorretos." });
  }

  try {
    const token = await new SignJWT({ username: correctUsername })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(secret));

    const parts = [
      "basketball_auth_token=" + token,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=604800"
    ];

    if (process.env.NODE_ENV === "production") parts.push("Secure");

    res.setHeader("Set-Cookie", parts.join("; "));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro em /api/login:", error);
    return res.status(500).json({ error: "Erro interno ao iniciar sessão." });
  }
}