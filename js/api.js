/**
 * api.js — Trade Halley API Client v2.1
 * Aligned with backend endpoints + brapi.dev direct calls for dashboard
 */
const API = (() => {
    const BASE_URL = 'https://wanderhalleylee-trade-halley.hf.space';
    const BRAPI_BASE = 'https://brapi.dev/api';
    const BRAPI_TOKEN = 'ktC3hLVgH3QXrFnssfbcUj';

    async function request(endpoint, opts = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        };
        try {
            const resp = await fetch(url, config);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ detail: resp.statusText }));
                throw new Error(err.detail || `HTTP ${resp.status}`);
            }
            return await resp.json();
        } catch (e) {
            console.error(`API Error [${endpoint}]:`, e.message);
            throw e;
        }
    }

    async function brapiRequest(endpoint, params = {}) {
        params.token = BRAPI_TOKEN;
        const qs = new URLSearchParams(params).toString();
        const url = `${BRAPI_BASE}${endpoint}?${qs}`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ message: resp.statusText }));
                throw new Error(err.message || `brapi HTTP ${resp.status}`);
            }
            return await resp.json();
        } catch (e) {
            console.error(`brapi Error [${endpoint}]:`, e.message);
            throw e;
        }
    }

    // ─── Dashboard: direct brapi calls for real-time data ───
    async function getDashboardQuote(ticker) {
        const data = await brapiRequest(`/quote/${encodeURIComponent(ticker)}`);
        if (data && data.results && data.results.length > 0) return data.results[0];
        return null;
    }

    async function getDashboardQuotes(tickers) {
        // brapi supports comma-separated tickers
        const joined = tickers.join(',');
        const data = await brapiRequest(`/quote/${encodeURIComponent(joined)}`);
        if (data && data.results) return data.results;
        return [];
    }

    async function getHistoricalData(ticker, range = '3mo', interval = '1d') {
        const data = await brapiRequest(`/quote/${encodeURIComponent(ticker)}`, { range, interval });
        if (data && data.results && data.results.length > 0) {
            return data.results[0].historicalDataPrice || [];
        }
        return [];
    }

    // ─── Backend API calls ───
    return {
        // Health
        health: () => request('/health'),
        root: () => request('/'),

        // Assets
        getAssets: (market) => request(`/assets${market ? '?market=' + market : ''}`),
        getAssetInfo: (ticker) => request(`/asset/${ticker}`),

        // Market data (through backend — which now uses brapi internally)
        getMarketData: (ticker, period = '3mo', interval = '1d') =>
            request(`/market-data/${ticker}?period=${period}&interval=${interval}`),

        // Strategies
        getStrategies: () => request('/strategies'),

        // Backtest
        runBacktest: (params) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/backtest?${qs}`);
        },
        runBulkBacktest: (params) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/backtest/bulk?${qs}`);
        },
        compareStrategies: (params) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/backtest/compare?${qs}`);
        },

        // Dashboard (backend summary)
        getDashboardSummary: () => request('/dashboard/summary'),

        // Dashboard (direct brapi — real-time)
        getDashboardQuote,
        getDashboardQuotes,
        getHistoricalData,

        // Config
        verifyPin: (pin) => request('/config/verify-pin', {
            method: 'POST', body: JSON.stringify({ pin }),
        }),
        changePin: (current, newPin) => request('/config/change-pin', {
            method: 'POST', body: JSON.stringify({ current_pin: current, new_pin: newPin }),
        }),
        getStorageStats: () => request('/storage/stats'),
        validateTicker: (ticker) => request(`/config/validate-ticker/${ticker}`),
        downloadData: (body) => request('/config/download-data', {
            method: 'POST', body: JSON.stringify(body),
        }),
        manualUpdate: (body) => request('/config/update-all', {
            method: 'POST', body: JSON.stringify(body),
        }),
        deleteAsset: (ticker, pin) => request(`/config/asset/${ticker}?pin=${pin}`, {
            method: 'DELETE',
        }),
        listSavedAssets: () => request('/config/assets'),

        // Saved backtests
        saveBacktest: (body) => request('/backtests/save', {
            method: 'POST', body: JSON.stringify(body),
        }),
        listSavedBacktests: () => request('/backtests/saved'),
        getSavedBacktest: (id) => request(`/backtests/saved/${id}`),
        deleteSavedBacktest: (id) => request(`/backtests/saved/${id}`, {
            method: 'DELETE',
        }),
    };
})();
