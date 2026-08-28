export default async function handler(req, res) {
  // Permite que o teu site aceda a esta função
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ⚠️ SUBSTITUI PELA TUA CHAVE REAL DA THE ODDS API
  const API_KEY = '58f5c88bdf6fb881991f31be71992249'; 
  
  try {
    const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h,totals&bookmakers=betclic,bet365,unibet`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
