/**
 * API Client — Trade Halley v2.1
 * Backend + brapi.dev direct
 */
const API = (() => {
    const BASE = 'https://wanderhalleylee-trade-halley.hf.space';
    const BRAPI = 'https://brapi.dev/api';
    const TOKEN = 'ktC3hLVgH3QXrFnssfbcUj';

    async function req(endpoint, opts = {}) {
        const url = `${BASE}${endpoint}`;
        const cfg = { headers: { 'Content-Type': 'application/json' }, ...opts };
        const r = await fetch(url, cfg);
        if (!r.ok) {
            const e = await r.json().catch(() => ({ detail: r.statusText }));
            throw new Error(e.detail || `HTTP ${r.status}`);
        }
        return r.json();
    }

    /** Fetch ONE ticker from brapi */
    async function brapiQuote(ticker, params = {}) {
        params.token = TOKEN;
        const qs = new URLSearchParams(params).toString();
        const url = `${BRAPI}/quote/${encodeURIComponent(ticker)}?${qs}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`brapi ${r.status}`);
        const data = await r.json();
        return (data && data.results && data.results[0]) || null;
    }

    /** Fetch MULTIPLE tickers — one request per ticker (safe for special chars) */
    async function getDashboardQuotes(tickers) {
        const promises = tickers.map(t => brapiQuote(t).catch(() => null));
        const results = await Promise.all(promises);
        return results.filter(Boolean);
    }

    /** Historical OHLCV from brapi */
    async function getHistoricalData(ticker, range = '3mo', interval = '1d') {
        const q = await brapiQuote(ticker, { range, interval });
        return (q && q.historicalDataPrice) || [];
    }

    return {
        // Backend
        health: () => req('/health'),
        getAssets: (m) => req(`/assets${m ? '?market=' + m : ''}`),
        getAssetInfo: (t) => req(`/asset/${t}`),
        getMarketData: (t, p = '3mo', i = '1d') => req(`/market-data/${t}?period=${p}&interval=${i}`),
        getStrategies: () => req('/strategies'),
        runBacktest: (p) => { const qs = new URLSearchParams(p).toString(); return req(`/backtest?${qs}`); },
        runBulkBacktest: (p) => { const qs = new URLSearchParams(p).toString(); return req(`/backtest/bulk?${qs}`); },
        compareStrategies: (p) => { const qs = new URLSearchParams(p).toString(); return req(`/backtest/compare?${qs}`); },
        getDashboardSummary: () => req('/dashboard/summary'),
        verifyPin: (pin) => req('/config/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
        changePin: (old_pin, new_pin) => req('/config/change-pin', { method: 'POST', body: JSON.stringify({ old_pin, new_pin }) }),
        getStorageStats: () => req('/storage/stats'),
        validateTicker: (t) => req(`/config/validate-ticker/${t}`),
        downloadData: (b) => req('/config/download-data', { method: 'POST', body: JSON.stringify(b) }),
        manualUpdate: (b) => req('/config/update-all', { method: 'POST', body: JSON.stringify(b) }),
        deleteAsset: (t, pin) => req(`/config/asset/${t}?pin=${pin}`, { method: 'DELETE' }),
        listSavedAssets: () => req('/config/assets'),
        saveBacktest: (b) => req('/backtests/save', { method: 'POST', body: JSON.stringify(b) }),
        listSavedBacktests: () => req('/backtests/saved'),
        getSavedBacktest: (id) => req(`/backtests/saved/${id}`),
        deleteSavedBacktest: (id) => req(`/backtests/saved/${id}`, { method: 'DELETE' }),
        // brapi direct
        brapiQuote,
        getDashboardQuotes,
        getHistoricalData,
    };
})();
