/**
 * Trade Halley - App Principal v3.0
 * SPA completa com Estratégias, Back-tests, Config, Salvos
 */
const App = (() => {
    let currentPage = 'dashboard';
    let cachedStrategies = null;
    let configPin = null;

    // ============================================================
    // HELPERS
    // ============================================================

    function statCard(label, value, icon, color) {
        return `<div class="stat-card">
            <div class="stat-header">
                <span class="stat-label">${label}</span>
                <div class="stat-icon" style="background:${color}22;color:${color}"><i class="${icon}"></i></div>
            </div>
            <div class="stat-value" style="color:${color}">${value}</div>
        </div>`;
    }

    function statSkeleton(n) {
        let h = '';
        for (let i = 0; i < n; i++) h += '<div class="stat-card" style="min-height:100px"><div class="loading-inline"><div class="spinner-sm"></div></div></div>';
        return h;
    }

    function loadingHTML(msg = '') {
        return `<div class="loading-inline"><div class="spinner-sm"></div><span>${msg || 'Carregando...'}</span></div>`;
    }

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
            const ov = document.getElementById('loadingOverlay');
            if (ov) ov.classList.remove('active');
        }, 1200);
    }

    // ============================================================
    // NAVIGATION
    // ============================================================

    function setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(item.dataset.page);
                if (window.innerWidth < 768) closeMobile();
            });
        });
    }

    function navigate(page) {
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const act = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (act) act.classList.add('active');

        const titles = {
            'dashboard': 'Dashboard',
            'b3-daily': 'Back-Tests B3 Daily',
            'b3-intraday': 'Back-Tests B3 Intraday',
            'bmf-intraday': 'Back-Tests BMF Intraday',
            'strategies': 'Estratégias',
            'saved-backtests': 'Backtests Salvos',
            'config': 'Configurações',
        };
        document.getElementById('pageTitle').textContent = titles[page] || 'Trade Halley';

        const content = document.getElementById('pageContent');
        content.innerHTML = loadingHTML();
        Charts.destroyAll();

        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'b3-daily': renderBacktestPage('b3', '1d'); break;
            case 'b3-intraday': renderBacktestPage('b3', '1h'); break;
            case 'bmf-intraday': renderBacktestPage('bmf', '1h'); break;
            case 'strategies': renderStrategiesPage(); break;
            case 'saved-backtests': renderSavedBacktests(); break;
            case 'config': renderConfig(); break;
        }
    }

    // ============================================================
    // MOBILE
    // ============================================================

    function setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const close = document.getElementById('sidebarClose');
        const overlay = document.getElementById('sidebarOverlay');

        if (toggle) toggle.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            close.style.display = 'flex';
        });
        if (close) close.addEventListener('click', closeMobile);
        if (overlay) overlay.addEventListener('click', closeMobile);
    }

    function closeMobile() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
        document.getElementById('sidebarClose').style.display = 'none';
    }

    // ============================================================
    // MARKET STATUS
    // ============================================================

    function updateMarketStatus() {
        const el = document.getElementById('marketStatus');
        if (!el) return;
        const open = Utils.isMarketOpen();
        el.innerHTML = `<span class="status-dot${open ? '' : ' closed'}"></span><span>${open ? 'Mercado Aberto' : 'Mercado Fechado'}</span>`;
    }

    async function updateStorageIndicator() {
        const el = document.getElementById('storageText');
        if (!el) return;
        try {
            const d = await API.getStorageStats();
            el.textContent = `${d.total_assets || 0} ativos • ${d.total_records || 0} reg`;
        } catch { el.textContent = 'Conectado'; }
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    async function renderDashboard() {
        const content = document.getElementById('pageContent');
        content.innerHTML = `
            <div class="stats-grid" id="dashStats">${statSkeleton(4)}</div>
            <div class="grid-2 section-gap">
                <div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-chart-line"></i> IBOV</span></div>
                    <div class="card-body"><div class="chart-container"><canvas id="ibovChart"></canvas></div><p id="ibovFallback" style="display:none;color:var(--text-muted);text-align:center;padding:2rem"></p></div></div>
                <div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-dollar-sign"></i> Dólar (USD/BRL)</span></div>
                    <div class="card-body"><div class="chart-container"><canvas id="dolarChart"></canvas></div><p id="dolarFallback" style="display:none;color:var(--text-muted);text-align:center;padding:2rem"></p></div></div>
            </div>
            <div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-table"></i> Visão de Mercado</span></div>
                <div class="card-body" id="marketTableBody">${loadingHTML()}</div></div>`;

        // Stats
        try {
            const d = await API.getDashboardSummary();
            const s = document.getElementById('dashStats');
            if (s) s.innerHTML = `
                ${statCard('Ações B3', d.total_b3 || 0, 'fas fa-building', '#00e676')}
                ${statCard('Futuros BMF', d.total_bmf || 0, 'fas fa-exchange-alt', '#ffc107')}
                ${statCard('Estratégias', d.total_strategies || 0, 'fas fa-brain', '#2979ff')}
                ${statCard('Ativos Salvos', d.total_assets || 0, 'fas fa-database', '#69f0ae')}`;

            // Market table
            const tb = document.getElementById('marketTableBody');
            if (tb && d.top_tickers && d.top_tickers.length) {
                let h = '<div class="table-container"><table class="data-table"><thead><tr><th>Ativo</th><th>Nome</th><th>Preço</th><th>Variação</th><th>Volume</th></tr></thead><tbody>';
                d.top_tickers.forEach(a => {
                    const pct = a.change_pct || 0;
                    const col = pct >= 0 ? 'positive' : 'negative';
                    const arrow = pct >= 0 ? '▲' : '▼';
                    h += `<tr><td class="ticker-cell">${a.ticker}</td><td>${a.name||'-'}</td><td>R$ ${(a.price||0).toFixed(2)}</td><td class="${col}" style="font-weight:700">${arrow} ${Math.abs(pct).toFixed(2)}%</td><td>${a.volume ? Utils.formatVolume(a.volume) : '-'}</td></tr>`;
                });
                h += '</tbody></table></div>';
                tb.innerHTML = h;
            } else if (tb) {
                tb.innerHTML = '<p style="color:var(--text-muted)">Nenhum dado de mercado disponível.</p>';
            }
        } catch (e) { console.error('Dashboard:', e); }

        // Charts
        for (const [canvasId, fallbackId, tickers, label] of [
            ['ibovChart', 'ibovFallback', ['BOVA11', 'IBOV'], 'IBOV'],
            ['dolarChart', 'dolarFallback', ['DOLAR', 'USDBRL=X'], 'USD/BRL'],
        ]) {
            let loaded = false;
            for (const t of tickers) {
                try {
                    const data = await API.getMarketData(t, '6mo', '1d');
                    if (data && data.data && data.data.length > 5) {
                        Charts.priceLine(canvasId, data.data, label);
                        loaded = true; break;
                    }
                } catch {}
            }
            if (!loaded) {
                const cv = document.getElementById(canvasId);
                const fb = document.getElementById(fallbackId);
                if (cv) cv.style.display = 'none';
                if (fb) { fb.style.display = 'block'; fb.textContent = 'Gráfico indisponível'; }
            }
        }
    }

    // ============================================================
    // BACKTEST PAGES
    // ============================================================

    async function renderBacktestPage(market, interval) {
        const content = document.getElementById('pageContent');
        try {
            const s = await API.getStrategies();
            cachedStrategies = s.strategies || [];
        } catch { cachedStrategies = []; }

        const opts = cachedStrategies.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join('');

        content.innerHTML = `
        <div class="card section-gap">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-cogs"></i> Configuração</span>
                <div class="card-actions">
                    <div class="tab-nav" id="btTabs">
                        <button class="tab-btn active" data-tab="bulk">Todos os Ativos</button>
                        <button class="tab-btn" data-tab="single">Individual</button>
                        <button class="tab-btn" data-tab="compare">Comparar</button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <!-- BULK -->
                <div id="tabBulk" class="tab-panel">
                    <div class="filter-bar">
                        <div class="form-group"><label class="form-label">Estratégia</label><select class="form-select" id="bulkStrategy">${opts}</select></div>
                        <div class="form-group"><label class="form-label">Período</label><select class="form-select" id="bulkPeriod"><option value="3mo">3 Meses</option><option value="6mo">6 Meses</option><option value="1y" selected>1 Ano</option><option value="2y">2 Anos</option></select></div>
                        <div class="form-group"><label class="form-label">Capital (R$)</label><input class="form-input" type="number" id="bulkCapital" value="10000" min="100"></div>
                        <div class="form-group" style="justify-content:flex-end"><label class="form-label">&nbsp;</label><button class="btn btn-primary" id="btnRunBulk"><i class="fas fa-play"></i> Executar</button></div>
                    </div>
                </div>
                <!-- SINGLE -->
                <div id="tabSingle" class="tab-panel" style="display:none">
                    <div class="filter-bar">
                        <div class="form-group"><label class="form-label">Ticker</label><input class="form-input" type="text" id="singleTicker" placeholder="Ex: PETR4" style="text-transform:uppercase"></div>
                        <div class="form-group"><label class="form-label">Estratégia</label><select class="form-select" id="singleStrategy">${opts}</select></div>
                        <div class="form-group"><label class="form-label">Período</label><select class="form-select" id="singlePeriod"><option value="3mo">3M</option><option value="6mo">6M</option><option value="1y" selected>1A</option><option value="2y">2A</option></select></div>
                        <div class="form-group"><label class="form-label">Capital</label><input class="form-input" type="number" id="singleCapital" value="10000" min="100"></div>
                        <div class="form-group" style="justify-content:flex-end;gap:6px"><label class="form-label">&nbsp;</label>
                            <button class="btn btn-primary" id="btnRunSingle"><i class="fas fa-play"></i> Analisar</button>
                            <button class="btn btn-ghost" id="btnSaveSingle" title="Executar e Salvar"><i class="fas fa-save"></i></button>
                        </div>
                    </div>
                </div>
                <!-- COMPARE -->
                <div id="tabCompare" class="tab-panel" style="display:none">
                    <div class="filter-bar">
                        <div class="form-group"><label class="form-label">Ticker</label><input class="form-input" type="text" id="compareTicker" placeholder="Ex: PETR4" style="text-transform:uppercase"></div>
                        <div class="form-group"><label class="form-label">Período</label><select class="form-select" id="comparePeriod"><option value="3mo">3M</option><option value="6mo">6M</option><option value="1y" selected>1A</option><option value="2y">2A</option></select></div>
                        <div class="form-group"><label class="form-label">Capital</label><input class="form-input" type="number" id="compareCapital" value="10000" min="100"></div>
                        <div class="form-group" style="justify-content:flex-end"><label class="form-label">&nbsp;</label><button class="btn btn-primary" id="btnRunCompare"><i class="fas fa-play"></i> Comparar</button></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="btResults"></div>`;

        // Tab switching
        document.querySelectorAll('#btTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#btTabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ['Bulk','Single','Compare'].forEach(t => {
                    const el = document.getElementById('tab'+t);
                    if (el) el.style.display = btn.dataset.tab === t.toLowerCase() ? '' : 'none';
                });
                document.getElementById('btResults').innerHTML = '';
            });
        });

        // Buttons
        document.getElementById('btnRunBulk').addEventListener('click', () => doBulk(market, interval));
        document.getElementById('btnRunSingle').addEventListener('click', () => doSingle(interval, false));
        document.getElementById('btnSaveSingle').addEventListener('click', () => doSingle(interval, true));
        document.getElementById('btnRunCompare').addEventListener('click', () => doCompare(interval));
    }

    async function doBulk(market, interval) {
        const res = document.getElementById('btResults');
        const strategy = document.getElementById('bulkStrategy').value;
        const period = document.getElementById('bulkPeriod').value;
        const capital = document.getElementById('bulkCapital').value;
        res.innerHTML = `<div class="card"><div class="card-body">${loadingHTML('Executando back-tests... pode levar alguns minutos.')}</div></div>`;
        try {
            const data = await API.runBulkBacktest(market, strategy, period, interval, capital);
            if (!data.results || !data.results.length) { res.innerHTML = '<div class="card"><div class="card-body"><p style="color:var(--text-muted)">Nenhum resultado.</p></div></div>'; return; }
            let h = `<div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-trophy"></i> Resultados — ${data.strategy || strategy} (${data.total_assets} ativos, ${data.execution_time}s)</span></div><div class="card-body no-padding"><div class="table-container"><table class="data-table"><thead><tr><th>#</th><th>Ativo</th><th>Retorno %</th><th>Win Rate</th><th>Trades</th><th>PF</th><th>Max DD</th><th>Sharpe</th><th>Equity Final</th></tr></thead><tbody>`;
            data.results.forEach((r, i) => {
                const c = r.total_return_pct >= 0 ? 'positive' : 'negative';
                h += `<tr><td>${i+1}</td><td class="ticker-cell">${r.ticker}</td><td class="${c}" style="font-weight:700">${r.total_return_pct.toFixed(2)}%</td><td>${r.win_rate.toFixed(1)}%</td><td>${r.total_trades}</td><td>${r.profit_factor.toFixed(2)}</td><td class="negative">${r.max_drawdown_pct.toFixed(2)}%</td><td>${r.sharpe_ratio.toFixed(2)}</td><td>R$ ${r.final_equity.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`;
            });
            h += '</tbody></table></div></div></div>';
            res.innerHTML = h;
        } catch (e) { res.innerHTML = `<div class="card"><div class="card-body"><p class="negative">Erro: ${e.message}</p></div></div>`; }
    }

    async function doSingle(interval, save) {
        const ticker = document.getElementById('singleTicker').value.toUpperCase().trim();
        const strategy = document.getElementById('singleStrategy').value;
        const period = document.getElementById('singlePeriod').value;
        const capital = document.getElementById('singleCapital').value;
        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }
        const res = document.getElementById('btResults');
        res.innerHTML = `<div class="card"><div class="card-body">${loadingHTML('Executando...')}</div></div>`;
        try {
            const data = await API.runBacktest(ticker, strategy, period, interval, capital);
            if (save && data) {
                try {
                    const saved = await API.saveBacktest(data);
                    Utils.showToast(`Salvo! ID: ${saved.id}`, 'success');
                } catch (se) { Utils.showToast('Erro ao salvar: ' + se.message, 'error'); }
            }
            renderSingleResult(data, res);
        } catch (e) { res.innerHTML = `<div class="card"><div class="card-body"><p class="negative">Erro: ${e.message}</p></div></div>`; }
    }

    function renderSingleResult(data, container) {
        const m = data.metrics;
        const rc = m.total_return_pct >= 0 ? '#00e676' : '#ff1744';
        let h = `<div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-chart-line"></i> ${data.ticker} — ${data.strategy_name}</span></div><div class="card-body">
            <div class="stats-grid">
                ${statCard('Retorno', `${m.total_return_pct.toFixed(2)}%`, 'fas fa-percentage', rc)}
                ${statCard('Win Rate', `${m.win_rate.toFixed(1)}%`, 'fas fa-bullseye', '#2979ff')}
                ${statCard('Trades', m.total_trades, 'fas fa-exchange-alt', '#ffc107')}
                ${statCard('Sharpe', m.sharpe_ratio.toFixed(2), 'fas fa-chart-bar', '#00e676')}
            </div>
            <div class="grid-2" style="margin-top:1.5rem">
                <div class="chart-container"><canvas id="eqChart"></canvas></div>
                <div class="chart-container"><canvas id="wrChart"></canvas></div>
            </div>
            <div style="margin-top:1.5rem">
                <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
                    <div class="stat-card"><div class="stat-label">Capital Inicial</div><div class="stat-value" style="font-size:16px">R$ ${m.initial_capital.toLocaleString('pt-BR')}</div></div>
                    <div class="stat-card"><div class="stat-label">Equity Final</div><div class="stat-value" style="font-size:16px;color:${rc}">R$ ${m.final_equity.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
                    <div class="stat-card"><div class="stat-label">Profit Factor</div><div class="stat-value" style="font-size:16px">${m.profit_factor.toFixed(2)}</div></div>
                    <div class="stat-card"><div class="stat-label">Max Drawdown</div><div class="stat-value negative" style="font-size:16px">${m.max_drawdown_pct.toFixed(2)}%</div></div>
                    <div class="stat-card"><div class="stat-label">Sortino</div><div class="stat-value" style="font-size:16px">${m.sortino_ratio.toFixed(2)}</div></div>
                    <div class="stat-card"><div class="stat-label">Trades +</div><div class="stat-value positive" style="font-size:16px">${m.winning_trades}</div></div>
                    <div class="stat-card"><div class="stat-label">Trades -</div><div class="stat-value negative" style="font-size:16px">${m.losing_trades}</div></div>
                    <div class="stat-card"><div class="stat-label">Média Win</div><div class="stat-value" style="font-size:16px">R$ ${m.avg_win.toFixed(2)}</div></div>
                    <div class="stat-card"><div class="stat-label">Média Loss</div><div class="stat-value" style="font-size:16px">R$ ${m.avg_loss.toFixed(2)}</div></div>
                </div>
            </div>
        </div></div>`;
        container.innerHTML = h;
        if (data.equity_curve && data.equity_curve.length) Charts.equityCurve('eqChart', data.equity_curve, m.initial_capital);
        Charts.winRateDonut('wrChart', m.winning_trades, m.losing_trades);
    }

    async function doCompare(interval) {
        const ticker = document.getElementById('compareTicker').value.toUpperCase().trim();
        const period = document.getElementById('comparePeriod').value;
        const capital = document.getElementById('compareCapital').value;
        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }
        const res = document.getElementById('btResults');
        res.innerHTML = `<div class="card"><div class="card-body">${loadingHTML('Comparando todas as estratégias...')}</div></div>`;
        try {
            const data = await API.compareStrategies(ticker, period, interval, capital);
            if (!data.results || !data.results.length) { res.innerHTML = '<div class="card"><div class="card-body"><p style="color:var(--text-muted)">Nenhum resultado.</p></div></div>'; return; }
            let h = `<div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-ranking-star"></i> Ranking — ${data.ticker} (${data.strategies_tested} estratégias)</span></div><div class="card-body no-padding"><div class="table-container"><table class="data-table"><thead><tr><th>#</th><th>Estratégia</th><th>Categoria</th><th>Retorno %</th><th>Win Rate</th><th>PF</th><th>Max DD</th><th>Sharpe</th><th>Trades</th></tr></thead><tbody>`;
            data.results.forEach((r, i) => {
                const c = r.total_return_pct >= 0 ? 'positive' : 'negative';
                const medal = i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}`;
                h += `<tr${i===0 ? ' style="background:rgba(0,230,118,0.04)"' : ''}><td>${medal}</td><td><strong>${r.strategy_name}</strong></td><td><span class="badge badge-blue">${r.category}</span></td><td class="${c}" style="font-weight:700">${r.total_return_pct.toFixed(2)}%</td><td>${r.win_rate.toFixed(1)}%</td><td>${r.profit_factor.toFixed(2)}</td><td class="negative">${r.max_drawdown_pct.toFixed(2)}%</td><td>${r.sharpe_ratio.toFixed(2)}</td><td>${r.total_trades}</td></tr>`;
            });
            h += '</tbody></table></div></div></div>';
            res.innerHTML = h;
        } catch (e) { res.innerHTML = `<div class="card"><div class="card-body"><p class="negative">Erro: ${e.message}</p></div></div>`; }
    }

        // ============================================================
    // STRATEGIES PAGE — Trade Certo style, by timeframe
    // ============================================================

    const TRADE_CERTO_STRATEGIES = {
        daily: {
            label: 'B3 Daily',
            icon: 'fas fa-chart-bar',
            desc: 'Estratégias para timeframe diário — Ações B3',
            entry: [
                { id: 'pct_prev_close', name: 'X% do Fechamento Anterior', desc: 'Compra quando o preço cai X% em relação ao fechamento do dia anterior. Valor de X configurável (ex: -1%, -2%, etc.).', params: ['variation_pct'] },
                { id: 'pct_prev_close_sniper', name: 'X% do Fechamento Anterior (Sniper)', desc: 'Igual à anterior, mas só entra se o preço TOCA exatamente o alvo durante o pregão, sem gap de abertura. Mais seletivo.', params: ['variation_pct'] },
                { id: 'pct_prev_open', name: 'X% da Abertura Anterior', desc: 'Compra quando o preço cai X% em relação à abertura do dia anterior.', params: ['variation_pct'] },
                { id: 'pct_prev_open_sniper', name: 'X% da Abertura Anterior (Sniper)', desc: 'Versão Sniper: só entra se o preço toca o alvo durante o pregão, ignorando gaps.', params: ['variation_pct'] },
                { id: 'pct_current_open', name: 'X% da Abertura do Dia', desc: 'Compra quando o preço cai X% em relação à abertura do dia atual (abertura corrente).', params: ['variation_pct'] },
                { id: 'pct_current_open_sniper', name: 'X% da Abertura do Dia (Sniper)', desc: 'Versão Sniper: entra somente se o preço atinge o alvo a partir da abertura do dia corrente.', params: ['variation_pct'] },
                { id: 'day_open', name: 'Abertura do Dia', desc: 'Compra na abertura do pregão (primeiro preço do dia).', params: [] },
                { id: 'day_close', name: 'Fechamento do Dia', desc: 'Compra no fechamento do pregão (último preço do dia).', params: [] },
            ],
            exit: [
                { id: 'exit_day_close', name: 'Fechamento do Dia', desc: 'Encerra a posição no fechamento do mesmo dia da entrada.', params: [] },
                { id: 'exit_next_open', name: 'Abertura do Dia Seguinte', desc: 'Encerra a posição na abertura do dia seguinte à entrada.', params: [] },
                { id: 'exit_next_close', name: 'Fechamento do Dia Seguinte', desc: 'Encerra a posição no fechamento do dia seguinte à entrada.', params: [] },
            ],
        },
        intraday_b3: {
            label: 'B3 Intraday',
            icon: 'fas fa-chart-area',
            desc: 'Estratégias para timeframe intraday — Ações B3 (5 min / 1h)',
            entry: [
                { id: 'intra_pct_prev_close', name: 'X% do Fechamento Anterior', desc: 'Entra quando o preço atinge X% abaixo do fechamento do dia anterior (intraday).', params: ['variation_pct'] },
                { id: 'intra_pct_prev_close_sniper', name: 'X% Fechamento Anterior (Sniper)', desc: 'Versão Sniper intraday — sem gap, preço deve tocar o alvo durante o dia.', params: ['variation_pct'] },
                { id: 'intra_pct_prev_open', name: 'X% da Abertura Anterior', desc: 'Entrada baseada em X% de variação sobre a abertura do dia anterior.', params: ['variation_pct'] },
                { id: 'intra_pct_prev_open_sniper', name: 'X% Abertura Anterior (Sniper)', desc: 'Versão Sniper.', params: ['variation_pct'] },
                { id: 'intra_pct_current_open', name: 'X% da Abertura do Dia', desc: 'Entrada quando o preço cai X% em relação à abertura do dia corrente.', params: ['variation_pct'] },
                { id: 'intra_pct_current_open_sniper', name: 'X% Abertura do Dia (Sniper)', desc: 'Versão Sniper.', params: ['variation_pct'] },
                { id: 'intra_bb_lower', name: 'Toque na Banda Inferior de Bollinger', desc: 'Entrada quando o preço toca ou rompe a banda inferior de Bollinger (período e desvio configuráveis).', params: ['period', 'std_dev'] },
                { id: 'intra_bb_upper', name: 'Toque na Banda Superior de Bollinger', desc: 'Entrada quando o preço toca ou rompe a banda superior de Bollinger.', params: ['period', 'std_dev'] },
                { id: 'intra_sma_touch', name: 'Toque na Média Móvel Simples', desc: 'Entrada quando o preço toca a SMA de período configurável.', params: ['period'] },
                { id: 'intra_ema_touch', name: 'Toque na Média Móvel Exponencial', desc: 'Entrada quando o preço toca a EMA de período configurável.', params: ['period'] },
                { id: 'intra_specific_time', name: 'Horário Específico', desc: 'Entrada em horário exato configurável (ex: 10:30, 14:00).', params: ['time'] },
                { id: 'intra_day_open', name: 'Abertura do Dia', desc: 'Entrada no primeiro candle do dia.', params: [] },
                { id: 'intra_day_close', name: 'Fechamento do Dia', desc: 'Entrada no último candle antes do leilão de fechamento.', params: [] },
            ],
            exit: [
                { id: 'exit_intra_day_close', name: 'Fechamento do Dia (Leilão)', desc: 'Encerra no fechamento do pregão ou antes do leilão.', params: [] },
                { id: 'exit_intra_pct_profit', name: 'Percentual de Lucro (Gain %)', desc: 'Encerra quando atinge X% de lucro sobre o preço de entrada.', params: ['gain_pct'] },
                { id: 'exit_intra_pct_loss', name: 'Stop-Loss %', desc: 'Encerra quando a perda atinge X% sobre o preço de entrada.', params: ['stop_pct'] },
                { id: 'exit_intra_specific_time', name: 'Horário Específico', desc: 'Encerra em horário exato (ex: 16:45).', params: ['time'] },
                { id: 'exit_intra_bb_upper', name: 'Banda Superior de Bollinger', desc: 'Encerra quando o preço atinge a banda superior.', params: ['period', 'std_dev'] },
                { id: 'exit_intra_bb_lower', name: 'Banda Inferior de Bollinger', desc: 'Encerra quando o preço atinge a banda inferior.', params: ['period', 'std_dev'] },
                { id: 'exit_intra_sma', name: 'Média Móvel Simples', desc: 'Encerra quando o preço cruza a SMA.', params: ['period'] },
                { id: 'exit_intra_ema', name: 'Média Móvel Exponencial', desc: 'Encerra quando o preço cruza a EMA.', params: ['period'] },
                { id: 'exit_intra_next_open', name: 'Abertura do Dia Seguinte', desc: 'Encerra na abertura do próximo pregão (swing overnight).', params: [] },
            ],
        },
        intraday_bmf: {
            label: 'BMF Intraday',
            icon: 'fas fa-exchange-alt',
            desc: 'Estratégias para futuros BMF — Intraday (5 min / 1h)',
            entry: [
                { id: 'bmf_pct_prev_close', name: 'X% do Fechamento Anterior', desc: 'Entrada baseada em variação % do fechamento do dia anterior (futuros).', params: ['variation_pct'] },
                { id: 'bmf_pct_prev_close_sniper', name: 'X% Fechamento Anterior (Sniper)', desc: 'Versão Sniper para futuros.', params: ['variation_pct'] },
                { id: 'bmf_pct_prev_open', name: 'X% da Abertura Anterior', desc: 'Entrada baseada em variação % da abertura anterior.', params: ['variation_pct'] },
                { id: 'bmf_pct_prev_open_sniper', name: 'X% Abertura Anterior (Sniper)', desc: 'Versão Sniper.', params: ['variation_pct'] },
                { id: 'bmf_pct_current_open', name: 'X% da Abertura do Dia', desc: 'Entrada em X% da abertura corrente.', params: ['variation_pct'] },
                { id: 'bmf_pct_current_open_sniper', name: 'X% Abertura do Dia (Sniper)', desc: 'Versão Sniper.', params: ['variation_pct'] },
                { id: 'bmf_bb_lower', name: 'Toque na Banda Inferior de Bollinger', desc: 'Entrada na banda inferior de Bollinger.', params: ['period', 'std_dev'] },
                { id: 'bmf_bb_upper', name: 'Toque na Banda Superior de Bollinger', desc: 'Entrada na banda superior.', params: ['period', 'std_dev'] },
                { id: 'bmf_sma_touch', name: 'Toque na Média Móvel Simples', desc: 'Entrada quando preço toca SMA.', params: ['period'] },
                { id: 'bmf_ema_touch', name: 'Toque na Média Móvel Exponencial', desc: 'Entrada quando preço toca EMA.', params: ['period'] },
                { id: 'bmf_specific_time', name: 'Horário Específico', desc: 'Entrada em horário exato.', params: ['time'] },
                { id: 'bmf_day_open', name: 'Abertura do Dia', desc: 'Entrada no primeiro candle do dia.', params: [] },
                { id: 'bmf_day_close', name: 'Fechamento do Dia', desc: 'Entrada no último candle.', params: [] },
            ],
            exit: [
                { id: 'exit_bmf_day_close', name: 'Fechamento do Dia', desc: 'Encerra no fechamento do pregão.', params: [] },
                { id: 'exit_bmf_pct_profit', name: 'Percentual de Lucro (Gain %)', desc: 'Saída ao atingir X% de lucro.', params: ['gain_pct'] },
                { id: 'exit_bmf_pct_loss', name: 'Stop-Loss %', desc: 'Saída ao atingir X% de perda.', params: ['stop_pct'] },
                { id: 'exit_bmf_specific_time', name: 'Horário Específico', desc: 'Saída em horário exato.', params: ['time'] },
                { id: 'exit_bmf_bb_upper', name: 'Banda Superior de Bollinger', desc: 'Saída na banda superior.', params: ['period', 'std_dev'] },
                { id: 'exit_bmf_bb_lower', name: 'Banda Inferior de Bollinger', desc: 'Saída na banda inferior.', params: ['period', 'std_dev'] },
                { id: 'exit_bmf_sma', name: 'Média Móvel Simples', desc: 'Saída ao cruzar SMA.', params: ['period'] },
                { id: 'exit_bmf_ema', name: 'Média Móvel Exponencial', desc: 'Saída ao cruzar EMA.', params: ['period'] },
                { id: 'exit_bmf_next_open', name: 'Abertura do Dia Seguinte', desc: 'Encerra na abertura do próximo dia.', params: [] },
            ],
        },
    };

    async function renderStrategiesPage() {
        const content = document.getElementById('pageContent');

        const timeframes = Object.entries(TRADE_CERTO_STRATEGIES);

        let tabBtns = '';
        let tabPanels = '';

        timeframes.forEach(([tfId, tf], i) => {
            tabBtns += `<button class="tab-btn${i===0?' active':''}" data-stab="${tfId}">${tf.label}</button>`;

            const entryCards = tf.entry.map(s => `
                <div class="strategy-card">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                        <div class="strategy-name">${s.name}</div>
                        <span class="badge badge-green" style="font-size:10px">Entrada</span>
                    </div>
                    <div class="strategy-desc">${s.desc}</div>
                    ${s.params.length ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${s.params.map(p => `<span class="badge badge-yellow" style="font-size:10px">${p}</span>`).join('')}</div>` : ''}
                </div>`).join('');

            const exitCards = tf.exit.map(s => `
                <div class="strategy-card" style="border-left:3px solid var(--red-primary)">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                        <div class="strategy-name">${s.name}</div>
                        <span class="badge badge-red" style="font-size:10px">Saída</span>
                    </div>
                    <div class="strategy-desc">${s.desc}</div>
                    ${s.params.length ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${s.params.map(p => `<span class="badge badge-yellow" style="font-size:10px">${p}</span>`).join('')}</div>` : ''}
                </div>`).join('');

            tabPanels += `
            <div id="sTab_${tfId}" class="stab-panel" style="${i>0?'display:none':''}">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem">
                    <i class="${tf.icon}" style="color:var(--green-primary)"></i>
                    <span style="color:var(--text-muted);font-size:13px">${tf.desc}</span>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:1.5rem">
                    <span class="badge badge-green">${tf.entry.length} entradas</span>
                    <span class="badge badge-red">${tf.exit.length} saídas</span>
                </div>

                <h4 style="color:var(--green-primary);margin-bottom:12px;font-size:14px"><i class="fas fa-sign-in-alt"></i> Estratégias de Entrada</h4>
                <div class="strategy-grid" style="margin-bottom:2rem">${entryCards}</div>

                <h4 style="color:var(--red-primary);margin-bottom:12px;font-size:14px"><i class="fas fa-sign-out-alt"></i> Estratégias de Saída</h4>
                <div class="strategy-grid">${exitCards}</div>
            </div>`;
        });

        content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-brain"></i> Estratégias Trade Certo</span>
                <div class="card-actions">
                    <span class="badge badge-green">${timeframes.reduce((t,[,tf]) => t + tf.entry.length + tf.exit.length, 0)} estratégias</span>
                </div>
            </div>
            <div class="card-body">
                <div class="tab-nav" id="stratTabs" style="margin-bottom:1.5rem">${tabBtns}</div>
                ${tabPanels}
            </div>
        </div>`;

        document.querySelectorAll('#stratTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#stratTabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.stab-panel').forEach(p => p.style.display = 'none');
                const target = document.getElementById('sTab_' + btn.dataset.stab);
                if (target) target.style.display = '';
            });
        });
    }


    // ============================================================
    // SAVED BACKTESTS
    // ============================================================

    async function renderSavedBacktests() {
        const content = document.getElementById('pageContent');
        content.innerHTML = loadingHTML();
        try {
            const data = await API.listSavedBacktests();
            const bts = data.backtests || [];
            if (!bts.length) {
                content.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum back-test salvo. Execute um back-test e clique em <i class="fas fa-save"></i>.</p></div>`;
                return;
            }
            let h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem">';
            bts.forEach(bt => {
                const ret = bt.total_return_pct || 0;
                const c = ret >= 0 ? 'positive' : 'negative';
                const sign = ret >= 0 ? '+' : '';
                const date = bt.saved_at ? Utils.formatDate(bt.saved_at) : '-';
                h += `<div class="strategy-card" style="cursor:pointer" onclick="App._viewBt('${bt.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span class="ticker-cell" style="font-size:18px">${bt.ticker || 'N/A'}</span>
                        <span style="font-size:12px;color:var(--text-muted)">${date}</span>
                    </div>
                    <div style="color:var(--text-secondary);font-size:12px;margin:8px 0">${bt.strategy || ''}</div>
                    <div class="${c}" style="font-size:22px;font-weight:800">${sign}${ret.toFixed(2)}%</div>
                    <button class="btn btn-ghost btn-sm" style="margin-top:12px;color:var(--red-primary);border-color:var(--red-primary)" onclick="event.stopPropagation();App._delBt('${bt.id}')"><i class="fas fa-trash"></i> Remover</button>
                </div>`;
            });
            h += '</div>';
            content.innerHTML = h;
        } catch (e) { content.innerHTML = `<p class="negative">Erro: ${e.message}</p>`; }
    }

    async function _viewBt(id) {
        const content = document.getElementById('pageContent');
        content.innerHTML = loadingHTML();
        try {
            const data = await API.getSavedBacktest(id);
            content.innerHTML = `<button class="btn btn-ghost" onclick="App.navigate('saved-backtests')" style="margin-bottom:1rem"><i class="fas fa-arrow-left"></i> Voltar</button><div id="btViewResult"></div>`;
            renderSingleResult(data, document.getElementById('btViewResult'));
        } catch (e) { content.innerHTML = `<p class="negative">Erro: ${e.message}</p>`; }
    }

    async function _delBt(id) {
        if (!confirm('Remover este back-test salvo?')) return;
        try {
            await API.deleteSavedBacktest(id);
            Utils.showToast('Removido', 'success');
            renderSavedBacktests();
        } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
    }

    // ============================================================
    // CONFIG PAGE
    // ============================================================

    async function renderConfig() {
        const content = document.getElementById('pageContent');
        if (configPin) { renderConfigPanel(content); return; }

        content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:1.5rem">
            <i class="fas fa-lock" style="font-size:3rem;color:var(--green-primary);opacity:0.6"></i>
            <h2 style="color:var(--text-primary)">Área Protegida</h2>
            <p style="color:var(--text-muted);max-width:400px;text-align:center">Digite o PIN para acessar configurações do sistema.</p>
            <div style="display:flex;gap:12px;align-items:center">
                <input class="form-input" type="password" id="pinInput" placeholder="PIN" maxlength="20"
                    style="width:200px;text-align:center;font-size:18px;letter-spacing:4px"
                    onkeydown="if(event.key==='Enter')App._submitPin()">
                <button class="btn btn-primary" onclick="App._submitPin()"><i class="fas fa-unlock"></i> Entrar</button>
            </div>
            <p id="pinError" class="negative" style="display:none;font-size:13px"></p>
        </div>`;
        document.getElementById('pinInput').focus();
    }

    async function _submitPin() {
        const input = document.getElementById('pinInput');
        const error = document.getElementById('pinError');
        const pin = input.value.trim();
        if (!pin) { error.textContent = 'Digite o PIN'; error.style.display = 'block'; return; }
        try {
            await API.verifyPin(pin);
            configPin = pin;
            renderConfigPanel(document.getElementById('pageContent'));
        } catch (e) {
            error.textContent = e.message || 'PIN incorreto';
            error.style.display = 'block';
            input.value = ''; input.focus();
        }
    }

    async function renderConfigPanel(content) {
        content.innerHTML = loadingHTML();

        let stats = {};
        let assets = [];
        try { stats = await API.getStorageStats(); } catch {}
        try { const r = await API.listSavedAssets(); assets = r.assets || []; } catch {}

        const lastUp = stats.last_auto_update ? Utils.formatDateTime(stats.last_auto_update) : 'Nunca';

        let assetRows = '';
        if (!assets.length) {
            assetRows = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Nenhum ativo salvo</td></tr>';
        } else {
            assets.forEach(a => {
                const ticker = a.ticker || a;
                assetRows += `<tr>
                    <td class="ticker-cell">${ticker}</td>
                    <td>${a.daily_records || 0}</td>
                    <td>${a.intraday_records || 0}</td>
                    <td>${a.last_update ? Utils.formatDateTime(a.last_update) : '-'}</td>
                    <td><button class="btn btn-ghost btn-sm" style="color:var(--red-primary);border-color:var(--red-primary)" onclick="App._deleteAsset('${ticker}')"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            });
        }

        content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
            <!-- Storage -->
            <div class="card">
                <div class="card-header"><span class="card-title"><i class="fas fa-database"></i> Armazenamento</span></div>
                <div class="card-body">
                    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
                        ${statCard('Ativos', stats.total_assets||0, 'fas fa-coins', '#00e676')}
                        ${statCard('Daily', stats.daily_assets||0, 'fas fa-calendar', '#2979ff')}
                        ${statCard('Intraday', stats.intraday_assets||0, 'fas fa-clock', '#ffc107')}
                    </div>
                    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-top:12px">
                        ${statCard('Registros', (stats.total_records||0).toLocaleString('pt-BR'), 'fas fa-table', '#69f0ae')}
                        ${statCard('BTs Salvos', stats.total_backtests||0, 'fas fa-save', '#ab47bc')}
                        ${statCard('Tipo', stats.storage_type||'supabase', 'fas fa-server', '#26c6da')}
                    </div>
                </div>
            </div>

            <!-- Atualização -->
            <div class="card">
                <div class="card-header"><span class="card-title"><i class="fas fa-sync-alt"></i> Atualização de Dados</span></div>
                <div class="card-body">
                    <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:1rem">
                        <i class="fas fa-clock" style="font-size:2rem;color:var(--green-primary)"></i>
                        <div><h4 style="font-size:14px">Automática: 18h (BRT)</h4><p style="color:var(--text-muted);font-size:12px">Última: ${lastUp}</p></div>
                    </div>
                    <button class="btn btn-primary" style="width:100%" id="btnManualUpdate" onclick="App._manualUpdate()"><i class="fas fa-sync-alt"></i> Atualizar Tudo Agora</button>
                    <div id="updateResult" style="margin-top:8px"></div>
                </div>
            </div>

            <!-- Download -->
            <div class="card" style="grid-column:1/-1">
                <div class="card-header"><span class="card-title"><i class="fas fa-download"></i> Baixar Dados de Ativo</span></div>
                <div class="card-body">
                    <div class="filter-bar">
                        <div class="form-group"><label class="form-label">Ticker</label><input class="form-input" type="text" id="dlTicker" placeholder="PETR4" style="text-transform:uppercase" oninput="App._validateTicker()"></div>
                        <div class="form-group"><label class="form-label">Início</label><input class="form-input" type="date" id="dlStart" value="${Utils.getDefaultStartDate()}"></div>
                        <div class="form-group"><label class="form-label">Fim</label><input class="form-input" type="date" id="dlEnd" value="${Utils.getTodayDate()}"></div>
                        <div class="form-group"><label class="form-label">Timeframe</label><select class="form-select" id="dlTimeframe"><option value="daily">Diário</option><option value="intraday">Intraday (1h)</option></select></div>
                        <div class="form-group" style="justify-content:flex-end"><label class="form-label">&nbsp;</label><button class="btn btn-primary" id="btnDownload" onclick="App._downloadData()"><i class="fas fa-download"></i> Baixar</button></div>
                    </div>
                    <div id="dlValidation" style="margin-top:4px;font-size:12px;min-height:20px"></div>
                    <div id="dlResult" style="margin-top:8px"></div>
                </div>
            </div>

            <!-- Assets -->
            <div class="card" style="grid-column:1/-1">
                <div class="card-header"><span class="card-title"><i class="fas fa-list"></i> Ativos Armazenados (${assets.length})</span>
                    <div class="card-actions"><button class="btn btn-ghost btn-sm" onclick="App._refreshConfig()"><i class="fas fa-refresh"></i></button></div></div>
                <div class="card-body no-padding"><div class="table-container" style="max-height:400px"><table class="data-table"><thead><tr><th>Ticker</th><th>Daily</th><th>Intraday</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>${assetRows}</tbody></table></div></div>
            </div>

            <!-- Change PIN -->
            <div class="card">
                <div class="card-header"><span class="card-title"><i class="fas fa-key"></i> Alterar PIN</span></div>
                <div class="card-body">
                    <div class="filter-bar" style="flex-direction:column;align-items:stretch">
                        <div class="form-group"><label class="form-label">PIN Atual</label><input class="form-input" type="password" id="oldPin"></div>
                        <div class="form-group"><label class="form-label">Novo PIN</label><input class="form-input" type="password" id="newPin"></div>
                        <button class="btn btn-secondary" onclick="App._changePin()"><i class="fas fa-key"></i> Alterar</button>
                    </div>
                    <div id="pinChangeResult" style="margin-top:8px"></div>
                </div>
            </div>

            <!-- Logout -->
            <div class="card">
                <div class="card-header"><span class="card-title"><i class="fas fa-sign-out-alt"></i> Sessão</span></div>
                <div class="card-body">
                    <p style="color:var(--text-muted);font-size:13px;margin-bottom:1rem">Ao sair, o PIN será esquecido.</p>
                    <button class="btn btn-ghost" style="width:100%;color:var(--red-primary);border-color:var(--red-primary)" onclick="App._logout()"><i class="fas fa-sign-out-alt"></i> Sair</button>
                </div>
            </div>
        </div>`;
    }

    // Config actions
    let _vlTimeout = null;
    function _validateTicker() {
        const el = document.getElementById('dlValidation');
        const ticker = document.getElementById('dlTicker').value.toUpperCase().trim();
        if (_vlTimeout) clearTimeout(_vlTimeout);
        if (ticker.length < 3) { el.innerHTML = ''; return; }
        el.innerHTML = '<span style="color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Validando...</span>';
        _vlTimeout = setTimeout(async () => {
            try {
                const r = await API.validateTicker(ticker);
                if (r.valid) el.innerHTML = `<span class="positive"><i class="fas fa-check-circle"></i> ${r.name||ticker} — R$ ${r.last_price||'?'}</span>`;
                else el.innerHTML = '<span class="negative"><i class="fas fa-times-circle"></i> Ticker inválido</span>';
            } catch { el.innerHTML = '<span class="negative"><i class="fas fa-exclamation-triangle"></i> Erro</span>'; }
        }, 800);
    }

    async function _downloadData() {
        const ticker = document.getElementById('dlTicker').value.toUpperCase().trim();
        const start = document.getElementById('dlStart').value;
        const end = document.getElementById('dlEnd').value;
        const tf = document.getElementById('dlTimeframe').value;
        const res = document.getElementById('dlResult');
        const btn = document.getElementById('btnDownload');
        if (!ticker) { Utils.showToast('Digite um ticker', 'warning'); return; }
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...';
        res.innerHTML = '';
        try {
            const data = await API.downloadData(configPin, ticker, start, end, tf);
            if (data.success !== false) {
                res.innerHTML = `<span class="positive"><i class="fas fa-check-circle"></i> ${data.message || 'Sucesso'} — ${data.records||0} registros</span>`;
                Utils.showToast(`${ticker}: dados baixados`, 'success');
                _refreshConfig();
                updateStorageIndicator();
            } else { res.innerHTML = `<span class="negative"><i class="fas fa-times-circle"></i> ${data.message||'Erro'}</span>`; }
        } catch (e) { res.innerHTML = `<span class="negative"><i class="fas fa-times-circle"></i> ${e.message}</span>`; }
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar';
    }

    async function _manualUpdate() {
        const btn = document.getElementById('btnManualUpdate');
        const res = document.getElementById('updateResult');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
        try {
            const data = await API.manualUpdate(configPin);
            res.innerHTML = `<span class="positive"><i class="fas fa-check-circle"></i> ${data.updated||0} atualizados, ${data.errors||0} erros</span>`;
            Utils.showToast('Atualização concluída', 'success');
            _refreshConfig(); updateStorageIndicator();
        } catch (e) { res.innerHTML = `<span class="negative">${e.message}</span>`; }
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Tudo Agora';
    }

    async function _deleteAsset(ticker) {
        if (!confirm(`Remover ${ticker} e todos os dados?`)) return;
        try {
            await API.deleteAsset(ticker, configPin);
            Utils.showToast(`${ticker} removido`, 'success');
            _refreshConfig(); updateStorageIndicator();
        } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
    }

    async function _changePin() {
        const old = document.getElementById('oldPin').value.trim();
        const nw = document.getElementById('newPin').value.trim();
        const res = document.getElementById('pinChangeResult');
        if (!old || !nw) { res.innerHTML = '<span class="negative">Preencha ambos os campos</span>'; return; }
        try {
            await API.changePin(old, nw);
            configPin = nw;
            res.innerHTML = '<span class="positive"><i class="fas fa-check-circle"></i> PIN alterado!</span>';
            document.getElementById('oldPin').value = '';
            document.getElementById('newPin').value = '';
        } catch (e) { res.innerHTML = `<span class="negative">${e.message}</span>`; }
    }

    function _logout() {
        configPin = null;
        renderConfig();
    }

    function _refreshConfig() {
        renderConfigPanel(document.getElementById('pageContent'));
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        init, navigate,
        _switchBtTab: () => {}, // deprecated
        _submitPin, _viewBt, _delBt,
        _validateTicker, _downloadData, _manualUpdate,
        _deleteAsset, _changePin, _logout, _refreshConfig,
    };
})();

// Init on load
document.addEventListener('DOMContentLoaded', App.init);
