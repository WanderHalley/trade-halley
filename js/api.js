/**
 * Trade Halley - API Client v2.0
 * Comunicação com o backend FastAPI
 */
const API = (() => {
    // ===== ALTERE PARA SUA URL DO HUGGING FACE SPACE =====
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

        // Status
        health: () => request('/health'),
        root: () => request('/'),

        // Assets
        getAssets: (market = 'all') => request(`/assets?market=${market}`),
        getAssetInfo: (ticker) => request(`/asset/${ticker}`),

        // Market Data
        getMarketData: (ticker, period = '6mo', interval = '1d', source = 'auto') =>
            request(`/market-data/${ticker}?period=${period}&interval=${interval}&source=${source}`),

        // Strategies
        getStrategies: async () => {
            if (_cachedStrategies) return _cachedStrategies;
            _cachedStrategies = await request('/strategies');
            return _cachedStrategies;
        },

        // Backtest
        runBacktest: (ticker, strategy, period = '1y', interval = '1d', capital = 10000) =>
            request(`/backtest?ticker=${ticker}&strategy=${strategy}&period=${period}&interval=${interval}&capital=${capital}`),

        runBulkBacktest: (market, strategy, period = '1y', interval = '1d', capital = 10000) =>
            request(`/backtest/bulk?market=${market}&strategy=${strategy}&period=${period}&interval=${interval}&capital=${capital}`),

        compareStrategies: (ticker, period = '1y', interval = '1d', capital = 10000) =>
            request(`/backtest/compare?ticker=${ticker}&period=${period}&interval=${interval}&capital=${capital}`),

        // Dashboard
        getDashboardSummary: () => request('/dashboard/summary'),

        // ===== CONFIG (protegido por PIN) =====
        verifyPin: (pin) => request(`/config/verify-pin?pin=${encodeURIComponent(pin)}`),

        changePin: (oldPin, newPin) =>
            request(`/config/change-pin?old_pin=${encodeURIComponent(oldPin)}&new_pin=${encodeURIComponent(newPin)}`, { method: 'POST' }),

        getStorageInfo: (pin) =>
            request(`/config/storage?pin=${encodeURIComponent(pin)}`),

        validateTicker: (ticker, pin) =>
            request(`/config/validate-ticker?ticker=${encodeURIComponent(ticker)}&pin=${encodeURIComponent(pin)}`),

        downloadData: (ticker, startDate, endDate, timeframe, pin) =>
            request(`/config/download?ticker=${encodeURIComponent(ticker)}&start_date=${startDate}&end_date=${endDate}&timeframe=${timeframe}&pin=${encodeURIComponent(pin)}`, { method: 'POST' }),

        manualUpdate: (pin) =>
            request(`/config/update?pin=${encodeURIComponent(pin)}`, { method: 'POST' }),

        deleteAsset: (ticker, pin) =>
            request(`/config/delete-asset?ticker=${encodeURIComponent(ticker)}&pin=${encodeURIComponent(pin)}`, { method: 'DELETE' }),

        // ===== BACKTESTS SALVOS =====
        saveBacktest: (ticker, strategy, period = '1y', interval = '1d', capital = 10000) =>
            request(`/saved-backtests/save?ticker=${ticker}&strategy=${strategy}&period=${period}&interval=${interval}&capital=${capital}`, { method: 'POST' }),

        listSavedBacktests: () => request('/saved-backtests'),

        getSavedBacktest: (id) => request(`/saved-backtests/${id}`),

        deleteSavedBacktest: (id) =>
            request(`/saved-backtests/${id}`, { method: 'DELETE' }),
    };
})();
