export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const parts = [
    "basketball_auth_token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (process.env.NODE_ENV === "production") parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
  return res.status(200).json({ success: true });
}