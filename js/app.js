/**
 * Trade Halley — App Principal v2.1
 * SPA completo
 */
const App = (() => {
    let currentPage = 'dashboard';
    let cachedStrategies = null;
    let configPin = null;

    /* ═══════════ INIT ═══════════ */

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
            item.addEventListener('click', e => {
                e.preventDefault();
                navigateTo(item.dataset.page);
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
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const a = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (a) a.classList.add('active');
        document.getElementById('sidebar')?.classList.remove('open');
        Charts.destroyAll();

        const map = {
            dashboard:   ['Dashboard','Visão geral do mercado'],
            b3daily:     ['B3 Daily','Backtest — ações B3 (diário)'],
            b3intraday:  ['B3 Intraday','Backtest — ações B3 (intraday)'],
            bmfintraday: ['BMF Intraday','Backtest — futuros BMF (intraday)'],
            strategies:  ['Estratégias','Gerenciar estratégias por timeframe'],
            saved:       ['Backtests Salvos','Histórico de backtests salvos'],
            config:      ['Configurações','Gerenciar dados e configurações'],
        };
        const [t, s] = map[page] || ['Trade Halley',''];
        document.getElementById('pageTitle').textContent = t;
        document.getElementById('pageSubtitle').textContent = s;

        switch (page) {
            case 'dashboard':   renderDashboard(); break;
            case 'b3daily':     renderBacktestPage('b3','1d'); break;
            case 'b3intraday':  renderBacktestPage('b3','1h'); break;
            case 'bmfintraday': renderBacktestPage('bmf','1h'); break;
            case 'strategies':  renderStrategiesPage(); break;
            case 'saved':       renderSavedPage(); break;
            case 'config':      renderConfigPage(); break;
        }
    }

    /* ═══════════ MARKET STATUS & STORAGE ═══════════ */

    function updateMarketStatus() {
        const el = document.getElementById('marketStatus');
        if (!el) return;
        const open = Utils.isMarketOpen();
        el.innerHTML = `<span class="status-dot ${open?'status-open':'status-closed'}"></span><span class="status-text">${open?'Mercado Aberto':'Mercado Fechado'}</span>`;
    }

    async function updateStorageIndicator() {
        try {
            const s = await API.getStorageStats();
            const el = document.getElementById('storageCount');
            if (el) el.textContent = s.total_assets || 0;
        } catch (_) {}
    }

    /* ═══════════ DASHBOARD ═══════════ */

    async function renderDashboard() {
        const c = document.getElementById('pageContent');
        c.innerHTML = `
            <div class="dashboard-grid">
                <div class="stat-card"><div class="stat-label"><i class="fas fa-chart-line"></i> IBOVESPA</div><div class="stat-value" id="vIBOV">--</div><div class="stat-change" id="cIBOV">--</div></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-dollar-sign"></i> Dólar (USD/BRL)</div><div class="stat-value" id="vDOL">--</div><div class="stat-change" id="cDOL">--</div></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-layer-group"></i> BOVA11</div><div class="stat-value" id="vBOVA">--</div><div class="stat-change" id="cBOVA">--</div></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-database"></i> Ativos Cadastrados</div><div class="stat-value" id="vSTO">--</div><div class="stat-change" id="cSTO">Supabase</div></div>
            </div>
            <div class="charts-section">
                <div class="chart-container"><h3><i class="fas fa-chart-area"></i> Gráfico de Referência — 3 meses</h3><canvas id="chRef"></canvas><p class="chart-note" id="nRef"></p></div>
                <div class="chart-container"><h3><i class="fas fa-chart-area"></i> Dólar / Referência — 3 meses</h3><canvas id="chDol"></canvas><p class="chart-note" id="nDol"></p></div>
            </div>
            <div class="market-table-section">
                <h3><i class="fas fa-table"></i> Cotações em Tempo Real (brapi.dev)</h3>
                <div class="table-responsive">
                    <table class="data-table"><thead><tr><th>Ativo</th><th>Nome</th><th>Preço</th><th>Variação</th><th>Volume</th></tr></thead>
                    <tbody id="mktBody"><tr><td colspan="5" class="loading-cell">Carregando cotações...</td></tr></tbody></table>
                </div>
            </div>`;

        // Fetch cards individually (safe for special chars)
        _fetchCard('^BVSP', 'vIBOV', 'cIBOV', false, true);
        _fetchCard('USDBRL=X', 'vDOL', 'cDOL', true, false);
        _fetchCard('BOVA11', 'vBOVA', 'cBOVA', false, false);
        _fetchStorage();

        // Market table — fetch individually
        const tickers = ['PETR4','VALE3','ITUB4','BBDC4','ABEV3','WEGE3','RENT3','BBAS3','PRIO3','SUZB3','MGLU3','HAPV3','JBSS3','GGBR4','B3SA3','BOVA11'];
        _fetchMarketTable(tickers);

        // Charts
        _fetchChartRef();
        _fetchChartDol();
    }

    async function _fetchCard(ticker, valId, chgId, isCurr, isBig) {
        try {
            const q = await API.brapiQuote(ticker);
            if (!q) return;
            const ve = document.getElementById(valId);
            const ce = document.getElementById(chgId);
            if (!ve) return;
            if (isCurr) ve.textContent = 'R$ ' + q.regularMarketPrice.toFixed(4);
            else if (isBig) ve.textContent = Utils.formatNumber(q.regularMarketPrice, 0);
            else ve.textContent = Utils.formatCurrency(q.regularMarketPrice);
            const p = q.regularMarketChangePercent || 0;
            ce.textContent = (p >= 0 ? '+' : '') + p.toFixed(2) + '%';
            ce.className = 'stat-change ' + (p >= 0 ? 'positive' : 'negative');
        } catch (e) { console.warn('Card error ' + ticker, e); }
    }

    async function _fetchStorage() {
        try {
            const s = await API.getStorageStats();
            const el = document.getElementById('vSTO');
            if (el) el.textContent = s.total_assets || 0;
            const sc = document.getElementById('storageCount');
            if (sc) sc.textContent = s.total_assets || 0;
        } catch (_) {
            const el = document.getElementById('vSTO');
            if (el) el.textContent = '0';
        }
    }

    async function _fetchMarketTable(tickers) {
        const tbody = document.getElementById('mktBody');
        if (!tbody) return;
        const quotes = await API.getDashboardQuotes(tickers);
        if (quotes.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Sem dados</td></tr>'; return; }
        tbody.innerHTML = quotes.map(q => {
            const p = q.regularMarketChangePercent || 0;
            const cls = p >= 0 ? 'positive' : 'negative';
            const arr = p >= 0 ? '▲' : '▼';
            return `<tr><td><strong>${q.symbol}</strong></td><td>${q.shortName||q.symbol}</td><td>${Utils.formatCurrency(q.regularMarketPrice)}</td><td class="${cls}">${arr} ${p.toFixed(2)}%</td><td>${Utils.formatVolume(q.regularMarketVolume)}</td></tr>`;
        }).join('');
    }

    async function _fetchChartRef() {
        try {
            let d = await API.getHistoricalData('BOVA11', '3mo', '1d');
            let lb = 'BOVA11';
            if (!d || d.length === 0) {
                d = await API.getHistoricalData('PETR4', '3mo', '1d');
                lb = 'PETR4 (referência)';
                const n = document.getElementById('nRef');
                if (n) n.textContent = 'BOVA11 sem histórico no plano gratuito. Exibindo PETR4.';
            }
            if (d && d.length > 0) {
                const labels = d.map(x => new Date(x.date * 1000).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }));
                Charts.priceLine('chRef', labels, d.map(x => x.close), lb);
            }
        } catch (e) { console.warn('Chart ref error', e); }
    }

    async function _fetchChartDol() {
        try {
            let d = await API.getHistoricalData('USDBRL=X', '3mo', '1d');
            let lb = 'USD/BRL';
            if (!d || d.length === 0) {
                d = await API.getHistoricalData('VALE3', '3mo', '1d');
                lb = 'VALE3 (referência)';
                const n = document.getElementById('nDol');
                if (n) n.textContent = 'USD/BRL sem histórico no plano gratuito. Exibindo VALE3.';
            }
            if (d && d.length > 0) {
                const labels = d.map(x => new Date(x.date * 1000).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }));
                Charts.priceLine('chDol', labels, d.map(x => x.close), lb);
            }
        } catch (e) { console.warn('Chart dol error', e); }
    }

    /* ═══════════ BACKTEST PAGES ═══════════ */

    async function renderBacktestPage(market, interval) {
        const c = document.getElementById('pageContent');
        const strats = await loadStrategies();
        c.innerHTML = `<div class="backtest-page"><div class="tab-bar" style="margin-bottom:1.2rem">
            <button class="tab-btn active" data-bt="single">Individual</button>
            <button class="tab-btn" data-bt="bulk">Em Massa</button>
            <button class="tab-btn" data-bt="compare">Comparar</button>
        </div><div id="btContent"></div></div>`;
        const render = tab => {
            Charts.destroyAll();
            const ct = document.getElementById('btContent');
            if (tab==='single') renderSingle(ct, market, interval, strats);
            else if (tab==='bulk') renderBulk(ct, market, interval, strats);
            else renderCompare(ct, market, interval, strats);
        };
        c.querySelectorAll('.tab-btn[data-bt]').forEach(b => b.addEventListener('click', () => {
            c.querySelectorAll('.tab-btn[data-bt]').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            render(b.dataset.bt);
        }));
        render('single');
    }

    async function loadStrategies() {
        if (cachedStrategies) return cachedStrategies;
        try { const r = await API.getStrategies(); cachedStrategies = r.strategies || []; }
        catch (_) { cachedStrategies = []; }
        return cachedStrategies;
    }

    function stratOpts(strats) { return strats.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join(''); }
    function tickerInput(market) {
        if (market === 'bmf') return `<select id="btTicker" class="form-input"><option value="IBOV_FUT">Mini Índice</option><option value="DOL_FUT">Mini Dólar</option><option value="SP500">S&P 500</option><option value="GOLD">Ouro</option><option value="CRUDE_OIL">Petróleo</option><option value="BITCOIN">Bitcoin</option></select>`;
        return `<input type="text" id="btTicker" class="form-input" placeholder="Ex: PETR4" value="PETR4">`;
    }

    function renderSingle(ct, market, interval, strats) {
        ct.innerHTML = `<div class="backtest-form"><div class="form-row">
            <div class="form-group"><label>Ativo</label>${tickerInput(market)}</div>
            <div class="form-group"><label>Estratégia</label><select id="btStrat" class="form-input">${stratOpts(strats)}</select></div>
            <div class="form-group"><label>Período</label><select id="btPeriod" class="form-input"><option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option><option value="2y">2 anos</option></select></div>
            <div class="form-group"><label>Capital</label><input type="number" id="btCap" class="form-input" value="10000" min="100"></div>
        </div><div class="form-row">
            <div class="form-group"><label>Stop Loss (%)</label><input type="number" id="btSL" class="form-input" placeholder="Ex: 5" step="0.1"></div>
            <div class="form-group"><label>Take Profit (%)</label><input type="number" id="btTP" class="form-input" placeholder="Ex: 10" step="0.1"></div>
            <div class="form-group form-action"><button class="btn btn-primary" id="btnRun"><i class="fas fa-play"></i> Executar</button></div>
        </div></div><div id="btResult"></div>`;
        document.getElementById('btnRun').addEventListener('click', async () => {
            const ticker = document.getElementById('btTicker').value.trim().toUpperCase();
            if (!ticker) { Utils.showToast('Informe o ticker','error'); return; }
            const params = { ticker, strategy: document.getElementById('btStrat').value, period: document.getElementById('btPeriod').value, interval, capital: parseFloat(document.getElementById('btCap').value)||10000 };
            const sl = parseFloat(document.getElementById('btSL').value); if (sl > 0) params.stop_loss = sl / 100;
            const tp = parseFloat(document.getElementById('btTP').value); if (tp > 0) params.take_profit = tp / 100;
            const rd = document.getElementById('btResult');
            rd.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Executando backtest...</p></div>';
            try { renderBtResult(rd, await API.runBacktest(params)); }
            catch (e) { rd.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`; }
        });
    }

    function renderBulk(ct, market, interval, strats) {
        ct.innerHTML = `<div class="backtest-form"><div class="form-row">
            <div class="form-group"><label>Estratégia</label><select id="bkStrat" class="form-input">${stratOpts(strats)}</select></div>
            <div class="form-group"><label>Período</label><select id="bkPeriod" class="form-input"><option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option></select></div>
            <div class="form-group"><label>Capital</label><input type="number" id="bkCap" class="form-input" value="10000" min="100"></div>
            <div class="form-group form-action"><button class="btn btn-primary" id="btnBulk"><i class="fas fa-play"></i> Em Massa</button></div>
        </div></div><div id="bkResult"></div>`;
        document.getElementById('btnBulk').addEventListener('click', async () => {
            const rd = document.getElementById('bkResult');
            rd.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Executando backtests em massa...</p></div>';
            try {
                const data = await API.runBulkBacktest({ market, strategy: document.getElementById('bkStrat').value, period: document.getElementById('bkPeriod').value, interval, capital: parseFloat(document.getElementById('bkCap').value)||10000 });
                const rs = data.results || [];
                if (!rs.length) { rd.innerHTML = '<p class="empty-state">Nenhum resultado.</p>'; return; }
                rd.innerHTML = `<p class="result-summary">${data.total_tested} ativos testados</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Ativo</th><th>Retorno</th><th>Capital Final</th><th>Trades</th><th>Win Rate</th><th>Drawdown</th></tr></thead><tbody>${rs.map(r => { const cl = (r.total_return_pct||0) >= 0 ? 'positive':'negative'; return `<tr><td><strong>${r.ticker}</strong></td><td class="${cl}">${Utils.formatPercent(r.total_return_pct)}</td><td>${Utils.formatCurrency(r.final_capital)}</td><td>${r.total_trades||0}</td><td>${Utils.formatPercent(r.win_rate)}</td><td class="negative">${Utils.formatPercent(r.max_drawdown)}</td></tr>`; }).join('')}</tbody></table></div>`;
            } catch (e) { rd.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`; }
        });
    }

    function renderCompare(ct, market, interval, strats) {
        ct.innerHTML = `<div class="backtest-form"><div class="form-row">
            <div class="form-group"><label>Ativo</label>${tickerInput(market)}</div>
            <div class="form-group"><label>Período</label><select id="cmPeriod" class="form-input"><option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option></select></div>
            <div class="form-group"><label>Capital</label><input type="number" id="cmCap" class="form-input" value="10000" min="100"></div>
            <div class="form-group form-action"><button class="btn btn-primary" id="btnCmp"><i class="fas fa-play"></i> Comparar</button></div>
        </div></div><div id="cmResult"></div>`;
        document.getElementById('btnCmp').addEventListener('click', async () => {
            const ticker = document.getElementById('btTicker').value.trim().toUpperCase();
            if (!ticker) { Utils.showToast('Informe o ticker','error'); return; }
            const rd = document.getElementById('cmResult');
            rd.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Comparando estratégias...</p></div>';
            try {
                const data = await API.compareStrategies({ ticker, period: document.getElementById('cmPeriod').value, interval, capital: parseFloat(document.getElementById('cmCap').value)||10000 });
                const rs = data.results || [];
                if (!rs.length) { rd.innerHTML = '<p class="empty-state">Nenhum resultado.</p>'; return; }
                rd.innerHTML = `<p class="result-summary">${data.total_strategies} estratégias para ${data.ticker}</p><div class="chart-container"><canvas id="chCmp"></canvas></div><div class="table-responsive"><table class="data-table"><thead><tr><th>#</th><th>Estratégia</th><th>Retorno</th><th>Trades</th><th>Win Rate</th><th>PF</th><th>DD</th></tr></thead><tbody>${rs.map((r,i) => { const cl = (r.total_return_pct||0)>=0?'positive':'negative'; return `<tr><td>${i+1}</td><td>${r.strategy_name||r.strategy}</td><td class="${cl}">${Utils.formatPercent(r.total_return_pct)}</td><td>${r.total_trades||0}</td><td>${Utils.formatPercent(r.win_rate)}</td><td>${(r.profit_factor||0).toFixed(2)}</td><td class="negative">${Utils.formatPercent(r.max_drawdown)}</td></tr>`; }).join('')}</tbody></table></div>`;
                Charts.performanceBar('chCmp', rs.map(r => r.strategy_name||r.strategy), rs.map(r => r.total_return_pct||0));
            } catch (e) { rd.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`; }
        });
    }

    function renderBtResult(container, r) {
        const rc = (r.total_return_pct||0) >= 0 ? 'positive' : 'negative';
        container.innerHTML = `<div class="result-section"><div class="result-stats">
            <div class="stat-card compact"><div class="stat-label">Retorno</div><div class="stat-value ${rc}">${Utils.formatPercent(r.total_return_pct)}</div></div>
            <div class="stat-card compact"><div class="stat-label">Capital Final</div><div class="stat-value">${Utils.formatCurrency(r.final_capital)}</div></div>
            <div class="stat-card compact"><div class="stat-label">Trades</div><div class="stat-value">${r.total_trades||0}</div></div>
            <div class="stat-card compact"><div class="stat-label">Win Rate</div><div class="stat-value">${Utils.formatPercent(r.win_rate)}</div></div>
            <div class="stat-card compact"><div class="stat-label">Profit Factor</div><div class="stat-value">${(r.profit_factor||0).toFixed(2)}</div></div>
            <div class="stat-card compact"><div class="stat-label">Max DD</div><div class="stat-value negative">${Utils.formatPercent(r.max_drawdown)}</div></div>
        </div><div class="result-charts"><div class="chart-container"><h4>Curva de Patrimônio</h4><canvas id="chEq"></canvas></div><div class="chart-container chart-small"><h4>Win Rate</h4><canvas id="chWR"></canvas></div></div>
        <div class="result-actions"><button class="btn btn-primary" id="btnSave"><i class="fas fa-save"></i> Salvar</button></div></div>`;
        if (r.equity_curve && r.equity_curve.length) Charts.equityCurve('chEq', r.equity_curve.map((_,i)=>i+1), r.equity_curve);
        if (r.total_trades > 0) Charts.winRateDonut('chWR', r.winning_trades||0, r.losing_trades||0);
        document.getElementById('btnSave')?.addEventListener('click', async () => {
            try { await API.saveBacktest({ result: r }); Utils.showToast('Backtest salvo!','success'); }
            catch (e) { Utils.showToast('Erro: '+e.message,'error'); }
        });
    }

    /* ═══════════ STRATEGIES ═══════════ */

    const TC = {
        daily: [
            { id:'tc_sma_9_21', name:'Cruzamento SMA 9/21', category:'Tendência', entry:'SMA 9 cruza acima da SMA 21', exit:'SMA 9 cruza abaixo da SMA 21', indicators:'SMA 9, SMA 21', timeframe:'Diário', editable:false },
            { id:'tc_sma_20_50', name:'Cruzamento SMA 20/50', category:'Tendência', entry:'SMA 20 cruza acima da SMA 50', exit:'SMA 20 cruza abaixo da SMA 50', indicators:'SMA 20, SMA 50', timeframe:'Diário', editable:false },
            { id:'tc_ema_9_21', name:'Cruzamento EMA 9/21', category:'Tendência', entry:'EMA 9 cruza acima da EMA 21', exit:'EMA 9 cruza abaixo da EMA 21', indicators:'EMA 9, EMA 21', timeframe:'Diário', editable:false },
            { id:'tc_ema_12_26', name:'Cruzamento EMA 12/26', category:'Tendência', entry:'EMA 12 cruza acima da EMA 26', exit:'EMA 12 cruza abaixo da EMA 26', indicators:'EMA 12, EMA 26', timeframe:'Diário', editable:false },
            { id:'tc_macd', name:'MACD (12,26,9)', category:'Tendência', entry:'MACD cruza acima da Signal Line', exit:'MACD cruza abaixo da Signal Line', indicators:'MACD, Signal, Histograma', timeframe:'Diário', editable:false },
            { id:'tc_rsi_14', name:'RSI 14 (30/70)', category:'Oscilador', entry:'RSI 14 < 30 (sobrevenda)', exit:'RSI 14 > 70 (sobrecompra)', indicators:'RSI 14', timeframe:'Diário', editable:false },
            { id:'tc_rsi_9', name:'RSI 9 (25/75)', category:'Oscilador', entry:'RSI 9 < 25', exit:'RSI 9 > 75', indicators:'RSI 9', timeframe:'Diário', editable:false },
            { id:'tc_boll', name:'Bollinger Bands (20,2)', category:'Volatilidade', entry:'Preço toca banda inferior', exit:'Preço toca banda superior', indicators:'BB(20,2), SMA 20', timeframe:'Diário', editable:false },
            { id:'tc_stoch', name:'Estocástico (14,3)', category:'Oscilador', entry:'Sobrevenda + %K > %D', exit:'Sobrecompra + %K < %D', indicators:'%K(14), %D(3)', timeframe:'Diário', editable:false },
            { id:'tc_adx', name:'ADX Tendência (25)', category:'Tendência', entry:'ADX > 25 + DI+ > DI−', exit:'ADX < 20 ou DI+ < DI−', indicators:'ADX(14), DI+, DI−', timeframe:'Diário', editable:false },
            { id:'tc_triple', name:'Tripla EMA (9/21/55)', category:'Tendência', entry:'EMA9 > EMA21 > EMA55', exit:'EMA9 < EMA21', indicators:'EMA 9, 21, 55', timeframe:'Diário', editable:false },
            { id:'tc_combo', name:'Combo RSI + MACD', category:'Combo', entry:'RSI<40 E MACD>Signal', exit:'RSI>60 E MACD<Signal', indicators:'RSI 14, MACD', timeframe:'Diário', editable:false },
            { id:'tc_break', name:'Breakout + Volume', category:'Breakout', entry:'Rompimento máxima + Vol 1.5× média', exit:'Retorno abaixo breakout', indicators:'Máximas, Vol SMA20', timeframe:'Diário', editable:false },
        ],
        intraday_b3: [
            { id:'tc_ib1', name:'EMA 9/21 (5min)', category:'Tendência', entry:'EMA 9 cruza acima EMA 21 no 5min', exit:'EMA 9 cruza abaixo EMA 21', indicators:'EMA 9, EMA 21', timeframe:'5 min', editable:false },
            { id:'tc_ib2', name:'VWAP Bounce', category:'Reversão', entry:'Preço retorna ao VWAP + candle reversão', exit:'1 ATR do VWAP', indicators:'VWAP, ATR(14)', timeframe:'5 min', editable:false },
            { id:'tc_ib3', name:'Scalp RSI 9 (5min)', category:'Oscilador', entry:'RSI 9 < 20', exit:'RSI 9 > 80 ou gain 0.5%', indicators:'RSI 9', timeframe:'5 min', editable:false },
            { id:'tc_ib4', name:'MACD (15min)', category:'Tendência', entry:'MACD cruza acima Signal no 15min', exit:'MACD cruza abaixo Signal', indicators:'MACD(12,26,9)', timeframe:'15 min', editable:false },
            { id:'tc_ib5', name:'Bollinger Squeeze (5min)', category:'Volatilidade', entry:'Squeeze + rompimento banda superior', exit:'Retorno à SMA 20', indicators:'BB(20,2), BB Width', timeframe:'5 min', editable:false },
            { id:'tc_ib6', name:'Opening Range Breakout', category:'Breakout', entry:'Rompimento máxima 15min iniciais', exit:'Stop mínima range ou 2R', indicators:'High/Low 15min', timeframe:'15 min', editable:false },
            { id:'tc_ib7', name:'EMA 9 + Volume', category:'Combo', entry:'Acima EMA 9 + Vol 2× média', exit:'Abaixo EMA 9', indicators:'EMA 9, Vol SMA20', timeframe:'5 min', editable:false },
            { id:'tc_ib8', name:'Estocástico Rápido (5min)', category:'Oscilador', entry:'%K cruza %D em sobrevenda (<20)', exit:'%K cruza %D em sobrecompra (>80)', indicators:'%K(5), %D(3)', timeframe:'5 min', editable:false },
        ],
        intraday_bmf: [
            { id:'tc_bm1', name:'EMA 9/21 Mini-índice', category:'Tendência', entry:'EMA 9 cruza acima EMA 21 (1min)', exit:'EMA 9 cruza abaixo EMA 21', indicators:'EMA 9, EMA 21', timeframe:'1 min', editable:false },
            { id:'tc_bm2', name:'VWAP Mini-dólar', category:'Reversão', entry:'Toque VWAP + candle reversão', exit:'1 ATR do VWAP', indicators:'VWAP, ATR(14)', timeframe:'1 min', editable:false },
            { id:'tc_bm3', name:'Scalp 200pts Mini-índice', category:'Scalp', entry:'EMA9>EMA21 + RSI>50', exit:'Gain 200pts ou loss 100pts', indicators:'EMA 9, 21, RSI 9', timeframe:'1 min', editable:false },
            { id:'tc_bm4', name:'MACD Mini-dólar (5min)', category:'Tendência', entry:'MACD cruza acima Signal 5min', exit:'MACD cruza abaixo Signal', indicators:'MACD(12,26,9)', timeframe:'5 min', editable:false },
            { id:'tc_bm5', name:'Bollinger Mini-índice', category:'Volatilidade', entry:'Banda inferior + volume alto', exit:'SMA 20 ou banda superior', indicators:'BB(20,2)', timeframe:'5 min', editable:false },
            { id:'tc_bm6', name:'ORB Mini-índice (5min)', category:'Breakout', entry:'Rompimento range 5min iniciais', exit:'Stop extremidade oposta', indicators:'High/Low 5min', timeframe:'5 min', editable:false },
            { id:'tc_bm7', name:'DI Futuro — Tendência', category:'Tendência', entry:'SMA 5 cruza acima SMA 20', exit:'SMA 5 cruza abaixo SMA 20', indicators:'SMA 5, SMA 20', timeframe:'Diário', editable:false },
            { id:'tc_bm8', name:'Spread WIN/WDO', category:'Arbitragem', entry:'Spread desvia 2σ da média', exit:'Spread retorna à média', indicators:'Spread, Média, Desvio', timeframe:'5 min', editable:false },
        ],
    };

    function _getCust() { try { return JSON.parse(localStorage.getItem('th_cust')||'{}'); } catch { return {}; } }
    function _setCust(d) { localStorage.setItem('th_cust', JSON.stringify(d)); }
    function _allStrats(tab) { return [...(TC[tab]||[]), ...(_getCust()[tab]||[])]; }

    function _badgeClass(cat) {
        return 'badge-' + cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
    }

    function renderStrategiesPage() {
        const c = document.getElementById('pageContent');
        c.innerHTML = `<div class="strategies-page"><div class="page-toolbar">
            <div class="tab-bar"><button class="tab-btn active" data-st="daily">B3 Daily</button><button class="tab-btn" data-st="intraday_b3">Intraday B3</button><button class="tab-btn" data-st="intraday_bmf">Intraday BMF</button></div>
            <button class="btn btn-primary" id="btnAdd"><i class="fas fa-plus"></i> Nova Estratégia</button>
        </div><div id="stContent"></div></div>`;
        let curTab = 'daily';
        function renderSt(tab) {
            curTab = tab;
            const ss = _allStrats(tab);
            const el = document.getElementById('stContent');
            if (!ss.length) { el.innerHTML = '<p class="empty-state">Nenhuma estratégia. Clique "Nova" para criar.</p>'; return; }
            el.innerHTML = `<div class="strategies-grid">${ss.map(s => `<div class="strategy-card"><div class="strategy-header"><span class="strategy-badge ${_badgeClass(s.category)}">${s.category}</span>${s.editable!==false?`<div class="strategy-actions"><button class="btn-icon btn-edit" data-sid="${s.id}"><i class="fas fa-pen"></i></button><button class="btn-icon btn-delete" data-sid="${s.id}"><i class="fas fa-trash"></i></button></div>`:'<span class="badge-default">Padrão</span>'}</div><h4 class="strategy-name">${s.name}</h4><div class="strategy-detail"><strong>Timeframe:</strong> ${s.timeframe}</div><div class="strategy-detail"><strong>Indicadores:</strong> ${s.indicators}</div><div class="strategy-detail"><strong>Entrada:</strong> ${s.entry}</div><div class="strategy-detail"><strong>Saída:</strong> ${s.exit}</div></div>`).join('')}</div>`;
            el.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => openModal(curTab, b.dataset.sid)));
            el.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => delStrat(curTab, b.dataset.sid)));
        }
        c.querySelectorAll('.tab-btn[data-st]').forEach(b => b.addEventListener('click', () => {
            c.querySelectorAll('.tab-btn[data-st]').forEach(x=>x.classList.remove('active'));
            b.classList.add('active');
            renderSt(b.dataset.st);
        }));
        document.getElementById('btnAdd').addEventListener('click', () => openModal(curTab, null));
        renderSt('daily');
    }

    function openModal(tab, editId) {
        let ex = null;
        if (editId) { const cu = _getCust(); ex = (cu[tab]||[]).find(s=>s.id===editId); if (!ex) return; }
        const ov = document.createElement('div');
        ov.className = 'modal-overlay';
        ov.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>${editId?'Editar':'Nova'} Estratégia</h3><button class="btn-icon modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">
            <div class="form-group"><label>Nome</label><input type="text" id="mN" class="form-input" value="${ex?ex.name:''}" placeholder="Ex: Minha EMA"></div>
            <div class="form-group"><label>Categoria</label><select id="mC" class="form-input">${['Tendência','Oscilador','Volatilidade','Breakout','Reversão','Combo','Scalp','Arbitragem'].map(c=>`<option value="${c}" ${ex?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
            <div class="form-group"><label>Timeframe</label><input type="text" id="mT" class="form-input" value="${ex?ex.timeframe:''}" placeholder="5 min, Diário"></div>
            <div class="form-group"><label>Indicadores</label><input type="text" id="mI" class="form-input" value="${ex?ex.indicators:''}" placeholder="EMA 9, RSI 14"></div>
            <div class="form-group"><label>Entrada</label><textarea id="mE" class="form-input" rows="3" placeholder="Condição de entrada...">${ex?ex.entry:''}</textarea></div>
            <div class="form-group"><label>Saída</label><textarea id="mX" class="form-input" rows="3" placeholder="Condição de saída...">${ex?ex.exit:''}</textarea></div>
        </div><div class="modal-footer"><button class="btn btn-secondary modal-cancel">Cancelar</button><button class="btn btn-primary" id="mSave"><i class="fas fa-save"></i> ${editId?'Salvar':'Criar'}</button></div></div>`;
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.querySelector('.modal-close').addEventListener('click', close);
        ov.querySelector('.modal-cancel').addEventListener('click', close);
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        document.getElementById('mSave').addEventListener('click', () => {
            const name = document.getElementById('mN').value.trim();
            const entry = document.getElementById('mE').value.trim();
            const exit = document.getElementById('mX').value.trim();
            if (!name||!entry||!exit) { Utils.showToast('Preencha nome, entrada e saída','error'); return; }
            const obj = { name, category:document.getElementById('mC').value, timeframe:document.getElementById('mT').value.trim(), indicators:document.getElementById('mI').value.trim(), entry, exit, editable:true };
            const cu = _getCust(); if (!cu[tab]) cu[tab] = [];
            if (editId) { const i = cu[tab].findIndex(s=>s.id===editId); if (i>=0) cu[tab][i] = {...cu[tab][i],...obj}; }
            else { obj.id = 'c_'+Date.now(); cu[tab].push(obj); }
            _setCust(cu); close(); Utils.showToast(editId?'Atualizada!':'Criada!','success');
            renderStrategiesPage();
            setTimeout(() => document.querySelectorAll('.tab-btn[data-st]').forEach(b => { if (b.dataset.st===tab) b.click(); }), 50);
        });
    }

    function delStrat(tab, id) {
        if (!confirm('Excluir esta estratégia?')) return;
        const cu = _getCust(); if (cu[tab]) cu[tab] = cu[tab].filter(s=>s.id!==id);
        _setCust(cu); Utils.showToast('Excluída','success');
        renderStrategiesPage();
        setTimeout(() => document.querySelectorAll('.tab-btn[data-st]').forEach(b => { if (b.dataset.st===tab) b.click(); }), 50);
    }

    /* ═══════════ SAVED BACKTESTS ═══════════ */

    async function renderSavedPage() {
        const c = document.getElementById('pageContent');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
        try {
            const data = await API.listSavedBacktests();
            const list = data.backtests || [];
            if (!list.length) { c.innerHTML = '<p class="empty-state">Nenhum backtest salvo. Execute e salve um backtest para vê-lo aqui.</p>'; return; }
            c.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>Ativo</th><th>Estratégia</th><th>Retorno</th><th>Data</th><th>Ações</th></tr></thead><tbody>${list.map(bt => {
                const r = bt.result||bt; const cl = (r.total_return_pct||0)>=0?'positive':'negative';
                return `<tr><td>${r.id||bt.id||'--'}</td><td><strong>${r.ticker||'--'}</strong></td><td>${r.strategy||'--'}</td><td class="${cl}">${Utils.formatPercent(r.total_return_pct)}</td><td>${r.saved_at?Utils.formatDate(r.saved_at):'--'}</td><td><button class="btn-icon" data-view="${r.id||bt.id}"><i class="fas fa-eye"></i></button> <button class="btn-icon btn-delete" data-del="${r.id||bt.id}"><i class="fas fa-trash"></i></button></td></tr>`;
            }).join('')}</tbody></table></div><div id="savedDetail"></div>`;
            c.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', async () => {
                try { const bt = await API.getSavedBacktest(b.dataset.view); renderBtResult(document.getElementById('savedDetail'), bt.result||bt); }
                catch (e) { Utils.showToast('Erro: '+e.message,'error'); }
            }));
            c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
                if (!confirm('Excluir?')) return;
                try { await API.deleteSavedBacktest(b.dataset.del); Utils.showToast('Excluído','success'); renderSavedPage(); }
                catch (e) { Utils.showToast('Erro: '+e.message,'error'); }
            }));
        } catch (e) { c.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`; }
    }

    /* ═══════════ CONFIG ═══════════ */

    function renderConfigPage() {
        const c = document.getElementById('pageContent');
        if (!configPin) {
            c.innerHTML = `<div class="config-login"><div class="login-card"><i class="fas fa-lock login-icon"></i><h3>Acesso Protegido</h3><p>Digite o PIN para acessar</p><div class="form-group"><input type="password" id="pinIn" class="form-input" placeholder="PIN" maxlength="10"></div><button class="btn btn-primary" id="btnPin" style="width:100%"><i class="fas fa-unlock"></i> Verificar</button></div></div>`;
            document.getElementById('pinIn').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('btnPin').click(); });
            document.getElementById('btnPin').addEventListener('click', async () => {
                const pin = document.getElementById('pinIn').value.trim();
                if (!pin) { Utils.showToast('Digite o PIN','error'); return; }
                try { const r = await API.verifyPin(pin); if (r.valid) { configPin = pin; Utils.showToast('Verificado!','success'); renderConfigPage(); } else Utils.showToast('PIN incorreto','error'); }
                catch (e) { Utils.showToast('Erro: '+e.message,'error'); }
            });
            return;
        }
        c.innerHTML = `<div class="config-panel">
            <div class="config-section"><h3><i class="fas fa-database"></i> Storage</h3><div id="cfStats"><div class="spinner"></div></div></div>
            <div class="config-section"><h3><i class="fas fa-download"></i> Download de Dados</h3><div class="form-row">
                <div class="form-group"><label>Ticker</label><input type="text" id="dlT" class="form-input" placeholder="PETR4"></div>
                <div class="form-group"><label>Início</label><input type="date" id="dlS" class="form-input" value="${Utils.getDefaultStartDate()}"></div>
                <div class="form-group"><label>Fim</label><input type="date" id="dlE" class="form-input" value="${Utils.getTodayDate()}"></div>
                <div class="form-group"><label>Timeframe</label><select id="dlTF" class="form-input"><option value="daily">Diário</option><option value="intraday">Intraday</option></select></div>
            </div><button class="btn btn-primary" id="btnDl"><i class="fas fa-download"></i> Baixar</button><div id="dlR"></div></div>
            <div class="config-section"><h3><i class="fas fa-sync-alt"></i> Atualização Manual</h3><p style="color:var(--text-secondary);font-size:.85rem;margin-bottom:.8rem">Atualizar todos os ativos.</p><button class="btn btn-primary" id="btnUpd"><i class="fas fa-sync-alt"></i> Atualizar Todos</button><div id="updR"></div></div>
            <div class="config-section"><h3><i class="fas fa-list"></i> Ativos Cadastrados</h3><div id="cfAssets"><div class="spinner"></div></div></div>
            <div class="config-section"><h3><i class="fas fa-key"></i> Alterar PIN</h3><div class="form-row"><div class="form-group"><label>Novo</label><input type="password" id="nPin" class="form-input" maxlength="10"></div><div class="form-group"><label>Confirmar</label><input type="password" id="cPin" class="form-input" maxlength="10"></div></div><button class="btn btn-primary" id="btnChg"><i class="fas fa-key"></i> Alterar</button></div>
            <div class="config-section"><button class="btn btn-secondary" id="btnOut"><i class="fas fa-sign-out-alt"></i> Sair</button></div>
        </div>`;
        _loadCfStats(); _loadCfAssets();
        document.getElementById('btnDl').addEventListener('click', async () => {
            const t = document.getElementById('dlT').value.trim().toUpperCase();
            if (!t) { Utils.showToast('Ticker','error'); return; }
            const rd = document.getElementById('dlR'); rd.innerHTML = '<div class="spinner"></div>';
            try { const r = await API.downloadData({ pin:configPin, ticker:t, start_date:document.getElementById('dlS').value, end_date:document.getElementById('dlE').value, timeframe:document.getElementById('dlTF').value });
                rd.innerHTML = `<p class="${r.success?'positive':'negative'}">${r.message}</p>`; if (r.success) { _loadCfStats(); _loadCfAssets(); updateStorageIndicator(); }
            } catch (e) { rd.innerHTML = `<p class="negative">${e.message}</p>`; }
        });
        document.getElementById('btnUpd').addEventListener('click', async () => {
            const rd = document.getElementById('updR'); rd.innerHTML = '<div class="spinner"></div>';
            try { const r = await API.manualUpdate({ pin:configPin }); rd.innerHTML = `<p class="positive">${r.message}</p>`; _loadCfStats(); updateStorageIndicator(); }
            catch (e) { rd.innerHTML = `<p class="negative">${e.message}</p>`; }
        });
        document.getElementById('btnChg').addEventListener('click', async () => {
            const n = document.getElementById('nPin').value.trim(), co = document.getElementById('cPin').value.trim();
            if (!n||n!==co) { Utils.showToast('PINs não conferem','error'); return; }
            try { await API.changePin(configPin, n); configPin = n; Utils.showToast('PIN alterado!','success'); }
            catch (e) { Utils.showToast(e.message,'error'); }
        });
        document.getElementById('btnOut').addEventListener('click', () => { configPin = null; Utils.showToast('Saiu','success'); renderConfigPage(); });
    }

    async function _loadCfStats() {
        const el = document.getElementById('cfStats'); if (!el) return;
        try { const s = await API.getStorageStats();
            el.innerHTML = `<div class="stats-grid-mini"><div><strong>${s.total_assets||0}</strong><span>Ativos</span></div><div><strong>${s.daily_assets||0}</strong><span>Daily</span></div><div><strong>${s.intraday_assets||0}</strong><span>Intraday</span></div><div><strong>${s.total_records||0}</strong><span>Registros</span></div><div><strong>${s.total_backtests||0}</strong><span>Backtests</span></div><div><strong>${s.storage_type||'supabase'}</strong><span>Storage</span></div></div>`;
        } catch (_) { el.innerHTML = '<p class="negative">Erro</p>'; }
    }

    async function _loadCfAssets() {
        const el = document.getElementById('cfAssets'); if (!el) return;
        try { const d = await API.listSavedAssets(); const as = d.assets||[];
            if (!as.length) { el.innerHTML = '<p>Nenhum ativo cadastrado.</p>'; return; }
            el.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th>Ticker</th><th>Nome</th><th>TF</th><th>Reg</th><th></th></tr></thead><tbody>${as.map(a => `<tr><td><strong>${a.ticker}</strong></td><td>${a.name||'--'}</td><td>${a.timeframe||'daily'}</td><td>${a.records||0}</td><td><button class="btn-icon btn-delete" data-dt="${a.ticker}"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`;
            el.querySelectorAll('[data-dt]').forEach(b => b.addEventListener('click', async () => {
                if (!confirm('Excluir '+b.dataset.dt+'?')) return;
                try { await API.deleteAsset(b.dataset.dt, configPin); Utils.showToast('Excluído','success'); _loadCfAssets(); _loadCfStats(); updateStorageIndicator(); }
                catch (e) { Utils.showToast(e.message,'error'); }
            }));
        } catch (_) { el.innerHTML = '<p class="negative">Erro</p>'; }
    }

    /* ═══════════ BOOT ═══════════ */

    document.addEventListener('DOMContentLoaded', () => {
        init();
        setTimeout(() => { const o = document.getElementById('loadingOverlay'); if (o) { o.classList.add('hidden'); setTimeout(() => o.style.display='none', 500); } }, 600);
    });

    return { navigateTo, init };
})();
