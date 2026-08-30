
import { SignJWT } from "jose";

export default async function handler(req, res) {
  res.setHeader(
    "Content-Type",
    "application/json"
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {
    const username =
      String(req.body?.username || "").trim();

    const password =
      String(req.body?.password || "");

    const correctUsername =
      process.env.LOGIN_USERNAME;

    const correctPassword =
      process.env.LOGIN_PASSWORD;

    const secret =
      process.env.AUTH_SECRET;

    if (
      !correctUsername ||
      !correctPassword ||
      !secret
    ) {
      console.error(
        "Variáveis de login em falta."
      );

      return res.status(500).json({
        error:
          "O login não está configurado corretamente na Vercel."
      });
    }

    if (
      username !== correctUsername ||
      password !== correctPassword
    ) {
      return res.status(401).json({
        error:
          "Utilizador ou palavra-passe incorretos."
      });
    }

    const secretKey =
      new TextEncoder().encode(secret);

    const token =
      await new SignJWT({
        username: correctUsername
      })
        .setProtectedHeader({
          alg: "HS256"
        })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);

    res.setHeader(
      "Set-Cookie",
      [
        `auth_token=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=604800",
        "Secure"
      ].join("; ")
    );

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error(
      "Erro em /api/login:",
      error
    );

    return res.status(500).json({
      error:
        "Erro interno ao iniciar sessão."
    });
  }
}
