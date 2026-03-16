/**
 * Trade Halley - App Principal v2.0
 * SPA com Dashboard, Back-tests, Configurações e Backtests Salvos
 */
const App = (() => {
    let currentPage = 'dashboard';
    let cachedStrategies = null;
    let configPin = null; // PIN guardado na sessão

    // ============================================================
    // INIT
    // ============================================================

    async function init() {
        setupNavigation();
        setupMobileMenu();
        navigate('dashboard');
        updateMarketStatus();
        updateStorageIndicator();
        setInterval(updateMarketStatus, 60000);

        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'none';
        }, 1500);
    }

    // ============================================================
    // NAVIGATION
    // ============================================================

    function setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigate(page);

                if (window.innerWidth < 1024) {
                    document.getElementById('sidebar').classList.remove('active');
                }
            });
        });
    }

    function navigate(page) {
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const active = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (active) active.classList.add('active');

        const titles = {
            'dashboard': 'Dashboard',
            'b3-daily': 'Back-Tests B3 Daily',
            'b3-intraday': 'Back-Tests B3 Intraday',
            'bmf-intraday': 'Back-Tests BMF Intraday',
            'saved-backtests': 'Backtests Salvos',
            'config': 'Configurações',
        };
        document.getElementById('pageTitle').textContent = titles[page] || 'Trade Halley';

        const content = document.getElementById('pageContent');
        content.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div></div>';

        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'b3-daily': renderBacktestPage('b3', '1d'); break;
            case 'b3-intraday': renderBacktestPage('b3', '1h'); break;
            case 'bmf-intraday': renderBacktestPage('bmf', '1h'); break;
            case 'saved-backtests': renderSavedBacktests(); break;
            case 'config': renderConfig(); break;
        }
    }

    // ============================================================
    // MOBILE MENU
    // ============================================================

    function setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const close = document.getElementById('sidebarClose');

        if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        if (close) close.addEventListener('click', () => sidebar.classList.remove('active'));
    }

    // ============================================================
    // MARKET STATUS
    // ============================================================

    function updateMarketStatus() {
        const el = document.getElementById('marketStatus');
        if (!el) return;
        const now = new Date();
        const hour = now.getUTCHours() - 3;
        const day = now.getDay();
        const isOpen = day >= 1 && day <= 5 && hour >= 10 && hour < 17;
        el.innerHTML = `
            <span class="status-dot" style="background:${isOpen ? 'var(--success)' : 'var(--danger)'}"></span>
            <span class="status-text">${isOpen ? 'Mercado Aberto' : 'Mercado Fechado'}</span>
        `;
    }

    // ============================================================
    // STORAGE INDICATOR
    // ============================================================

    async function updateStorageIndicator() {
        const el = document.getElementById('storageText');
        if (!el) return;
        try {
            const data = await API.getDashboardSummary();
            const stored = data.stored_assets || 0;
            const size = data.storage_size_mb || 0;
            el.textContent = `${stored} ativos • ${size} MB`;
        } catch {
            el.textContent = 'Offline';
        }
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    async function renderDashboard() {
        const content = document.getElementById('pageContent');
        content.innerHTML = `
            <div class="dashboard-stats" id="dashStats">
                ${renderStatCardSkeleton(4)}
            </div>
            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-chart-line"></i> IBOV / BOVA11</h3></div>
                    <div class="card-body"><canvas id="ibovChart"></canvas><p id="ibovFallback" class="chart-fallback" style="display:none"></p></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-dollar-sign"></i> Dólar (USD/BRL)</h3></div>
                    <div class="card-body"><canvas id="dolarChart"></canvas><p id="dolarFallback" class="chart-fallback" style="display:none"></p></div>
                </div>
            </div>
            <div class="card" style="margin-top:1.5rem">
                <div class="card-header"><h3><i class="fas fa-table"></i> Visão de Mercado</h3></div>
                <div class="card-body"><div id="marketTable">Carregando...</div></div>
            </div>
        `;

        loadDashboardData();
        loadIbovChart();
        loadDolarChart();
    }

    async function loadDashboardData() {
        try {
            const data = await API.getDashboardSummary();
            const stats = document.getElementById('dashStats');
            if (stats) {
                stats.innerHTML = `
                    ${renderStatCard('Ações B3', data.total_b3_assets, 'fas fa-building', 'var(--accent)')}
                    ${renderStatCard('Futuros BMF', data.total_bmf_assets, 'fas fa-exchange-alt', 'var(--warning)')}
                    ${renderStatCard('Estratégias', data.total_strategies, 'fas fa-brain', 'var(--info)')}
                    ${renderStatCard('Ativos Salvos', data.stored_assets || 0, 'fas fa-database', 'var(--success)')}
                `;
            }

            const table = document.getElementById('marketTable');
            if (table && data.market_overview && data.market_overview.length > 0) {
                let html = '<table class="data-table"><thead><tr><th>Ativo</th><th>Nome</th><th>Preço</th><th>Variação</th><th>Volume</th></tr></thead><tbody>';
                data.market_overview.forEach(a => {
                    const color = a.change_pct >= 0 ? 'var(--success)' : 'var(--danger)';
                    const arrow = a.change_pct >= 0 ? '▲' : '▼';
                    html += `<tr>
                        <td><strong style="color:var(--accent)">${a.ticker}</strong></td>
                        <td>${a.name || '-'}</td>
                        <td>R$ ${a.price.toFixed(2)}</td>
                        <td style="color:${color};font-weight:600">${arrow} ${Math.abs(a.change_pct).toFixed(2)}%</td>
                        <td>${a.volume ? a.volume.toLocaleString('pt-BR') : '-'}</td>
                    </tr>`;
                });
                html += '</tbody></table>';
                table.innerHTML = html;
            } else if (table) {
                table.innerHTML = '<p style="color:var(--text-muted)">Nenhum dado de mercado disponível no momento.</p>';
            }
        } catch (e) {
            console.error('Dashboard error:', e);
        }
    }

    async function loadIbovChart() {
        const canvas = document.getElementById('ibovChart');
        const fallback = document.getElementById('ibovFallback');
        if (!canvas) return;
        const tickers = ['IBOV', 'BOVA11'];
        for (const ticker of tickers) {
            try {
                const data = await API.getMarketData(ticker, '6mo', '1d');
                if (data && data.data && data.data.length > 10) {
                    Charts.renderPriceLine(canvas, data.data, `${ticker}`);
                    return;
                }
            } catch {}
        }
        canvas.style.display = 'none';
        if (fallback) { fallback.style.display = 'block'; fallback.textContent = 'Gráfico indisponível no momento'; }
    }

    async function loadDolarChart() {
        const canvas = document.getElementById('dolarChart');
        const fallback = document.getElementById('dolarFallback');
        if (!canvas) return;
        const tickers = ['DOLAR'];
        for (const ticker of tickers) {
            try {
                const data = await API.getMarketData(ticker, '6mo', '1d');
                if (data && data.data && data.data.length > 10) {
                    Charts.renderPriceLine(canvas, data.data, 'USD/BRL');
                    return;
                }
            } catch {}
        }
        canvas.style.display = 'none';
        if (fallback) { fallback.style.display = 'block'; fallback.textContent = 'Gráfico indisponível no momento'; }
    }

    // ============================================================
    // BACKTEST PAGES
    // ============================================================

    async function renderBacktestPage(market, interval) {
        const content = document.getElementById('pageContent');

        try {
            const strats = await API.getStrategies();
            cachedStrategies = strats.strategies || [];
        } catch { cachedStrategies = []; }

        const stratOptions = cachedStrategies.map(s =>
            `<option value="${s.id}">${s.name} (${s.category})</option>`
        ).join('');

        content.innerHTML = `
            <div class="bt-tabs">
                <button class="bt-tab active" onclick="App._switchBtTab('bulk')">Todos os Ativos</button>
                <button class="bt-tab" onclick="App._switchBtTab('single')">Ativo Individual</button>
                <button class="bt-tab" onclick="App._switchBtTab('compare')">Comparar Estratégias</button>
            </div>

            <div id="btTabBulk" class="bt-tab-content active">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-layer-group"></i> Back-test em Todos os Ativos</h3>
                    </div>
                    <div class="card-body">
                        <div class="config-form-row">
                            <div class="config-form-group">
                                <label>Estratégia</label>
                                <select id="bulkStrategy">${stratOptions}</select>
                            </div>
                            <div class="config-form-group">
                                <label>Período</label>
                                <select id="bulkPeriod">
                                    <option value="3mo">3 Meses</option>
                                    <option value="6mo">6 Meses</option>
                                    <option value="1y" selected>1 Ano</option>
                                    <option value="2y">2 Anos</option>
                                </select>
                            </div>
                            <div class="config-form-group">
                                <label>Capital</label>
                                <input type="number" id="bulkCapital" value="10000" min="100">
                            </div>
                            <div class="config-form-group" style="justify-content:flex-end">
                                <button class="btn btn-primary" onclick="App.runBulk('${market}','${interval}')">
                                    <i class="fas fa-play"></i> Executar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="bulkResults"></div>
            </div>

            <div id="btTabSingle" class="bt-tab-content">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-search"></i> Back-test Individual</h3>
                    </div>
                    <div class="card-body">
                        <div class="config-form-row">
                            <div class="config-form-group">
                                <label>Ticker</label>
                                <input type="text" id="singleTicker" placeholder="Ex: PETR4" style="text-transform:uppercase">
                            </div>
                            <div class="config-form-group">
                                <label>Estratégia</label>
                                <select id="singleStrategy">${stratOptions}</select>
                            </div>
                            <div class="config-form-group">
                                <label>Período</label>
                                <select id="singlePeriod">
                                    <option value="3mo">3 Meses</option>
                                    <option value="6mo">6 Meses</option>
                                    <option value="1y" selected>1 Ano</option>
                                    <option value="2y">2 Anos</option>
                                </select>
                            </div>
                            <div class="config-form-group">
                                <label>Capital</label>
                                <input type="number" id="singleCapital" value="10000" min="100">
                            </div>
                            <div class="config-form-group" style="justify-content:flex-end;gap:0.5rem;flex-direction:row">
                                <button class="btn btn-primary" onclick="App.runSingle('${interval}')">
                                    <i class="fas fa-play"></i> Analisar
                                </button>
                                <button class="btn btn-success" onclick="App.runAndSave('${interval}')" title="Executar e Salvar">
                                    <i class="fas fa-save"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="singleResults"></div>
            </div>

            <div id="btTabCompare" class="bt-tab-content">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-balance-scale"></i> Comparar Estratégias</h3>
                    </div>
                    <div class="card-body">
                        <div class="config-form-row">
                            <div class="config-form-group">
                                <label>Ticker</label>
                                <input type="text" id="compareTicker" placeholder="Ex: PETR4" style="text-transform:uppercase">
                            </div>
                            <div class="config-form-group">
                                <label>Período</label>
                                <select id="comparePeriod">
                                    <option value="3mo">3 Meses</option>
                                    <option value="6mo">6 Meses</option>
                                    <option value="1y" selected>1 Ano</option>
                                    <option value="2y">2 Anos</option>
                                </select>
                            </div>
                            <div class="config-form-group">
                                <label>Capital</label>
                                <input type="number" id="compareCapital" value="10000" min="100">
                            </div>
                            <div class="config-form-group" style="justify-content:flex-end">
                                <button class="btn btn-primary" onclick="App.runCompare('${interval}')">
                                    <i class="fas fa-play"></i> Comparar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="compareResults"></div>
            </div>
        `;
    }

    function _switchBtTab(tab) {
        document.querySelectorAll('.bt-tab').forEach((el, i) => {
            el.classList.toggle('active', ['bulk', 'single', 'compare'][i] === tab);
        });
        document.querySelectorAll('.bt-tab-content').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(`btTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (target) target.classList.add('active');
    }

    // Bulk backtest
    async function runBulk(market, interval) {
        const strategy = document.getElementById('bulkStrategy').value;
        const period = document.getElementById('bulkPeriod').value;
        const capital = document.getElementById('bulkCapital').value;
        const container = document.getElementById('bulkResults');
        container.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div><p>Executando back-tests... Isso pode levar alguns minutos.</p></div>';

        try {
            const data = await API.runBulkBacktest(market, strategy, period, interval, capital);
            renderBulkResults(data, container);
        } catch (e) {
            container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--danger)">Erro: ${e.message}</p></div></div>`;
        }
    }

    function renderBulkResults(data, container) {
        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<div class="card"><div class="card-body"><p>Nenhum resultado disponível.</p></div></div>';
            return;
        }

        let html = `
            <div class="card" style="margin-top:1rem">
                <div class="card-header">
                    <h3><i class="fas fa-trophy"></i> Resultados — ${data.strategy} (${data.total_assets} ativos em ${data.execution_time}s)</h3>
                </div>
                <div class="card-body">
                    <table class="data-table" id="bulkTable">
                        <thead><tr>
                            <th>#</th><th>Ativo</th><th>Retorno %</th><th>Win Rate</th>
                            <th>Trades</th><th>Profit Factor</th><th>Max DD</th><th>Sharpe</th><th>Equity Final</th>
                        </tr></thead><tbody>
        `;

        data.results.forEach((r, i) => {
            const color = r.total_return_pct >= 0 ? 'var(--success)' : 'var(--danger)';
            html += `<tr>
                <td>${i + 1}</td>
                <td><strong style="color:var(--accent)">${r.ticker}</strong></td>
                <td style="color:${color};font-weight:700">${r.total_return_pct.toFixed(2)}%</td>
                <td>${r.win_rate.toFixed(1)}%</td>
                <td>${r.total_trades}</td>
                <td>${r.profit_factor.toFixed(2)}</td>
                <td style="color:var(--danger)">${r.max_drawdown_pct.toFixed(2)}%</td>
                <td>${r.sharpe_ratio.toFixed(2)}</td>
                <td>R$ ${r.final_equity.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';
        container.innerHTML = html;
    }

    // Single backtest
    async function runSingle(interval) {
        const ticker = document.getElementById('singleTicker').value.toUpperCase().trim();
        const strategy = document.getElementById('singleStrategy').value;
        const period = document.getElementById('singlePeriod').value;
        const capital = document.getElementById('singleCapital').value;

        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }

        const container = document.getElementById('singleResults');
        container.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div></div>';

        try {
            const data = await API.runBacktest(ticker, strategy, period, interval, capital);
            renderSingleResult(data, container);
        } catch (e) {
            container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--danger)">Erro: ${e.message}</p></div></div>`;
        }
    }

    // Run and save
    async function runAndSave(interval) {
        const ticker = document.getElementById('singleTicker').value.toUpperCase().trim();
        const strategy = document.getElementById('singleStrategy').value;
        const period = document.getElementById('singlePeriod').value;
        const capital = document.getElementById('singleCapital').value;

        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }

        const container = document.getElementById('singleResults');
        container.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div><p>Executando e salvando...</p></div>';

        try {
            const data = await API.saveBacktest(ticker, strategy, period, interval, capital);
            Utils.showToast(`Back-test salvo! ID: ${data.id}`, 'success');
            renderSingleResult(data.result, container);
        } catch (e) {
            container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--danger)">Erro: ${e.message}</p></div></div>`;
        }
    }

    function renderSingleResult(data, container) {
        const m = data.metrics;
        const retColor = m.total_return_pct >= 0 ? 'var(--success)' : 'var(--danger)';

        let html = `
            <div class="card" style="margin-top:1rem">
                <div class="card-header">
                    <h3><i class="fas fa-chart-line"></i> ${data.ticker} — ${data.strategy_name}</h3>
                </div>
                <div class="card-body">
                    <div class="dashboard-stats">
                        ${renderStatCard('Retorno', `${m.total_return_pct.toFixed(2)}%`, 'fas fa-percentage', retColor)}
                        ${renderStatCard('Win Rate', `${m.win_rate.toFixed(1)}%`, 'fas fa-bullseye', 'var(--info)')}
                        ${renderStatCard('Trades', m.total_trades, 'fas fa-exchange-alt', 'var(--warning)')}
                        ${renderStatCard('Sharpe', m.sharpe_ratio.toFixed(2), 'fas fa-chart-bar', 'var(--accent)')}
                    </div>
                    <div class="dashboard-grid" style="margin-top:1rem">
                        <div><canvas id="equityChart"></canvas></div>
                        <div><canvas id="winRateChart"></canvas></div>
                    </div>
                    <div style="margin-top:1.5rem">
                        <h4 style="color:var(--text);margin-bottom:0.75rem"><i class="fas fa-list"></i> Métricas Completas</h4>
                        <div class="storage-stats-grid">
                            <div class="storage-stat-item"><span class="stat-value">R$ ${m.initial_capital.toLocaleString('pt-BR')}</span><span class="stat-label">Capital Inicial</span></div>
                            <div class="storage-stat-item"><span class="stat-value" style="color:${retColor}">R$ ${m.final_equity.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span><span class="stat-label">Equity Final</span></div>
                            <div class="storage-stat-item"><span class="stat-value">${m.profit_factor.toFixed(2)}</span><span class="stat-label">Profit Factor</span></div>
                            <div class="storage-stat-item"><span class="stat-value" style="color:var(--danger)">${m.max_drawdown_pct.toFixed(2)}%</span><span class="stat-label">Max Drawdown</span></div>
                            <div class="storage-stat-item"><span class="stat-value">${m.sortino_ratio.toFixed(2)}</span><span class="stat-label">Sortino</span></div>
                            <div class="storage-stat-item"><span class="stat-value" style="color:var(--success)">${m.winning_trades}</span><span class="stat-label">Trades +</span></div>
                            <div class="storage-stat-item"><span class="stat-value" style="color:var(--danger)">${m.losing_trades}</span><span class="stat-label">Trades -</span></div>
                            <div class="storage-stat-item"><span class="stat-value">R$ ${m.avg_win.toFixed(2)}</span><span class="stat-label">Média Win</span></div>
                            <div class="storage-stat-item"><span class="stat-value">R$ ${m.avg_loss.toFixed(2)}</span><span class="stat-label">Média Loss</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Charts
        if (data.equity_curve && data.equity_curve.length > 0) {
            const eqCanvas = document.getElementById('equityChart');
            if (eqCanvas) Charts.renderEquityCurve(eqCanvas, data.equity_curve);
        }
        const wrCanvas = document.getElementById('winRateChart');
        if (wrCanvas) Charts.renderWinRateDonut(wrCanvas, m.winning_trades, m.losing_trades);
    }

    // Compare
    async function runCompare(interval) {
        const ticker = document.getElementById('compareTicker').value.toUpperCase().trim();
        const period = document.getElementById('comparePeriod').value;
        const capital = document.getElementById('compareCapital').value;

        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }

        const container = document.getElementById('compareResults');
        container.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div><p>Comparando todas as estratégias... Pode levar alguns minutos.</p></div>';

        try {
            const data = await API.compareStrategies(ticker, period, interval, capital);
            renderCompareResults(data, container);
        } catch (e) {
            container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--danger)">Erro: ${e.message}</p></div></div>`;
        }
    }

    function renderCompareResults(data, container) {
        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<div class="card"><div class="card-body"><p>Nenhum resultado.</p></div></div>';
            return;
        }

        let html = `
            <div class="card" style="margin-top:1rem">
                <div class="card-header">
                    <h3><i class="fas fa-ranking-star"></i> Ranking — ${data.ticker} (${data.total_strategies} estratégias)</h3>
                </div>
                <div class="card-body">
                    <table class="data-table">
                        <thead><tr><th>#</th><th>Estratégia</th><th>Categoria</th><th>Retorno %</th><th>Win Rate</th><th>PF</th><th>Max DD</th><th>Sharpe</th><th>Trades</th></tr></thead><tbody>
        `;

        data.results.forEach((r, i) => {
            const color = r.total_return_pct >= 0 ? 'var(--success)' : 'var(--danger)';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            html += `<tr${i === 0 ? ' style="background:rgba(0,255,136,0.05)"' : ''}>
                <td>${medal}</td>
                <td><strong>${r.strategy_name}</strong></td>
                <td><span class="badge">${r.category}</span></td>
                <td style="color:${color};font-weight:700">${r.total_return_pct.toFixed(2)}%</td>
                <td>${r.win_rate.toFixed(1)}%</td>
                <td>${r.profit_factor.toFixed(2)}</td>
                <td style="color:var(--danger)">${r.max_drawdown_pct.toFixed(2)}%</td>
                <td>${r.sharpe_ratio.toFixed(2)}</td>
                <td>${r.total_trades}</td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';
        container.innerHTML = html;
    }

    // ============================================================
    // SAVED BACKTESTS PAGE
    // ============================================================

    async function renderSavedBacktests() {
        const content = document.getElementById('pageContent');
        content.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div></div>';

        try {
            const data = await API.listSavedBacktests();
            const backtests = data.backtests || [];

            if (backtests.length === 0) {
                content.innerHTML = `
                    <div class="saved-bt-empty">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhum back-test salvo</h3>
                        <p style="color:var(--text-muted)">Execute um back-test e clique em <i class="fas fa-save"></i> para salvar.</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="saved-bt-grid">';
            backtests.forEach(bt => {
                const retColor = bt.total_return_pct >= 0 ? 'positive' : 'negative';
                const retSign = bt.total_return_pct >= 0 ? '+' : '';
                const dateStr = bt.saved_at ? new Date(bt.saved_at).toLocaleDateString('pt-BR') : '-';
                html += `
                    <div class="saved-bt-card" onclick="App.viewSavedBt('${bt.id}')">
                        <button class="bt-delete" onclick="event.stopPropagation(); App.deleteSavedBt('${bt.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <div class="bt-header">
                            <span class="bt-ticker">${bt.ticker}</span>
                            <span class="bt-date">${dateStr}</span>
                        </div>
                        <div class="bt-strategy">${bt.strategy}</div>
                        <div class="bt-return ${retColor}">${retSign}${bt.total_return_pct.toFixed(2)}%</div>
                    </div>
                `;
            });
            html += '</div>';
            content.innerHTML = html;
        } catch (e) {
            content.innerHTML = `<p style="color:var(--danger)">Erro ao carregar backtests: ${e.message}</p>`;
        }
    }

    async function viewSavedBt(id) {
        const content = document.getElementById('pageContent');
        content.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div></div>';

        try {
            const data = await API.getSavedBacktest(id);
            let html = `<button class="btn btn-ghost" onclick="App.navigate('saved-backtests')" style="margin-bottom:1rem"><i class="fas fa-arrow-left"></i> Voltar</button>`;
            const container = document.createElement('div');
            container.innerHTML = html;
            content.innerHTML = '';
            content.appendChild(container);

            const resultsDiv = document.createElement('div');
            content.appendChild(resultsDiv);
            renderSingleResult(data, resultsDiv);
        } catch (e) {
            content.innerHTML = `<p style="color:var(--danger)">Erro: ${e.message}</p>`;
        }
    }

    async function deleteSavedBt(id) {
        if (!confirm('Remover este back-test salvo?')) return;
        try {
            await API.deleteSavedBacktest(id);
            Utils.showToast('Back-test removido', 'success');
            renderSavedBacktests();
        } catch (e) {
            Utils.showToast('Erro ao remover: ' + e.message, 'error');
        }
    }

    // ============================================================
    // CONFIG PAGE
    // ============================================================

    async function renderConfig() {
        const content = document.getElementById('pageContent');

        // Se já tem PIN na sessão, mostra direto
        if (configPin) {
            renderConfigPanel(content);
            return;
        }

        // Mostra gate de PIN
        content.innerHTML = `
            <div class="pin-gate">
                <i class="fas fa-lock pin-icon"></i>
                <h2>Área Protegida</h2>
                <p>Digite o PIN de acesso para gerenciar dados, ativos e configurações do sistema.</p>
                <div class="pin-input-group">
                    <input type="password" id="pinInput" placeholder="PIN" maxlength="20"
                        onkeydown="if(event.key==='Enter') App.submitPin()">
                    <button class="btn btn-primary" onclick="App.submitPin()">
                        <i class="fas fa-unlock"></i> Entrar
                    </button>
                </div>
                <p id="pinError" style="color:var(--danger);display:none;font-size:0.85rem"></p>
            </div>
        `;

        document.getElementById('pinInput').focus();
    }

    async function submitPin() {
        const input = document.getElementById('pinInput');
        const error = document.getElementById('pinError');
        const pin = input.value.trim();

        if (!pin) { error.textContent = 'Digite o PIN'; error.style.display = 'block'; return; }

        try {
            const result = await API.verifyPin(pin);
            if (result.valid) {
                configPin = pin;
                renderConfigPanel(document.getElementById('pageContent'));
            } else {
                error.textContent = 'PIN incorreto';
                error.style.display = 'block';
                input.value = '';
                input.focus();
            }
        } catch (e) {
            error.textContent = 'Erro de conexão: ' + e.message;
            error.style.display = 'block';
        }
    }

    async function renderConfigPanel(content) {
        content.innerHTML = '<div class="loading-section"><div class="loading-spinner"></div></div>';

        let storageData = { stats: {}, assets: {} };
        try {
            storageData = await API.getStorageInfo(configPin);
        } catch {}

        const stats = storageData.stats || {};
        const assets = storageData.assets || {};

        // Build asset table rows
        let assetRows = '';
        const assetEntries = Object.entries(assets);
        if (assetEntries.length === 0) {
            assetRows = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Nenhum ativo salvo ainda</td></tr>';
        } else {
            assetEntries.forEach(([ticker, info]) => {
                const dailyInfo = info.daily ? `${info.daily.start} → ${info.daily.end} (${info.daily.records})` : '-';
                const intraInfo = info.intraday ? `${info.intraday.start} → ${info.intraday.end} (${info.intraday.records})` : '-';
                const lastUp = info.last_update ? new Date(info.last_update).toLocaleString('pt-BR') : '-';
                assetRows += `<tr>
                    <td class="ticker-cell">${ticker}</td>
                    <td class="date-cell">${dailyInfo}</td>
                    <td class="date-cell">${intraInfo}</td>
                    <td class="date-cell">${lastUp}</td>
                    <td class="actions-cell">
                        <button class="btn-delete-asset" onclick="App.deleteAsset('${ticker}')">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                    </td>
                </tr>`;
            });
        }

        const lastAutoUp = stats.last_auto_update ? new Date(stats.last_auto_update).toLocaleString('pt-BR') : 'Nunca';

        content.innerHTML = `
            <div class="config-layout">

                <!-- Storage Stats -->
                <div class="config-section">
                    <div class="config-section-header">
                        <h3><i class="fas fa-database"></i> Armazenamento</h3>
                    </div>
                    <div class="storage-stats-grid">
                        <div class="storage-stat-item"><span class="stat-value">${stats.total_assets || 0}</span><span class="stat-label">Ativos</span></div>
                        <div class="storage-stat-item"><span class="stat-value">${stats.daily_assets || 0}</span><span class="stat-label">Daily</span></div>
                        <div class="storage-stat-item"><span class="stat-value">${stats.intraday_assets || 0}</span><span class="stat-label">Intraday</span></div>
                        <div class="storage-stat-item"><span class="stat-value">${(stats.total_records || 0).toLocaleString('pt-BR')}</span><span class="stat-label">Registros</span></div>
                        <div class="storage-stat-item"><span class="stat-value">${stats.storage_size_mb || 0}</span><span class="stat-label">MB</span></div>
                        <div class="storage-stat-item"><span class="stat-value">${stats.total_backtests || 0}</span><span class="stat-label">BTs Salvos</span></div>
                    </div>
                </div>

                <!-- Atualização -->
                <div class="config-section">
                    <div class="config-section-header">
                        <h3><i class="fas fa-sync-alt"></i> Atualização de Dados</h3>
                    </div>
                    <div class="update-info">
                        <i class="fas fa-clock update-icon"></i>
                        <div class="update-text">
                            <h4>Atualização Automática: 18h (Brasília)</h4>
                            <p>Última atualização automática: ${lastAutoUp}</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="App.manualUpdate()" id="btnManualUpdate" style="width:100%">
                        <i class="fas fa-sync-alt"></i> Atualizar Todos os Ativos Agora
                    </button>
                    <div id="updateResult" style="margin-top:0.75rem"></div>
                </div>

                <!-- Download de Dados -->
                <div class="config-section full-width">
                    <div class="config-section-header">
                        <h3><i class="fas fa-download"></i> Baixar Dados de Ativo</h3>
                    </div>
                    <div class="config-form">
                        <div class="config-form-row">
                            <div class="config-form-group">
                                <label>Ticker</label>
                                <input type="text" id="dlTicker" placeholder="Ex: PETR4" style="text-transform:uppercase"
                                    oninput="App.onTickerInput()">
                                <div id="dlTickerValidation" class="ticker-validation"></div>
                            </div>
                            <div class="config-form-group">
                                <label>Data Início</label>
                                <input type="date" id="dlStartDate" value="${getDefaultStartDate()}">
                            </div>
                            <div class="config-form-group">
                                <label>Data Fim</label>
                                <input type="date" id="dlEndDate" value="${getTodayDate()}">
                            </div>
                            <div class="config-form-group">
                                <label>Timeframe</label>
                                <select id="dlTimeframe">
                                    <option value="daily" selected>Diário (1d)</option>
                                    <option value="intraday">Intraday (1h)</option>
                                </select>
                            </div>
                        </div>
                        <div class="config-form-actions">
                            <button class="btn btn-primary" onclick="App.downloadData()" id="btnDownload">
                                <i class="fas fa-download"></i> Baixar Dados
                            </button>
                        </div>
                        <div id="dlResult"></div>
                    </div>
                </div>

                <!-- Ativos Salvos -->
                <div class="config-section full-width">
                    <div class="config-section-header">
                        <h3><i class="fas fa-list"></i> Ativos Armazenados (${assetEntries.length})</h3>
                        <button class="btn btn-ghost btn-sm" onclick="App.refreshConfig()">
                            <i class="fas fa-refresh"></i> Atualizar
                        </button>
                    </div>
                    <div class="asset-table-container">
                        <table class="asset-table">
                            <thead><tr>
                                <th>Ticker</th>
                                <th>Daily (Início → Fim / Registros)</th>
                                <th>Intraday (Início → Fim / Registros)</th>
                                <th>Última Atualização</th>
                                <th>Ações</th>
                            </tr></thead>
                            <tbody>${assetRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- Alterar PIN -->
                <div class="config-section">
                    <div class="config-section-header">
                        <h3><i class="fas fa-key"></i> Alterar PIN</h3>
                    </div>
                    <div class="pin-change-form">
                        <div class="config-form-group">
                            <label>PIN Atual</label>
                            <input type="password" id="oldPin" placeholder="****">
                        </div>
                        <div class="config-form-group">
                            <label>Novo PIN</label>
                            <input type="password" id="newPin" placeholder="****">
                        </div>
                        <button class="btn btn-warning" onclick="App.changePin()" style="align-self:flex-end">
                            <i class="fas fa-key"></i> Alterar
                        </button>
                    </div>
                    <div id="pinChangeResult" style="margin-top:0.5rem"></div>
                </div>

                <!-- Sair -->
                <div class="config-section">
                    <div class="config-section-header">
                        <h3><i class="fas fa-sign-out-alt"></i> Sessão</h3>
                    </div>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem">Ao sair, o PIN da sessão será esquecido. Você precisará digitá-lo novamente.</p>
                    <button class="btn btn-danger" onclick="App.logoutConfig()" style="width:100%">
                        <i class="fas fa-sign-out-alt"></i> Sair das Configurações
                    </button>
                </div>

            </div>
        `;
    }

    // ============================================================
    // CONFIG ACTIONS
    // ============================================================

    let _tickerValidateTimeout = null;

    function onTickerInput() {
        const input = document.getElementById('dlTicker');
        const validation = document.getElementById('dlTickerValidation');
        const ticker = input.value.toUpperCase().trim();

        if (_tickerValidateTimeout) clearTimeout(_tickerValidateTimeout);

        if (ticker.length < 3) {
            validation.innerHTML = '';
            validation.className = 'ticker-validation';
            return;
        }

        validation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
        validation.className = 'ticker-validation loading';

        _tickerValidateTimeout = setTimeout(async () => {
            try {
                const result = await API.validateTicker(ticker, configPin);
                if (result.valid) {
                    validation.innerHTML = `<i class="fas fa-check-circle"></i> ${result.name || ticker} — R$ ${result.last_price}`;
                    validation.className = 'ticker-validation valid';
                } else {
                    validation.innerHTML = '<i class="fas fa-times-circle"></i> Ticker inválido ou sem dados';
                    validation.className = 'ticker-validation invalid';
                }
            } catch {
                validation.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro ao validar';
                validation.className = 'ticker-validation invalid';
            }
        }, 800);
    }

    async function downloadData() {
        const ticker = document.getElementById('dlTicker').value.toUpperCase().trim();
        const startDate = document.getElementById('dlStartDate').value;
        const endDate = document.getElementById('dlEndDate').value;
        const timeframe = document.getElementById('dlTimeframe').value;
        const result = document.getElementById('dlResult');
        const btn = document.getElementById('btnDownload');

        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }
        if (!startDate || !endDate) { Utils.showToast('Selecione as datas', 'warning'); return; }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...';
        result.innerHTML = '';

        try {
            const data = await API.downloadData(ticker, startDate, endDate, timeframe, configPin);
            if (data.success) {
                result.innerHTML = `<p style="color:var(--success);margin-top:0.5rem"><i class="fas fa-check-circle"></i> ${data.message} (${data.execution_time}s)</p>`;
                Utils.showToast(`${ticker}: ${data.records} registros baixados`, 'success');
                refreshConfig();
                updateStorageIndicator();
            } else {
                result.innerHTML = `<p style="color:var(--danger);margin-top:0.5rem"><i class="fas fa-times-circle"></i> ${data.message}</p>`;
            }
        } catch (e) {
            result.innerHTML = `<p style="color:var(--danger);margin-top:0.5rem"><i class="fas fa-times-circle"></i> Erro: ${e.message}</p>`;
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados';
    }

    async function manualUpdate() {
        const btn = document.getElementById('btnManualUpdate');
        const result = document.getElementById('updateResult');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando todos os ativos...';
        result.innerHTML = '';

        try {
            const data = await API.manualUpdate(configPin);
            result.innerHTML = `<p style="color:var(--success)"><i class="fas fa-check-circle"></i> Atualização concluída: ${data.updated} atualizados, ${data.errors} erros (${data.execution_time}s)</p>`;
            Utils.showToast('Atualização concluída', 'success');
            refreshConfig();
            updateStorageIndicator();
        } catch (e) {
            result.innerHTML = `<p style="color:var(--danger)"><i class="fas fa-times-circle"></i> Erro: ${e.message}</p>`;
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Todos os Ativos Agora';
    }

    async function deleteAsset(ticker) {
        if (!confirm(`Remover todos os dados de ${ticker}? Esta ação não pode ser desfeita.`)) return;

        try {
            await API.deleteAsset(ticker, configPin);
            Utils.showToast(`${ticker} removido`, 'success');
            refreshConfig();
            updateStorageIndicator();
        } catch (e) {
            Utils.showToast('Erro: ' + e.message, 'error');
        }
    }

    async function changePin() {
        const oldPin = document.getElementById('oldPin').value;
        const newPin = document.getElementById('newPin').value;
        const result = document.getElementById('pinChangeResult');

        if (!oldPin || !newPin) { Utils.showToast('Preencha os dois campos', 'warning'); return; }
        if (newPin.length < 4) { Utils.showToast('PIN deve ter pelo menos 4 caracteres', 'warning'); return; }

        try {
            await API.changePin(oldPin, newPin);
            configPin = newPin;
            result.innerHTML = '<p style="color:var(--success)"><i class="fas fa-check-circle"></i> PIN alterado com sucesso!</p>';
            document.getElementById('oldPin').value = '';
            document.getElementById('newPin').value = '';
            Utils.showToast('PIN alterado', 'success');
        } catch (e) {
            result.innerHTML = `<p style="color:var(--danger)"><i class="fas fa-times-circle"></i> ${e.message}</p>`;
        }
    }

    function logoutConfig() {
        configPin = null;
        renderConfig();
    }

    function refreshConfig() {
        if (configPin) renderConfigPanel(document.getElementById('pageContent'));
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function renderStatCard(title, value, icon, color) {
        return `
            <div class="stat-card">
                <div class="stat-icon" style="color:${color}"><i class="${icon}"></i></div>
                <div class="stat-info">
                    <span class="stat-value" style="color:${color}">${value}</span>
                    <span class="stat-label">${title}</span>
                </div>
            </div>
        `;
    }

    function renderStatCardSkeleton(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += '<div class="stat-card skeleton" style="height:80px"></div>';
        }
        return html;
    }

    function getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    function getDefaultStartDate() {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    document.addEventListener('DOMContentLoaded', init);

    return {
        navigate,
        runBulk,
        runSingle,
        runAndSave,
        runCompare,
        submitPin,
        downloadData,
        manualUpdate,
        deleteAsset,
        changePin,
        logoutConfig,
        refreshConfig,
        onTickerInput,
        viewSavedBt,
        deleteSavedBt,
        _switchBtTab,
    };
})();
