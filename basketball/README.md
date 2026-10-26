# Basketball Premium

Aplicação Next.js independente para jogos da NBA, prognósticos estatísticos e histórico de resultados.

## Deploy separado na Vercel

Este projeto vive na pasta \`basketball/\` do repositório \`Rickyjo1985/painel-apostas-v2\`. Não altera as rotas, o login nem as variáveis do painel de futebol.

1. Na Vercel, cria um novo projeto e importa o mesmo repositório GitHub.
2. Em **Root Directory**, escolhe \`basketball\`.
3. Adiciona as variáveis de ambiente abaixo em **Settings → Environment Variables**.
4. Faz Deploy.

Variáveis obrigatórias:
- \`BALLDONTLIE_API_KEY\`: chave de API NBA da BALLDONTLIE.
- \`BASKETBALL_LOGIN_USERNAME\`: utilizador do painel.
- \`BASKETBALL_LOGIN_PASSWORD\`: palavra-passe do painel.
- \`BASKETBALL_AUTH_SECRET\`: segredo aleatório longo usado para assinar a sessão.

Obtém a chave NBA em https://app.balldontlie.io/. O plano gratuito inclui jogos e equipas, mas tem um limite baixo de pedidos por minuto. A aplicação faz cache e limita a paginação para reduzir pedidos. Confirma os limites atuais na documentação: https://docs.balldontlie.io/

## Desenvolvimento local

Copia \`.env.example\` para \`.env.local\`, preenche as quatro variáveis e executa:

\`\`\`bash
npm install
npm run dev
\`\`\`

## Como funcionam os prognósticos

O modelo usa os últimos jogos concluídos de cada equipa para estimar forma recente, pontos marcados e sofridos, margem média e vantagem de jogar em casa. O Score é um indicador interno de força do prognóstico, não uma probabilidade calibrada nem garantia de resultado. Não são apresentadas odds.
