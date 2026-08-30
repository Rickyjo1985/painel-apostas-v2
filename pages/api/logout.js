javascript
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  res.setHeader(
    "Set-Cookie",
    "auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );

  return res.status(200).json({
    success: true
  });
}
