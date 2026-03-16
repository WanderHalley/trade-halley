/**
 * Trade Halley — App Principal v2.1
 * SPA com Dashboard, Back-tests, Estratégias, Backtests Salvos e Configurações
 * Fonte de dados: brapi.dev (real-time) + backend HF Space (backtests)
 */
const App = (() => {
    // ─── State ───
    let currentPage = 'dashboard';
    let cachedStrategies = null;
    let configPin = null;

    // ═══════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════

    function init() {
        setupNavigation();
        setupMobileMenu();
        updateMarketStatus();
        updateStorageIndicator();
        navigateTo('dashboard');
        setInterval(updateMarketStatus, 60000);
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigateTo(page);
            });
        });
    }

    function setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const close = document.getElementById('sidebarClose');
        if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        if (close) close.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    function navigateTo(page) {
        currentPage = page;
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const active = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (active) active.classList.add('active');
        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
        // Destroy old charts
        Charts.destroyAll();
        // Render page
        const titles = {
            dashboard: ['Dashboard', 'Visão geral do mercado'],
            b3daily: ['B3 Daily', 'Backtest — ações B3 (diário)'],
            b3intraday: ['B3 Intraday', 'Backtest — ações B3 (intraday)'],
            bmfintraday: ['BMF Intraday', 'Backtest — futuros BMF (intraday)'],
            strategies: ['Estratégias', 'Gerenciar estratégias por timeframe'],
            saved: ['Backtests Salvos', 'Histórico de backtests salvos'],
            config: ['Configurações', 'Gerenciar dados e configurações'],
        };
        const [title, subtitle] = titles[page] || ['Trade Halley', ''];
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;

        switch (page) {
            case 'dashboard': renderDashboardPage(); break;
            case 'b3daily': renderBacktestPage('b3', '1d'); break;
            case 'b3intraday': renderBacktestPage('b3', '1h'); break;
            case 'bmfintraday': renderBacktestPage('bmf', '1h'); break;
            case 'strategies': renderStrategiesPage(); break;
            case 'saved': renderSavedPage(); break;
            case 'config': renderConfigPage(); break;
        }
    }

    // ═══════════════════════════════════════════
    //  MARKET STATUS & STORAGE
    // ═══════════════════════════════════════════

    function updateMarketStatus() {
        const el = document.getElementById('marketStatus');
        if (!el) return;
        const isOpen = Utils.isMarketOpen();
        el.innerHTML = `
            <span class="status-dot ${isOpen ? 'status-open' : 'status-closed'}"></span>
            <span class="status-text">${isOpen ? 'Mercado Aberto' : 'Mercado Fechado'}</span>
        `;
    }

    async function updateStorageIndicator() {
        try {
            const stats = await API.getStorageStats();
            const el = document.getElementById('storageCount');
            if (el) el.textContent = stats.total_assets || 0;
        } catch (e) {
            const el = document.getElementById('storageCount');
            if (el) el.textContent = '0';
        }
    }

    // ═══════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════

    async function renderDashboardPage() {
        const container = document.getElementById('pageContent');
        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="stat-card" id="cardIBOV">
                    <div class="stat-label"><i class="fas fa-chart-line"></i> IBOVESPA</div>
                    <div class="stat-value" id="valIBOV">Carregando...</div>
                    <div class="stat-change" id="chgIBOV">--</div>
                </div>
                <div class="stat-card" id="cardDOLAR">
                    <div class="stat-label"><i class="fas fa-dollar-sign"></i> Dólar (USD/BRL)</div>
                    <div class="stat-value" id="valDOLAR">Carregando...</div>
                    <div class="stat-change" id="chgDOLAR">--</div>
                </div>
                <div class="stat-card" id="cardBOVA11">
                    <div class="stat-label"><i class="fas fa-layer-group"></i> BOVA11</div>
                    <div class="stat-value" id="valBOVA11">Carregando...</div>
                    <div class="stat-change" id="chgBOVA11">--</div>
                </div>
                <div class="stat-card" id="cardSTORAGE">
                    <div class="stat-label"><i class="fas fa-database"></i> Ativos Cadastrados</div>
                    <div class="stat-value" id="valSTORAGE">--</div>
                    <div class="stat-change" id="chgSTORAGE">Supabase</div>
                </div>
            </div>
            <div class="charts-section">
                <div class="chart-container">
                    <h3><i class="fas fa-chart-area"></i> Gráfico de Referência — 3 meses</h3>
                    <canvas id="chartIBOV"></canvas>
                    <p class="chart-note" id="chartIBOVNote"></p>
                </div>
                <div class="chart-container">
                    <h3><i class="fas fa-chart-area"></i> Dólar (USD/BRL) — 3 meses</h3>
                    <canvas id="chartDOLAR"></canvas>
                    <p class="chart-note" id="chartDOLARNote"></p>
                </div>
            </div>
            <div class="market-table-section">
                <h3><i class="fas fa-table"></i> Cotações em Tempo Real</h3>
                <div class="table-responsive">
                    <table class="data-table" id="marketTable">
                        <thead>
                            <tr><th>Ativo</th><th>Nome</th><th>Preço</th><th>Variação</th><th>Volume</th></tr>
                        </thead>
                        <tbody id="marketTableBody">
                            <tr><td colspan="5" class="loading-cell">Carregando cotações via brapi.dev...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // ─── Fetch quotes from brapi ───
        const dashTickers = ['^BVSP', 'USDBRL=X', 'BOVA11'];
        const mktTickers = [
            'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 'WEGE3',
            'RENT3', 'BBAS3', 'PRIO3', 'SUZB3', 'MGLU3', 'HAPV3',
            'JBSS3', 'GGBR4', 'B3SA3', 'BOVA11',
        ];

        try {
            const allTickers = [...new Set([...dashTickers, ...mktTickers])];
            const quotes = await API.getDashboardQuotes(allTickers);
            const qMap = {};
            if (quotes) quotes.forEach(q => { qMap[q.symbol] = q; });

            // Cards
            _fillCard(qMap['^BVSP'], 'IBOV', false);
            _fillCard(qMap['USDBRL=X'], 'DOLAR', true);
            _fillCard(qMap['BOVA11'], 'BOVA11', false);

            // Storage
            try {
                const stats = await API.getStorageStats();
                document.getElementById('valSTORAGE').textContent = stats.total_assets || 0;
                document.getElementById('storageCount').textContent = stats.total_assets || 0;
            } catch (_) {
                document.getElementById('valSTORAGE').textContent = '0';
            }

            // Market table
            const tbody = document.getElementById('marketTableBody');
            const mktQuotes = mktTickers.map(t => qMap[t]).filter(Boolean);
            if (mktQuotes.length > 0) {
                tbody.innerHTML = mktQuotes.map(q => {
                    const pct = q.regularMarketChangePercent || 0;
                    const cls = pct >= 0 ? 'positive' : 'negative';
                    const arrow = pct >= 0 ? '▲' : '▼';
                    return `<tr>
                        <td><strong>${q.symbol}</strong></td>
                        <td>${q.shortName || q.longName || q.symbol}</td>
                        <td>${Utils.formatCurrency(q.regularMarketPrice)}</td>
                        <td class="${cls}">${arrow} ${pct.toFixed(2)}%</td>
                        <td>${Utils.formatVolume(q.regularMarketVolume)}</td>
                    </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5">Sem dados disponíveis</td></tr>';
            }
        } catch (e) {
            console.error('Dashboard error:', e);
            Utils.showToast('Erro ao carregar dashboard: ' + e.message, 'error');
        }

        // ─── Charts ───
        _renderDashboardCharts();
    }

    function _fillCard(q, id, isCurrency) {
        if (!q) return;
        const valEl = document.getElementById('val' + id);
        const chgEl = document.getElementById('chg' + id);
        if (!valEl) return;

        if (isCurrency) {
            valEl.textContent = `R$ ${q.regularMarketPrice.toFixed(4)}`;
        } else if (q.regularMarketPrice > 1000) {
            valEl.textContent = Utils.formatNumber(q.regularMarketPrice, 0);
        } else {
            valEl.textContent = Utils.formatCurrency(q.regularMarketPrice);
        }

        const pct = q.regularMarketChangePercent || 0;
        chgEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
        chgEl.className = `stat-change ${pct >= 0 ? 'positive' : 'negative'}`;
    }

    async function _renderDashboardCharts() {
        // Chart 1: try PETR4 (always has historical on free plan)
        try {
            let data = await API.getHistoricalData('BOVA11', '3mo', '1d');
            let label = 'BOVA11';
            if (!data || data.length === 0) {
                data = await API.getHistoricalData('PETR4', '3mo', '1d');
                label = 'PETR4 (referência)';
                const note = document.getElementById('chartIBOVNote');
                if (note) note.textContent = 'Nota: Dados históricos de BOVA11 indisponíveis no plano gratuito. Exibindo PETR4 como referência.';
            }
            if (data && data.length > 0) {
                const labels = data.map(d => {
                    const dt = new Date(d.date * 1000);
                    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                });
                const prices = data.map(d => d.close);
                Charts.priceLine('chartIBOV', labels, prices, label);
            }
        } catch (e) { console.error('Chart IBOV:', e); }

        // Chart 2: USD/BRL or VALE3 fallback
        try {
            let data = await API.getHistoricalData('USDBRL=X', '3mo', '1d');
            let label = 'USD/BRL';
            if (!data || data.length === 0) {
                data = await API.getHistoricalData('VALE3', '3mo', '1d');
                label = 'VALE3 (referência)';
                const note = document.getElementById('chartDOLARNote');
                if (note) note.textContent = 'Nota: Dados históricos de USD/BRL indisponíveis no plano gratuito. Exibindo VALE3 como referência.';
            }
            if (data && data.length > 0) {
                const labels = data.map(d => {
                    const dt = new Date(d.date * 1000);
                    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                });
                const prices = data.map(d => d.close);
                Charts.priceLine('chartDOLAR', labels, prices, label);
            }
        } catch (e) { console.error('Chart DOLAR:', e); }
    }

    // ═══════════════════════════════════════════
    //  BACKTEST PAGES (B3 Daily, B3 Intraday, BMF Intraday)
    // ═══════════════════════════════════════════

    async function renderBacktestPage(market, interval) {
        const container = document.getElementById('pageContent');
        const strategies = await loadStrategies();
        const intervalLabel = interval === '1d' ? 'Diário' : 'Intraday';

        container.innerHTML = `
            <div class="backtest-page">
                <div class="tab-bar">
                    <button class="tab-btn active" data-btab="single">Backtest Individual</button>
                    <button class="tab-btn" data-btab="bulk">Backtest em Massa</button>
                    <button class="tab-btn" data-btab="compare">Comparar Estratégias</button>
                </div>
                <div id="backtestTabContent"></div>
            </div>
        `;

        let activeTab = 'single';

        function renderBtTab(tab) {
            activeTab = tab;
            const content = document.getElementById('backtestTabContent');
            switch (tab) {
                case 'single': renderSingleBacktest(content, market, interval, strategies); break;
                case 'bulk': renderBulkBacktest(content, market, interval, strategies); break;
                case 'compare': renderCompareBacktest(content, market, interval, strategies); break;
            }
        }

        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Charts.destroyAll();
                renderBtTab(btn.dataset.btab);
            });
        });

        renderBtTab('single');
    }

    async function loadStrategies() {
        if (cachedStrategies) return cachedStrategies;
        try {
            const res = await API.getStrategies();
            cachedStrategies = res.strategies || [];
        } catch (e) {
            console.error('Load strategies error:', e);
            cachedStrategies = [];
        }
        return cachedStrategies;
    }

    function _strategyOptions(strategies) {
        return strategies.map(s =>
            `<option value="${s.id}">${s.name} (${s.category})</option>`
        ).join('');
    }

    function _tickerInput(market) {
        if (market === 'bmf') {
            return `<select id="btTicker" class="form-input">
                <option value="IBOV_FUT">Mini Índice (IBOV_FUT)</option>
                <option value="DOL_FUT">Mini Dólar (DOL_FUT)</option>
                <option value="SP500">S&P 500 (ES=F)</option>
                <option value="GOLD">Ouro (GC=F)</option>
                <option value="CRUDE_OIL">Petróleo (CL=F)</option>
                <option value="BITCOIN">Bitcoin (BTC-USD)</option>
            </select>`;
        }
        return `<input type="text" id="btTicker" class="form-input" placeholder="Ex: PETR4" value="PETR4">`;
    }

    // ─── Single Backtest ───
    function renderSingleBacktest(container, market, interval, strategies) {
        container.innerHTML = `
            <div class="backtest-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Ativo</label>
                        ${_tickerInput(market)}
                    </div>
                    <div class="form-group">
                        <label>Estratégia</label>
                        <select id="btStrategy" class="form-input">${_strategyOptions(strategies)}</select>
                    </div>
                    <div class="form-group">
                        <label>Período</label>
                        <select id="btPeriod" class="form-input">
                            <option value="3mo">3 meses</option>
                            <option value="6mo">6 meses</option>
                            <option value="1y" selected>1 ano</option>
                            <option value="2y">2 anos</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Capital (R$)</label>
                        <input type="number" id="btCapital" class="form-input" value="10000" min="100">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Stop Loss (%)</label>
                        <input type="number" id="btStopLoss" class="form-input" placeholder="Ex: 5" min="0.1" max="50" step="0.1">
                    </div>
                    <div class="form-group">
                        <label>Take Profit (%)</label>
                        <input type="number" id="btTakeProfit" class="form-input" placeholder="Ex: 10" min="0.1" max="100" step="0.1">
                    </div>
                    <div class="form-group form-action">
                        <button class="btn btn-primary" id="btnRunBacktest">
                            <i class="fas fa-play"></i> Executar Backtest
                        </button>
                    </div>
                </div>
            </div>
            <div id="backtestResult"></div>
        `;

        document.getElementById('btnRunBacktest').addEventListener('click', async () => {
            const ticker = document.getElementById('btTicker').value.trim().toUpperCase();
            const strategy = document.getElementById('btStrategy').value;
            const period = document.getElementById('btPeriod').value;
            const capital = parseFloat(document.getElementById('btCapital').value) || 10000;
            const slRaw = parseFloat(document.getElementById('btStopLoss').value);
            const tpRaw = parseFloat(document.getElementById('btTakeProfit').value);

            if (!ticker) { Utils.showToast('Informe o ticker', 'error'); return; }

            const params = { ticker, strategy, period, interval, capital };
            if (!isNaN(slRaw) && slRaw > 0) params.stop_loss = slRaw / 100;
            if (!isNaN(tpRaw) && tpRaw > 0) params.take_profit = tpRaw / 100;

            const resultDiv = document.getElementById('backtestResult');
            resultDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Executando backtest...</p></div>';

            try {
                const result = await API.runBacktest(params);
                renderBacktestResult(resultDiv, result);
            } catch (e) {
                resultDiv.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro: ${e.message}</p></div>`;
            }
        });
    }

    // ─── Bulk Backtest ───
    function renderBulkBacktest(container, market, interval, strategies) {
        container.innerHTML = `
            <div class="backtest-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Estratégia</label>
                        <select id="bulkStrategy" class="form-input">${_strategyOptions(strategies)}</select>
                    </div>
                    <div class="form-group">
                        <label>Período</label>
                        <select id="bulkPeriod" class="form-input">
                            <option value="3mo">3 meses</option>
                            <option value="6mo">6 meses</option>
                            <option value="1y" selected>1 ano</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Capital (R$)</label>
                        <input type="number" id="bulkCapital" class="form-input" value="10000" min="100">
                    </div>
                    <div class="form-group form-action">
                        <button class="btn btn-primary" id="btnRunBulk">
                            <i class="fas fa-play"></i> Executar em Massa
                        </button>
                    </div>
                </div>
            </div>
            <div id="bulkResult"></div>
        `;

        document.getElementById('btnRunBulk').addEventListener('click', async () => {
            const strategy = document.getElementById('bulkStrategy').value;
            const period = document.getElementById('bulkPeriod').value;
            const capital = parseFloat(document.getElementById('bulkCapital').value) || 10000;

            const resultDiv = document.getElementById('bulkResult');
            resultDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Executando backtests em massa... (pode levar alguns minutos)</p></div>';

            try {
                const data = await API.runBulkBacktest({ market, strategy, period, interval, capital });
                renderBulkResult(resultDiv, data);
            } catch (e) {
                resultDiv.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro: ${e.message}</p></div>`;
            }
        });
    }

    // ─── Compare Backtest ───
    function renderCompareBacktest(container, market, interval, strategies) {
        container.innerHTML = `
            <div class="backtest-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Ativo</label>
                        ${_tickerInput(market)}
                    </div>
                    <div class="form-group">
                        <label>Período</label>
                        <select id="cmpPeriod" class="form-input">
                            <option value="3mo">3 meses</option>
                            <option value="6mo">6 meses</option>
                            <option value="1y" selected>1 ano</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Capital (R$)</label>
                        <input type="number" id="cmpCapital" class="form-input" value="10000" min="100">
                    </div>
                    <div class="form-group form-action">
                        <button class="btn btn-primary" id="btnRunCompare">
                            <i class="fas fa-play"></i> Comparar Todas
                        </button>
                    </div>
                </div>
            </div>
            <div id="compareResult"></div>
        `;

        document.getElementById('btnRunCompare').addEventListener('click', async () => {
            const ticker = document.getElementById('btTicker').value.trim().toUpperCase();
            const period = document.getElementById('cmpPeriod').value;
            const capital = parseFloat(document.getElementById('cmpCapital').value) || 10000;

            if (!ticker) { Utils.showToast('Informe o ticker', 'error'); return; }

            const resultDiv = document.getElementById('compareResult');
            resultDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Comparando estratégias...</p></div>';

            try {
                const data = await API.compareStrategies({ ticker, period, interval, capital });
                renderCompareResult(resultDiv, data);
            } catch (e) {
                resultDiv.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro: ${e.message}</p></div>`;
            }
        });
    }

    // ═══════════════════════════════════════════
    //  BACKTEST RESULT RENDERERS
    // ═══════════════════════════════════════════

    function renderBacktestResult(container, result) {
        const r = result;
        const returnCls = (r.total_return_pct || 0) >= 0 ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="result-section">
                <div class="result-stats">
                    <div class="stat-card compact">
                        <div class="stat-label">Retorno Total</div>
                        <div class="stat-value ${returnCls}">${Utils.formatPercent(r.total_return_pct)}</div>
                    </div>
                    <div class="stat-card compact">
                        <div class="stat-label">Capital Final</div>
                        <div class="stat-value">${Utils.formatCurrency(r.final_capital)}</div>
                    </div>
                    <div class="stat-card compact">
                        <div class="stat-label">Total de Trades</div>
                        <div class="stat-value">${r.total_trades || 0}</div>
                    </div>
                    <div class="stat-card compact">
                        <div class="stat-label">Win Rate</div>
                        <div class="stat-value">${Utils.formatPercent(r.win_rate)}</div>
                    </div>
                    <div class="stat-card compact">
                        <div class="stat-label">Profit Factor</div>
                        <div class="stat-value">${(r.profit_factor || 0).toFixed(2)}</div>
                    </div>
                    <div class="stat-card compact">
                        <div class="stat-label">Max Drawdown</div>
                        <div class="stat-value negative">${Utils.formatPercent(r.max_drawdown)}</div>
                    </div>
                </div>
                <div class="result-charts">
                    <div class="chart-container">
                        <h4>Curva de Patrimônio</h4>
                        <canvas id="chartEquity"></canvas>
                    </div>
                    <div class="chart-container chart-small">
                        <h4>Win Rate</h4>
                        <canvas id="chartWinRate"></canvas>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="btn btn-primary" id="btnSaveResult">
                        <i class="fas fa-save"></i> Salvar Backtest
                    </button>
                </div>
            </div>
        `;

        // Equity chart
        if (r.equity_curve && r.equity_curve.length > 0) {
            const labels = r.equity_curve.map((_, i) => i + 1);
            Charts.equityCurve('chartEquity', labels, r.equity_curve);
        }

        // Win rate donut
        if (r.total_trades > 0) {
            const wins = r.winning_trades || 0;
            const losses = r.losing_trades || 0;
            Charts.winRateDonut('chartWinRate', wins, losses);
        }

        // Save button
        document.getElementById('btnSaveResult')?.addEventListener('click', async () => {
            try {
                await API.saveBacktest({ result: r });
                Utils.showToast('Backtest salvo com sucesso!', 'success');
            } catch (e) {
                Utils.showToast('Erro ao salvar: ' + e.message, 'error');
            }
        });
    }

    function renderBulkResult(container, data) {
        const results = data.results || [];
        if (results.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum resultado encontrado.</p>';
            return;
        }

        container.innerHTML = `
            <p class="result-summary">${data.total_tested} ativos testados com ${data.strategy}</p>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Ativo</th><th>Retorno</th><th>Capital Final</th>
                            <th>Trades</th><th>Win Rate</th><th>Drawdown</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(r => {
                            const cls = (r.total_return_pct || 0) >= 0 ? 'positive' : 'negative';
                            return `<tr>
                                <td><strong>${r.ticker}</strong></td>
                                <td class="${cls}">${Utils.formatPercent(r.total_return_pct)}</td>
                                <td>${Utils.formatCurrency(r.final_capital)}</td>
                                <td>${r.total_trades || 0}</td>
                                <td>${Utils.formatPercent(r.win_rate)}</td>
                                <td class="negative">${Utils.formatPercent(r.max_drawdown)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderCompareResult(container, data) {
        const results = data.results || [];
        if (results.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum resultado encontrado.</p>';
            return;
        }

        container.innerHTML = `
            <p class="result-summary">${data.total_strategies} estratégias comparadas para ${data.ticker}</p>
            <div class="chart-container"><canvas id="chartCompare"></canvas></div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Estratégia</th><th>Retorno</th>
                            <th>Trades</th><th>Win Rate</th><th>Profit Factor</th><th>Drawdown</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map((r, i) => {
                            const cls = (r.total_return_pct || 0) >= 0 ? 'positive' : 'negative';
                            return `<tr>
                                <td>${i + 1}</td>
                                <td>${r.strategy_name || r.strategy}</td>
                                <td class="${cls}">${Utils.formatPercent(r.total_return_pct)}</td>
                                <td>${r.total_trades || 0}</td>
                                <td>${Utils.formatPercent(r.win_rate)}</td>
                                <td>${(r.profit_factor || 0).toFixed(2)}</td>
                                <td class="negative">${Utils.formatPercent(r.max_drawdown)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Bar chart
        const labels = results.map(r => r.strategy_name || r.strategy);
        const values = results.map(r => r.total_return_pct || 0);
        Charts.performanceBar('chartCompare', labels, values);
    }

    // ═══════════════════════════════════════════
    //  STRATEGIES PAGE — CRUD
    // ═══════════════════════════════════════════

    const TRADE_CERTO_STRATEGIES = {
        daily: [
            { id: 'tc_sma_9_21', name: 'Cruzamento SMA 9/21', category: 'Tendência',
              entry: 'SMA 9 cruza acima da SMA 21', exit: 'SMA 9 cruza abaixo da SMA 21',
              indicators: 'SMA 9, SMA 21', timeframe: 'Diário', editable: false },
            { id: 'tc_sma_20_50', name: 'Cruzamento SMA 20/50', category: 'Tendência',
              entry: 'SMA 20 cruza acima da SMA 50', exit: 'SMA 20 cruza abaixo da SMA 50',
              indicators: 'SMA 20, SMA 50', timeframe: 'Diário', editable: false },
            { id: 'tc_ema_9_21', name: 'Cruzamento EMA 9/21', category: 'Tendência',
              entry: 'EMA 9 cruza acima da EMA 21', exit: 'EMA 9 cruza abaixo da EMA 21',
              indicators: 'EMA 9, EMA 21', timeframe: 'Diário', editable: false },
            { id: 'tc_ema_12_26', name: 'Cruzamento EMA 12/26', category: 'Tendência',
              entry: 'EMA 12 cruza acima da EMA 26', exit: 'EMA 12 cruza abaixo da EMA 26',
              indicators: 'EMA 12, EMA 26', timeframe: 'Diário', editable: false },
            { id: 'tc_macd', name: 'MACD (12,26,9)', category: 'Tendência',
              entry: 'MACD cruza acima da Signal Line', exit: 'MACD cruza abaixo da Signal Line',
              indicators: 'MACD, Signal Line, Histograma', timeframe: 'Diário', editable: false },
            { id: 'tc_rsi_14', name: 'RSI 14 (30/70)', category: 'Oscilador',
              entry: 'RSI 14 < 30 (sobrevenda)', exit: 'RSI 14 > 70 (sobrecompra)',
              indicators: 'RSI 14', timeframe: 'Diário', editable: false },
            { id: 'tc_rsi_9', name: 'RSI 9 (25/75)', category: 'Oscilador',
              entry: 'RSI 9 < 25 (sobrevenda)', exit: 'RSI 9 > 75 (sobrecompra)',
              indicators: 'RSI 9', timeframe: 'Diário', editable: false },
            { id: 'tc_bollinger', name: 'Bollinger Bands (20,2)', category: 'Volatilidade',
              entry: 'Preço toca banda inferior', exit: 'Preço toca banda superior',
              indicators: 'BB(20,2), SMA 20', timeframe: 'Diário', editable: false },
            { id: 'tc_stochastic', name: 'Estocástico (14,3)', category: 'Oscilador',
              entry: 'Sobrevenda + cruzamento %K > %D', exit: 'Sobrecompra + cruzamento %K < %D',
              indicators: '%K(14), %D(3)', timeframe: 'Diário', editable: false },
            { id: 'tc_adx', name: 'ADX Tendência (25)', category: 'Tendência',
              entry: 'ADX > 25 + DI+ > DI−', exit: 'ADX < 20 ou DI+ < DI−',
              indicators: 'ADX(14), DI+, DI−', timeframe: 'Diário', editable: false },
            { id: 'tc_triple_ema', name: 'Tripla EMA (9/21/55)', category: 'Tendência',
              entry: 'EMA 9 > EMA 21 > EMA 55 (alinhamento alta)', exit: 'EMA 9 < EMA 21',
              indicators: 'EMA 9, EMA 21, EMA 55', timeframe: 'Diário', editable: false },
            { id: 'tc_rsi_macd_combo', name: 'Combo RSI + MACD', category: 'Combo',
              entry: 'RSI < 40 E MACD > Signal', exit: 'RSI > 60 E MACD < Signal',
              indicators: 'RSI 14, MACD', timeframe: 'Diário', editable: false },
            { id: 'tc_breakout_vol', name: 'Breakout + Volume', category: 'Breakout',
              entry: 'Rompimento de máxima + Volume 1.5× acima da média', exit: 'Retorno abaixo do breakout',
              indicators: 'Máximas, Volume SMA 20', timeframe: 'Diário', editable: false },
        ],
        intraday_b3: [
            { id: 'tc_ib_ema_9_21', name: 'EMA 9/21 (5min)', category: 'Tendência',
              entry: 'EMA 9 cruza acima EMA 21 no 5min', exit: 'EMA 9 cruza abaixo EMA 21',
              indicators: 'EMA 9, EMA 21', timeframe: '5 min', editable: false },
            { id: 'tc_ib_vwap', name: 'VWAP Bounce', category: 'Reversão',
              entry: 'Preço retorna ao VWAP com candle de reversão', exit: 'Distância de 1 ATR do VWAP',
              indicators: 'VWAP, ATR(14)', timeframe: '5 min', editable: false },
            { id: 'tc_ib_scalp_rsi', name: 'Scalp RSI 9 (5min)', category: 'Oscilador',
              entry: 'RSI 9 < 20 no 5min', exit: 'RSI 9 > 80 ou gain de 0.5%',
              indicators: 'RSI 9', timeframe: '5 min', editable: false },
            { id: 'tc_ib_macd_15', name: 'MACD (15min)', category: 'Tendência',
              entry: 'MACD cruza acima da Signal no 15min', exit: 'MACD cruza abaixo da Signal',
              indicators: 'MACD(12,26,9)', timeframe: '15 min', editable: false },
            { id: 'tc_ib_boll_5', name: 'Bollinger Squeeze (5min)', category: 'Volatilidade',
              entry: 'Squeeze + rompimento da banda superior', exit: 'Retorno à SMA 20',
              indicators: 'BB(20,2), BB Width', timeframe: '5 min', editable: false },
            { id: 'tc_ib_opening_range', name: 'Opening Range Breakout', category: 'Breakout',
              entry: 'Rompimento da máxima dos primeiros 15min', exit: 'Stop na mínima do range ou 2R',
              indicators: 'High/Low 15min', timeframe: '15 min', editable: false },
            { id: 'tc_ib_ema_vol', name: 'EMA 9 + Volume', category: 'Combo',
              entry: 'Preço acima EMA 9 + Volume 2× média', exit: 'Preço abaixo EMA 9',
              indicators: 'EMA 9, Volume SMA 20', timeframe: '5 min', editable: false },
            { id: 'tc_ib_stoch_5', name: 'Estocástico Rápido (5min)', category: 'Oscilador',
              entry: '%K cruza %D em sobrevenda (< 20)', exit: '%K cruza %D em sobrecompra (> 80)',
              indicators: '%K(5), %D(3)', timeframe: '5 min', editable: false },
        ],
        intraday_bmf: [
            { id: 'tc_bmf_ema_9_21', name: 'EMA 9/21 Mini-índice', category: 'Tendência',
              entry: 'EMA 9 cruza acima EMA 21 (1min)', exit: 'EMA 9 cruza abaixo EMA 21',
              indicators: 'EMA 9, EMA 21', timeframe: '1 min', editable: false },
            { id: 'tc_bmf_vwap_dol', name: 'VWAP Mini-dólar', category: 'Reversão',
              entry: 'Toque no VWAP + candle de reversão', exit: '1 ATR do VWAP',
              indicators: 'VWAP, ATR(14)', timeframe: '1 min', editable: false },
            { id: 'tc_bmf_scalp_win', name: 'Scalp 200pts Mini-índice', category: 'Scalp',
              entry: 'EMA 9 > EMA 21 + RSI > 50', exit: 'Gain 200pts ou loss 100pts',
              indicators: 'EMA 9, EMA 21, RSI 9', timeframe: '1 min', editable: false },
            { id: 'tc_bmf_macd_wdo', name: 'MACD Mini-dólar (5min)', category: 'Tendência',
              entry: 'MACD cruza acima Signal no 5min', exit: 'MACD cruza abaixo Signal',
              indicators: 'MACD(12,26,9)', timeframe: '5 min', editable: false },
            { id: 'tc_bmf_boll_win', name: 'Bollinger Mini-índice', category: 'Volatilidade',
              entry: 'Toque na banda inferior + volume alto', exit: 'SMA 20 ou banda superior',
              indicators: 'BB(20,2)', timeframe: '5 min', editable: false },
            { id: 'tc_bmf_orb_win', name: 'ORB Mini-índice (5min)', category: 'Breakout',
              entry: 'Rompimento do range dos primeiros 5min', exit: 'Stop na extremidade oposta',
              indicators: 'High/Low 5min', timeframe: '5 min', editable: false },
            { id: 'tc_bmf_di1', name: 'DI Futuro — Tendência', category: 'Tendência',
              entry: 'SMA 5 cruza acima SMA 20', exit: 'SMA 5 cruza abaixo SMA 20',
              indicators: 'SMA 5, SMA 20', timeframe: 'Diário', editable: false },
            { id: 'tc_bmf_spread', name: 'Spread WIN/WDO', category: 'Arbitragem',
              entry: 'Spread desvia 2σ da média', exit: 'Spread retorna à média',
              indicators: 'Spread, Média, Desvio', timeframe: '5 min', editable: false },
        ],
    };

    // Custom strategies persisted in localStorage
    function _getCustomStrategies() {
        try {
            return JSON.parse(localStorage.getItem('th_custom_strats') || '{}');
        } catch { return {}; }
    }
    function _saveCustomStrategies(data) {
        localStorage.setItem('th_custom_strats', JSON.stringify(data));
    }
    function _getAllStrategies(tab) {
        const defaults = TRADE_CERTO_STRATEGIES[tab] || [];
        const custom = _getCustomStrategies()[tab] || [];
        return [...defaults, ...custom];
    }

    function renderStrategiesPage() {
        const container = document.getElementById('pageContent');
        container.innerHTML = `
            <div class="strategies-page">
                <div class="page-toolbar">
                    <div class="tab-bar">
                        <button class="tab-btn active" data-stab="daily">B3 Daily</button>
                        <button class="tab-btn" data-stab="intraday_b3">Intraday B3</button>
                        <button class="tab-btn" data-stab="intraday_bmf">Intraday BMF</button>
                    </div>
                    <button class="btn btn-primary" id="btnAddStrategy">
                        <i class="fas fa-plus"></i> Nova Estratégia
                    </button>
                </div>
                <div id="strategiesContent"></div>
            </div>
        `;

        let activeStratTab = 'daily';

        function renderStratTab(tab) {
            activeStratTab = tab;
            const strats = _getAllStrategies(tab);
            const content = document.getElementById('strategiesContent');

            if (strats.length === 0) {
                content.innerHTML = '<p class="empty-state">Nenhuma estratégia nesta categoria. Clique em "Nova Estratégia" para criar.</p>';
                return;
            }

            content.innerHTML = `<div class="strategies-grid">${strats.map(s => `
                <div class="strategy-card">
                    <div class="strategy-header">
                        <span class="strategy-badge badge-${s.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')}">${s.category}</span>
                        ${s.editable !== false
                            ? `<div class="strategy-actions">
                                   <button class="btn-icon btn-edit" data-sid="${s.id}" title="Editar"><i class="fas fa-pen"></i></button>
                                   <button class="btn-icon btn-delete" data-sid="${s.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                               </div>`
                            : '<span class="badge-default">Padrão</span>'
                        }
                    </div>
                    <h4 class="strategy-name">${s.name}</h4>
                    <div class="strategy-detail"><strong>Timeframe:</strong> ${s.timeframe}</div>
                    <div class="strategy-detail"><strong>Indicadores:</strong> ${s.indicators}</div>
                    <div class="strategy-detail"><strong>Entrada:</strong> ${s.entry}</div>
                    <div class="strategy-detail"><strong>Saída:</strong> ${s.exit}</div>
                </div>
            `).join('')}</div>`;

            content.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', () => _openStrategyModal(activeStratTab, btn.dataset.sid));
            });
            content.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => _deleteStrategy(activeStratTab, btn.dataset.sid));
            });
        }

        container.querySelectorAll('.tab-btn[data-stab]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.tab-btn[data-stab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderStratTab(btn.dataset.stab);
            });
        });

        document.getElementById('btnAddStrategy').addEventListener('click', () => {
            _openStrategyModal(activeStratTab, null);
        });

        renderStratTab('daily');
    }

    function _openStrategyModal(tab, editId) {
        let existing = null;
        if (editId) {
            const custom = _getCustomStrategies();
            existing = (custom[tab] || []).find(s => s.id === editId);
            if (!existing) return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${editId ? 'Editar' : 'Nova'} Estratégia</h3>
                    <button class="btn-icon modal-close"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>Nome</label>
                        <input type="text" id="mName" class="form-input" value="${existing ? existing.name : ''}" placeholder="Ex: Minha Estratégia EMA"></div>
                    <div class="form-group"><label>Categoria</label>
                        <select id="mCategory" class="form-input">
                            ${['Tendência','Oscilador','Volatilidade','Breakout','Reversão','Combo','Scalp','Arbitragem']
                                .map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
                        </select></div>
                    <div class="form-group"><label>Timeframe</label>
                        <input type="text" id="mTimeframe" class="form-input" value="${existing ? existing.timeframe : ''}" placeholder="Ex: 5 min, 15 min, Diário"></div>
                    <div class="form-group"><label>Indicadores</label>
                        <input type="text" id="mIndicators" class="form-input" value="${existing ? existing.indicators : ''}" placeholder="Ex: EMA 9, EMA 21, RSI 14"></div>
                    <div class="form-group"><label>Regra de Entrada</label>
                        <textarea id="mEntry" class="form-input" rows="3" placeholder="Descreva a condição de entrada...">${existing ? existing.entry : ''}</textarea></div>
                    <div class="form-group"><label>Regra de Saída</label>
                        <textarea id="mExit" class="form-input" rows="3" placeholder="Descreva a condição de saída...">${existing ? existing.exit : ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="btnSaveStrat"><i class="fas fa-save"></i> ${editId ? 'Salvar' : 'Criar'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.querySelector('.modal-close').addEventListener('click', closeModal);
        overlay.querySelector('.modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        document.getElementById('btnSaveStrat').addEventListener('click', () => {
            const name = document.getElementById('mName').value.trim();
            const category = document.getElementById('mCategory').value;
            const timeframe = document.getElementById('mTimeframe').value.trim();
            const indicators = document.getElementById('mIndicators').value.trim();
            const entry = document.getElementById('mEntry').value.trim();
            const exit = document.getElementById('mExit').value.trim();

            if (!name || !entry || !exit) {
                Utils.showToast('Preencha ao menos nome, entrada e saída', 'error');
                return;
            }

            const custom = _getCustomStrategies();
            if (!custom[tab]) custom[tab] = [];

            if (editId) {
                const idx = custom[tab].findIndex(s => s.id === editId);
                if (idx >= 0) custom[tab][idx] = { ...custom[tab][idx], name, category, timeframe, indicators, entry, exit };
            } else {
                custom[tab].push({
                    id: 'custom_' + Date.now(),
                    name, category, timeframe, indicators, entry, exit, editable: true,
                });
            }

            _saveCustomStrategies(custom);
            closeModal();
            Utils.showToast(editId ? 'Estratégia atualizada!' : 'Estratégia criada!', 'success');

            // Re-render and go back to same tab
            renderStrategiesPage();
            setTimeout(() => {
                document.querySelectorAll('.tab-btn[data-stab]').forEach(b => {
                    if (b.dataset.stab === tab) b.click();
                });
            }, 50);
        });
    }

    function _deleteStrategy(tab, id) {
        if (!confirm('Excluir esta estratégia personalizada?')) return;
        const custom = _getCustomStrategies();
        if (custom[tab]) custom[tab] = custom[tab].filter(s => s.id !== id);
        _saveCustomStrategies(custom);
        Utils.showToast('Estratégia excluída', 'success');
        renderStrategiesPage();
        setTimeout(() => {
            document.querySelectorAll('.tab-btn[data-stab]').forEach(b => {
                if (b.dataset.stab === tab) b.click();
            });
        }, 50);
    }

    // ═══════════════════════════════════════════
    //  SAVED BACKTESTS PAGE
    // ═══════════════════════════════════════════

    async function renderSavedPage() {
        const container = document.getElementById('pageContent');
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando backtests salvos...</p></div>';

        try {
            const data = await API.listSavedBacktests();
            const list = data.backtests || [];

            if (list.length === 0) {
                container.innerHTML = '<p class="empty-state">Nenhum backtest salvo ainda. Execute um backtest e clique em "Salvar" para guardá-lo aqui.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr><th>ID</th><th>Ativo</th><th>Estratégia</th><th>Retorno</th><th>Data</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${list.map(bt => {
                                const r = bt.result || bt;
                                const cls = (r.total_return_pct || 0) >= 0 ? 'positive' : 'negative';
                                return `<tr>
                                    <td>${r.id || bt.id || '--'}</td>
                                    <td><strong>${r.ticker || '--'}</strong></td>
                                    <td>${r.strategy || '--'}</td>
                                    <td class="${cls}">${Utils.formatPercent(r.total_return_pct)}</td>
                                    <td>${r.saved_at ? Utils.formatDate(r.saved_at) : '--'}</td>
                                    <td>
                                        <button class="btn-icon" title="Ver" data-view="${r.id || bt.id}"><i class="fas fa-eye"></i></button>
                                        <button class="btn-icon btn-delete" title="Excluir" data-del="${r.id || bt.id}"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            container.querySelectorAll('[data-view]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const bt = await API.getSavedBacktest(btn.dataset.view);
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'saved-detail';
                        container.appendChild(resultDiv);
                        renderBacktestResult(resultDiv, bt.result || bt);
                    } catch (e) {
                        Utils.showToast('Erro ao carregar: ' + e.message, 'error');
                    }
                });
            });

            container.querySelectorAll('[data-del]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Excluir este backtest salvo?')) return;
                    try {
                        await API.deleteSavedBacktest(btn.dataset.del);
                        Utils.showToast('Backtest excluído', 'success');
                        renderSavedPage();
                    } catch (e) {
                        Utils.showToast('Erro: ' + e.message, 'error');
                    }
                });
            });

        } catch (e) {
            container.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar backtests salvos: ${e.message}</p></div>`;
        }
    }

    // ═══════════════════════════════════════════
    //  CONFIG PAGE
    // ═══════════════════════════════════════════

    function renderConfigPage() {
        const container = document.getElementById('pageContent');

        if (!configPin) {
            container.innerHTML = `
                <div class="config-login">
                    <div class="login-card">
                        <i class="fas fa-lock login-icon"></i>
                        <h3>Acesso Protegido</h3>
                        <p>Digite o PIN para acessar as configurações</p>
                        <div class="form-group">
                            <input type="password" id="pinInput" class="form-input" placeholder="PIN" maxlength="10">
                        </div>
                        <button class="btn btn-primary" id="btnVerifyPin" style="width:100%">
                            <i class="fas fa-unlock"></i> Verificar PIN
                        </button>
                    </div>
                </div>
            `;

            const pinInput = document.getElementById('pinInput');
            pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btnVerifyPin').click(); });

            document.getElementById('btnVerifyPin').addEventListener('click', async () => {
                const pin = pinInput.value.trim();
                if (!pin) { Utils.showToast('Digite o PIN', 'error'); return; }
                try {
                    const res = await API.verifyPin(pin);
                    if (res.valid) {
                        configPin = pin;
                        Utils.showToast('PIN verificado!', 'success');
                        renderConfigPage();
                    } else {
                        Utils.showToast('PIN incorreto', 'error');
                    }
                } catch (e) {
                    Utils.showToast('Erro: ' + e.message, 'error');
                }
            });
            return;
        }

        // Authenticated config panel
        container.innerHTML = `
            <div class="config-panel">
                <div class="config-section">
                    <h3><i class="fas fa-database"></i> Estatísticas do Storage</h3>
                    <div id="storageStatsContent"><div class="spinner"></div></div>
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-download"></i> Download de Dados</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Ticker</label>
                            <input type="text" id="dlTicker" class="form-input" placeholder="Ex: PETR4">
                        </div>
                        <div class="form-group">
                            <label>Data Início</label>
                            <input type="date" id="dlStart" class="form-input" value="${Utils.getDefaultStartDate()}">
                        </div>
                        <div class="form-group">
                            <label>Data Fim</label>
                            <input type="date" id="dlEnd" class="form-input" value="${Utils.getTodayDate()}">
                        </div>
                        <div class="form-group">
                            <label>Timeframe</label>
                            <select id="dlTimeframe" class="form-input">
                                <option value="daily">Diário</option>
                                <option value="intraday">Intraday</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn btn-primary" id="btnDownload">
                        <i class="fas fa-download"></i> Baixar Dados
                    </button>
                    <div id="dlResult"></div>
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-sync-alt"></i> Atualização Manual</h3>
                    <p>Atualizar todos os ativos cadastrados (pode levar alguns minutos).</p>
                    <button class="btn btn-primary" id="btnUpdateAll">
                        <i class="fas fa-sync-alt"></i> Atualizar Todos
                    </button>
                    <div id="updateResult"></div>
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-list"></i> Ativos Cadastrados</h3>
                    <div id="savedAssetsContent"><div class="spinner"></div></div>
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-key"></i> Alterar PIN</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Novo PIN</label>
                            <input type="password" id="newPin" class="form-input" placeholder="Novo PIN" maxlength="10">
                        </div>
                        <div class="form-group">
                            <label>Confirmar</label>
                            <input type="password" id="confirmPin" class="form-input" placeholder="Confirmar" maxlength="10">
                        </div>
                    </div>
                    <button class="btn btn-primary" id="btnChangePin">
                        <i class="fas fa-key"></i> Alterar PIN
                    </button>
                </div>

                <div class="config-section">
                    <button class="btn btn-secondary" id="btnLogout">
                        <i class="fas fa-sign-out-alt"></i> Sair (Limpar PIN)
                    </button>
                </div>
            </div>
        `;

        // Load storage stats
        _loadStorageStats();
        _loadSavedAssets();

        // Download handler
        document.getElementById('btnDownload').addEventListener('click', async () => {
            const ticker = document.getElementById('dlTicker').value.trim().toUpperCase();
            const start = document.getElementById('dlStart').value;
            const end = document.getElementById('dlEnd').value;
            const timeframe = document.getElementById('dlTimeframe').value;
            const resultDiv = document.getElementById('dlResult');

            if (!ticker) { Utils.showToast('Informe o ticker', 'error'); return; }

            resultDiv.innerHTML = '<div class="spinner"></div>';
            try {
                const res = await API.downloadData({ pin: configPin, ticker, start_date: start, end_date: end, timeframe });
                resultDiv.innerHTML = `<p class="${res.success ? 'positive' : 'negative'}">${res.message}</p>`;
                if (res.success) {
                    _loadStorageStats();
                    _loadSavedAssets();
                    updateStorageIndicator();
                }
            } catch (e) {
                resultDiv.innerHTML = `<p class="negative">Erro: ${e.message}</p>`;
            }
        });

        // Update all handler
        document.getElementById('btnUpdateAll').addEventListener('click', async () => {
            const resultDiv = document.getElementById('updateResult');
            resultDiv.innerHTML = '<div class="spinner"></div><p>Atualizando... aguarde.</p>';
            try {
                const res = await API.manualUpdate({ pin: configPin });
                resultDiv.innerHTML = `<p class="positive">${res.message}</p>`;
                _loadStorageStats();
                updateStorageIndicator();
            } catch (e) {
                resultDiv.innerHTML = `<p class="negative">Erro: ${e.message}</p>`;
            }
        });

        // Change PIN handler
        document.getElementById('btnChangePin').addEventListener('click', async () => {
            const newP = document.getElementById('newPin').value.trim();
            const confP = document.getElementById('confirmPin').value.trim();
            if (!newP || newP !== confP) {
                Utils.showToast('PINs não conferem ou estão vazios', 'error');
                return;
            }
            try {
                await API.changePin(configPin, newP);
                configPin = newP;
                Utils.showToast('PIN alterado com sucesso!', 'success');
            } catch (e) {
                Utils.showToast('Erro: ' + e.message, 'error');
            }
        });

        // Logout
        document.getElementById('btnLogout').addEventListener('click', () => {
            configPin = null;
            Utils.showToast('PIN limpo', 'success');
            renderConfigPage();
        });
    }

    async function _loadStorageStats() {
        const el = document.getElementById('storageStatsContent');
        if (!el) return;
        try {
            const stats = await API.getStorageStats();
            el.innerHTML = `
                <div class="stats-grid-mini">
                    <div><strong>${stats.total_assets || 0}</strong><span>Ativos</span></div>
                    <div><strong>${stats.daily_assets || 0}</strong><span>Daily</span></div>
                    <div><strong>${stats.intraday_assets || 0}</strong><span>Intraday</span></div>
                    <div><strong>${stats.total_records || 0}</strong><span>Registros</span></div>
                    <div><strong>${stats.total_backtests || 0}</strong><span>Backtests</span></div>
                    <div><strong>${stats.storage_type || 'supabase'}</strong><span>Storage</span></div>
                </div>
            `;
        } catch (e) {
            el.innerHTML = '<p class="negative">Erro ao carregar stats</p>';
        }
    }

    async function _loadSavedAssets() {
        const el = document.getElementById('savedAssetsContent');
        if (!el) return;
        try {
            const data = await API.listSavedAssets();
            const assets = data.assets || [];
            if (assets.length === 0) {
                el.innerHTML = '<p>Nenhum ativo cadastrado ainda.</p>';
                return;
            }
            el.innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Ticker</th><th>Nome</th><th>Timeframe</th><th>Registros</th><th>Ações</th></tr></thead>
                        <tbody>
                            ${assets.map(a => `<tr>
                                <td><strong>${a.ticker}</strong></td>
                                <td>${a.name || '--'}</td>
                                <td>${a.timeframe || 'daily'}</td>
                                <td>${a.records || 0}</td>
                                <td><button class="btn-icon btn-delete" data-delticker="${a.ticker}" title="Excluir"><i class="fas fa-trash"></i></button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            el.querySelectorAll('[data-delticker]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm(`Excluir ativo ${btn.dataset.delticker}?`)) return;
                    try {
                        await API.deleteAsset(btn.dataset.delticker, configPin);
                        Utils.showToast('Ativo excluído', 'success');
                        _loadSavedAssets();
                        _loadStorageStats();
                        updateStorageIndicator();
                    } catch (e) {
                        Utils.showToast('Erro: ' + e.message, 'error');
                    }
                });
            });
        } catch (e) {
            el.innerHTML = '<p class="negative">Erro ao carregar ativos</p>';
        }
    }

    // ═══════════════════════════════════════════
    //  BOOT
    // ═══════════════════════════════════════════

    // Hide loading overlay
    document.addEventListener('DOMContentLoaded', () => {
        init();
        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'none';
        }, 800);
    });

    return { navigateTo, init };
})();
