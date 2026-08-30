javascript
import { SignJWT } from "jose";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  const {
    username,
    password
  } = req.body || {};

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
      "LOGIN_USERNAME, LOGIN_PASSWORD ou AUTH_SECRET não configurados."
    );

    return res.status(500).json({
      error:
        "Login não está configurado corretamente na Vercel."
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

  const secretKey = new TextEncoder().encode(
    secret
  );

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
    `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : ""
    }`
  );

  return res.status(200).json({
    success: true
  });
}
