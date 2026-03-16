/**
 * Trade Halley - API Client
 * Comunicação com o backend FastAPI
 */

const API = (() => {
  // ==============================================
  // URL DO SEU HUGGING FACE SPACE
  // ==============================================
  const BASE_URL = 'https://wanderhalleylee-trade-halley.hf.space';

  async function request(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.append(key, value);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Erro ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  return {
    // Status
    health: () => request('/health'),

    // Ativos
    getAssets: (market = 'all') => request('/assets', { market }),
    getAssetInfo: (ticker) => request(`/asset/${ticker}`),

    // Dados de Mercado
    getMarketData: (ticker, period = '6mo', interval = '1d') =>
      request(`/market-data/${ticker}`, { period, interval }),

    // Estratégias
    getStrategies: () => request('/strategies'),

    // Back-test individual
    runBacktest: (ticker, strategy, options = {}) =>
      request('/backtest', {
        ticker,
        strategy,
        period: options.period || '1y',
        interval: options.interval || '1d',
        capital: options.capital || 10000,
        stop_loss: options.stopLoss || null,
        take_profit: options.takeProfit || null,
      }),

    // Back-test em massa
    runBulkBacktest: (market, strategy, options = {}) =>
      request('/backtest/bulk', {
        market,
        strategy,
        period: options.period || '1y',
        interval: options.interval || '1d',
        capital: options.capital || 10000,
      }),

    // Dashboard
    getDashboardSummary: () => request('/dashboard/summary'),

    // Utilitário
    getBaseUrl: () => BASE_URL,
  };
})();
