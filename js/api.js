/**
 * Trade Halley - API Client v3.0
 * Alinhado com backend FastAPI v2.0 (OpenAPI spec)
 */
const API = (() => {
    const BASE_URL = 'https://wanderhalleylee-trade-halley.hf.space';
    let _cachedStrategies = null;

    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error.message);
            throw error;
        }
    }

    return {
        getBaseUrl: () => BASE_URL,

        // Health
        health: () => request('/health'),
        root: () => request('/'),

        // Assets (hard-coded maps)
        getAssets: (market = 'all') => request(`/assets?market=${market}`),
        getAssetInfo: (ticker) => request(`/asset/${encodeURIComponent(ticker)}`),

        // Market Data
        getMarketData: (ticker, period = '6mo', interval = '1d') =>
            request(`/market-data/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`),

        // Strategies (from strategies.py)
        getStrategies: async () => {
            if (_cachedStrategies) return _cachedStrategies;
            _cachedStrategies = await request('/strategies');
            return _cachedStrategies;
        },
        clearStrategyCache: () => { _cachedStrategies = null; },

        // Backtest
        runBacktest: (ticker, strategy, period = '1y', interval = '1d', capital = 10000, stopLoss = null, takeProfit = null) => {
            let url = `/backtest?ticker=${encodeURIComponent(ticker)}&strategy=${encodeURIComponent(strategy)}&period=${period}&interval=${interval}&capital=${capital}`;
            if (stopLoss !== null) url += `&stop_loss=${stopLoss}`;
            if (takeProfit !== null) url += `&take_profit=${takeProfit}`;
            return request(url);
        },

        runBulkBacktest: (market, strategy, period = '1y', interval = '1d', capital = 10000) =>
            request(`/backtest/bulk?market=${encodeURIComponent(market)}&strategy=${encodeURIComponent(strategy)}&period=${period}&interval=${interval}&capital=${capital}`),

        compareStrategies: (ticker, period = '1y', interval = '1d', capital = 10000) =>
            request(`/backtest/compare?ticker=${encodeURIComponent(ticker)}&period=${period}&interval=${interval}&capital=${capital}`),

        // Dashboard
        getDashboardSummary: () => request('/dashboard/summary'),

        // ===== CONFIG (PIN-protected) =====
        // POST /config/verify-pin  body: { pin }
        verifyPin: (pin) =>
            request('/config/verify-pin', {
                method: 'POST',
                body: JSON.stringify({ pin }),
            }),

        // POST /config/change-pin  body: { old_pin, new_pin }
        changePin: (oldPin, newPin) =>
            request('/config/change-pin', {
                method: 'POST',
                body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
            }),

        // GET /storage/stats (no PIN needed)
        getStorageStats: () => request('/storage/stats'),

        // GET /config/validate-ticker/{ticker}  (path param, no PIN)
        validateTicker: (ticker) =>
            request(`/config/validate-ticker/${encodeURIComponent(ticker)}`),

        // POST /config/download-data  body: { pin, ticker, start_date, end_date, timeframe }
        downloadData: (pin, ticker, startDate, endDate, timeframe = 'daily') =>
            request('/config/download-data', {
                method: 'POST',
                body: JSON.stringify({
                    pin,
                    ticker,
                    start_date: startDate,
                    end_date: endDate,
                    timeframe,
                }),
            }),

        // POST /config/update-all  body: { pin }
        manualUpdate: (pin) =>
            request('/config/update-all', {
                method: 'POST',
                body: JSON.stringify({ pin }),
            }),

        // DELETE /config/asset/{ticker}?pin=...
        deleteAsset: (ticker, pin) =>
            request(`/config/asset/${encodeURIComponent(ticker)}?pin=${encodeURIComponent(pin)}`, {
                method: 'DELETE',
            }),

        // GET /config/assets (no PIN)
        listSavedAssets: () => request('/config/assets'),

        // ===== SAVED BACKTESTS =====
        // POST /backtests/save  body: { result: {...} }
        saveBacktest: (resultObj) =>
            request('/backtests/save', {
                method: 'POST',
                body: JSON.stringify({ result: resultObj }),
            }),

        // GET /backtests/saved
        listSavedBacktests: () => request('/backtests/saved'),

        // GET /backtests/saved/{bt_id}
        getSavedBacktest: (id) => request(`/backtests/saved/${encodeURIComponent(id)}`),

        // DELETE /backtests/saved/{bt_id}
        deleteSavedBacktest: (id) =>
            request(`/backtests/saved/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    };
})();
