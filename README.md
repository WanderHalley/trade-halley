# Trade Halley

Plataforma profissional de back-tests e análise de mercado para B3 e BMF.

## Tecnologias

**Frontend:** HTML5, CSS3, JavaScript (Vanilla), Chart.js  
**Backend:** Python, FastAPI, yfinance, pandas, ta-lib  
**Deploy:** GitHub Pages + Cloudflare (frontend) | Hugging Face Spaces (backend)

## Funcionalidades

- Dashboard com visão geral do mercado
- Back-tests B3 Daily (ações - timeframe diário)
- Back-tests B3 Intraday (ações - timeframe 1h)
- Back-tests BMF Intraday (derivativos - timeframe 1h)
- 13 estratégias de trading implementadas
- Dados reais via Yahoo Finance
- Métricas profissionais: Sharpe, Sortino, Profit Factor, Drawdown, Win Rate
- Curva de equity, distribuição de trades, ranking de performance
- Design dark + verde, ultra responsivo

## Setup

1. Altere a URL da API em `js/api.js` para apontar para seu Hugging Face Space
2. Faça deploy do frontend no GitHub Pages
3. Configure Cloudflare como DNS/CDN

## Autor

Trade Halley © 2026
