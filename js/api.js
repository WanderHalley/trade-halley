// ═══════════════════════════════════════════════
// Trade Halley - API Layer
// ═══════════════════════════════════════════════

// Configurar URL da API (Hugging Face Spaces)
const API_BASE = 'https://SEU-USUARIO-huggingface.hf.space';
// Para desenvolvimento local: const API_BASE = 'http://localhost:7860';

const TradeHalleyAPI = {
    
    async getStocks(type = 0) {
        try {
            const res = await fetch(`${API_BASE}/api/stocks?type=${type}`);
            if (!res.ok) throw new Error('Erro ao buscar ativos');
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            toastr.error('Erro ao conectar com o servidor. Verifique se a API está ativa.');
            return { stocks: [] };
        }
    },

    async runBacktest(params) {
        try {
            const res = await fetch(`${API_BASE}/api/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Erro no backtest');
            }
            return await res.json();
        } catch (e) {
            console.error('Backtest Error:', e);
            toastr.error(e.message || 'Erro ao executar backtest');
            return null;
        }
    },

    async runDetailedBacktest(symbol, params) {
        try {
            const res = await fetch(`${API_BASE}/api/backtest/${symbol}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Erro no backtest');
            }
            return await res.json();
        } catch (e) {
            console.error('Detail Error:', e);
            toastr.error(e.message);
            return null;
        }
    }
};
