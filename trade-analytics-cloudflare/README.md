# Analytics Halley

Sistema de análise de operações preparado para Cloudflare Pages.

## Recursos
- múltiplas contas e importação incremental de CSV;
- preserva operações existentes e edições manuais;
- filtros por ativo e período;
- taxa de acerto, Profit Factor, payoff, expectativa e drawdown;
- análises por horário, dia, duração, direção e ativo;
- lote histórico e risco/retorno;
- login protegido no Cloudflare;
- sessão persistente por 30 dias;
- dados da aplicação salvos automaticamente no navegador via localStorage.

## Branch para deploy
Use a branch `analytics-halley`.

## Configuração no Cloudflare Pages
1. Crie um projeto em **Workers & Pages** conectado ao repositório `WanderHalley/trade-halley`.
2. Production branch: `analytics-halley`.
3. Framework preset: **None**.
4. Build command: deixe vazio.
5. Build output directory: `trade-analytics-cloudflare`.
6. Em **Settings → Variables and Secrets**, configure:
   - `LOGIN_USER` = `halley` (variável comum; opcional porque já é o padrão no Worker).
   - `LOGIN_PASSWORD` = senha de acesso, marcada como **Secret**.
   - `SESSION_SECRET` = chave aleatória longa, marcada como **Secret**.
7. Faça um novo deploy.

A senha não fica no HTML nem no GitHub. O `_worker.js` faz a validação no Cloudflare.

## Persistência
A autenticação permanece por até 30 dias no mesmo navegador. As contas, trades, edições e exclusões ficam em `localStorage`; portanto persistem no mesmo navegador/dispositivo, mas não sincronizam automaticamente entre computadores ou celulares.
