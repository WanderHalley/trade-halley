/**
 * Trade Halley - Frontend App v2.2
 * SPA — usa API global declarado em api.js
 * NÃO redeclara API aqui.
 */

const APP = {
    pin: null,
    currentPage: 'dashboard',
    charts: {},
    _lastBacktest: null,
};

// ═══════════════════════════════════════════
// Se API não existe (api.js não carregou), cria fallback
// ═══════════════════════════════════════════
if (typeof API === 'undefined') {
    console.warn('api.js não carregou, usando fallback');
    var API = {
        BASE: 'https://wanderhalleylee-trade-halley.hf.space',
        BRAPI_BASE: 'https://brapi.dev/api',
        BRAPI_TOKEN: 'ktC3hLVgH3QXrFnssfbcUj',
    };
}

// Garante que os métodos helper existem
if (!API.get) {
    API.get = async function(endpoint) {
        try {
            const base = API.BASE || API.API_BASE || 'https://wanderhalleylee-trade-halley.hf.space';
            const resp = await fetch(`${base}${endpoint}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            console.error(`API GET ${endpoint}:`, e);
            return null;
        }
    };
}

if (!API.post) {
    API.post = async function(endpoint, body) {
        try {
            const base = API.BASE || API.API_BASE || 'https://wanderhalleylee-trade-halley.hf.space';
            const resp = await fetch(`${base}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            console.error(`API POST ${endpoint}:`, e);
            return null;
        }
    };
}

if (!API.del) {
    API.del = async function(endpoint) {
        try {
            const base = API.BASE || API.API_BASE || 'https://wanderhalleylee-trade-halley.hf.space';
            const resp = await fetch(`${base}${endpoint}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            console.error(`API DELETE ${endpoint}:`, e);
            return null;
        }
    };
}

if (!API.brapiQuote) {
    API.brapiQuote = async function(ticker) {
        try {
            const base = API.BRAPI_BASE || 'https://brapi.dev/api';
            const token = API.BRAPI_TOKEN || 'ktC3hLVgH3QXrFnssfbcUj';
            const url = `${base}/quote/${encodeURIComponent(ticker)}?token=${token}`;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.results && data.results[0] ? data.results[0] : null;
        } catch (e) {
            console.error(`brapi quote ${ticker}:`, e);
            return null;
        }
    };
}

if (!API.brapiHistory) {
    API.brapiHistory = async function(ticker, range, interval) {
        range = range || '3mo';
        interval = interval || '1d';
        try {
            const base = API.BRAPI_BASE || 'https://brapi.dev/api';
            const token = API.BRAPI_TOKEN || 'ktC3hLVgH3QXrFnssfbcUj';
            const url = `${base}/quote/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&token=${token}`;
            const resp = await fetch(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            const r = data.results && data.results[0];
            return r ? (r.historicalDataPrice || []) : [];
        } catch (e) {
            console.error(`brapi history ${ticker}:`, e);
            return [];
        }
    };
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

function navigate(page) {
    APP.currentPage = page;
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    const content = document.getElementById('main-content');
    if (!content) return;

    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'backtest': renderBacktest(); break;
        case 'bulk': renderBulk(); break;
        case 'compare': renderCompare(); break;
        case 'strategies': renderStrategies(); break;
        case 'saved': renderSaved(); break;
        case 'config': renderConfig(); break;
        default: renderDashboard();
    }
}

// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════

function fmt(n, decimals) {
    decimals = decimals != null ? decimals : 2;
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '—';
    return 'R$ ' + fmt(n);
}

function fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    var sign = n >= 0 ? '+' : '';
    return sign + fmt(n) + '%';
}

function changeColor(n) {
    if (n == null) return '';
    return n >= 0 ? 'text-success' : 'text-danger';
}

function destroyChart(id) {
    if (APP.charts[id]) {
        APP.charts[id].destroy();
        delete APP.charts[id];
    }
}

function showToast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;';
        document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'alert alert-' + type + ' alert-dismissible fade show';
    toast.role = 'alert';
    toast.innerHTML = msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 5000);
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════

async function renderDashboard() {
    var content = document.getElementById('main-content');
    content.innerHTML =
        '<h2 class="mb-4"><i class="bi bi-speedometer2 me-2"></i>Dashboard</h2>' +
        '<div id="dash-cards" class="row g-3 mb-4">' +
            '<div class="col-12 text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Carregando cotações...</p></div>' +
        '</div>' +
        '<div class="row g-3 mb-4">' +
            '<div class="col-md-8">' +
                '<div class="card shadow-sm">' +
                    '<div class="card-header"><h6 class="mb-0">PETR4 — Histórico (3 meses)</h6></div>' +
                    '<div class="card-body"><canvas id="chart-dash-main" height="300"></canvas></div>' +
                '</div>' +
            '</div>' +
            '<div class="col-md-4">' +
                '<div class="card shadow-sm">' +
                    '<div class="card-header"><h6 class="mb-0">Resumo</h6></div>' +
                    '<div class="card-body" id="dash-summary">Carregando...</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="card shadow-sm">' +
            '<div class="card-header"><h6 class="mb-0">Mercado</h6></div>' +
            '<div class="card-body"><div class="table-responsive">' +
                '<table class="table table-sm table-hover" id="dash-market-table">' +
                    '<thead><tr><th>Ticker</th><th>Nome</th><th class="text-end">Preço</th><th class="text-end">Variação</th><th class="text-end">Volume</th></tr></thead>' +
                    '<tbody></tbody>' +
                '</table>' +
            '</div></div>' +
        '</div>';

    var dashTickers = [
        { label: 'IBOV', brapi: '^BVSP' },
        { label: 'Dólar', brapi: 'USDBRL=X' },
        { label: 'PETR4', brapi: 'PETR4' },
        { label: 'VALE3', brapi: 'VALE3' },
        { label: 'ITUB4', brapi: 'ITUB4' },
        { label: 'BBDC4', brapi: 'BBDC4' },
        { label: 'WEGE3', brapi: 'WEGE3' },
        { label: 'BOVA11', brapi: 'BOVA11' },
    ];

    var quotes = [];
    var fetches = dashTickers.map(async function(t) {
        var q = await API.brapiQuote(t.brapi);
        if (q) quotes.push({ label: t.label, brapi: t.brapi, data: q });
    });
    await Promise.all(fetches);

    var cardsDiv = document.getElementById('dash-cards');
    if (!cardsDiv) return;

    if (quotes.length === 0) {
        cardsDiv.innerHTML = '<div class="col-12"><div class="alert alert-warning">Não foi possível carregar cotações.</div></div>';
    } else {
        cardsDiv.innerHTML = quotes.map(function(q) {
            var d = q.data;
            var price = d.regularMarketPrice;
            var change = d.regularMarketChange || 0;
            var changePct = d.regularMarketChangePercent || 0;
            var color = change >= 0 ? 'success' : 'danger';
            var arrow = change >= 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
            return '<div class="col-6 col-md-3">' +
                '<div class="card shadow-sm border-' + color + ' border-start border-4">' +
                    '<div class="card-body py-2 px-3">' +
                        '<div class="d-flex justify-content-between align-items-center">' +
                            '<small class="text-muted fw-bold">' + q.label + '</small>' +
                            '<i class="bi ' + arrow + ' text-' + color + ' fs-5"></i>' +
                        '</div>' +
                        '<div class="fs-5 fw-bold">' + fmt(price) + '</div>' +
                        '<small class="text-' + color + '">' + fmtPct(changePct) + '</small>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // Summary
    var summaryDiv = document.getElementById('dash-summary');
    if (summaryDiv) {
        var summaryData = await API.get('/dashboard/summary');
        if (summaryData) {
            summaryDiv.innerHTML =
                '<p><strong>Ativos B3:</strong> ' + summaryData.total_b3 + '</p>' +
                '<p><strong>Ativos BMF:</strong> ' + summaryData.total_bmf + '</p>' +
                '<p><strong>Estratégias:</strong> ' + summaryData.total_strategies + '</p>' +
                '<hr><p class="text-muted small">Dados via brapi.dev (plano free: máx. 3 meses)</p>';
        } else {
            summaryDiv.innerHTML = '<p class="text-muted">Erro ao carregar resumo.</p>';
        }
    }

    // Chart
    var hist = await API.brapiHistory('PETR4', '3mo', '1d');
    destroyChart('chart-dash-main');
    var canvas = document.getElementById('chart-dash-main');
    if (canvas && hist && hist.length > 0) {
        var labels = hist.map(function(h) {
            var d = new Date(h.date * 1000);
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        var prices = hist.map(function(h) { return h.close; });

        APP.charts['chart-dash-main'] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PETR4 (Fechamento)',
                    data: prices,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13,110,253,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { maxTicksAutoSkip: true, maxRotation: 0 } },
                    y: { ticks: { callback: function(v) { return 'R$ ' + v; } } },
                },
            },
        });
    }

    // Market table
    var tbody = document.querySelector('#dash-market-table tbody');
    if (tbody && quotes.length > 0) {
        tbody.innerHTML = quotes.map(function(q) {
            var d = q.data;
            var color = (d.regularMarketChange || 0) >= 0 ? 'text-success' : 'text-danger';
            var vol = d.regularMarketVolume ? Number(d.regularMarketVolume).toLocaleString('pt-BR') : '—';
            return '<tr>' +
                '<td class="fw-bold">' + q.label + '</td>' +
                '<td>' + (d.longName || d.shortName || '—') + '</td>' +
                '<td class="text-end">' + fmt(d.regularMarketPrice) + '</td>' +
                '<td class="text-end ' + color + '">' + fmtPct(d.regularMarketChangePercent) + '</td>' +
                '<td class="text-end">' + vol + '</td>' +
            '</tr>';
        }).join('');
    }
}

// ═══════════════════════════════════════════
// STRATEGIES LOADER (shared)
// ═══════════════════════════════════════════

async function loadStrategies(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando...</option>';
    var data = await API.get('/strategies');
    if (!data || !data.strategies || data.strategies.length === 0) {
        sel.innerHTML = '<option value="">Nenhuma estratégia</option>';
        return;
    }
    sel.innerHTML = '<option value="">Selecione...</option>';
    data.strategies.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name + ' (' + s.category + ')';
        sel.appendChild(opt);
    });
}

async function loadTickers(selectId, market) {
    market = market || 'b3';
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando...</option>';
    var data = await API.get('/assets?market=' + market);
    if (!data) { sel.innerHTML = '<option value="">Erro</option>'; return; }
    sel.innerHTML = '<option value="">Selecione...</option>';
    var list = data.b3 || data.bmf || [];
    list.forEach(function(a) {
        var opt = document.createElement('option');
        opt.value = a.ticker;
        opt.textContent = a.ticker;
        sel.appendChild(opt);
    });
}

// ═══════════════════════════════════════════
// BACKTEST — SINGLE
// ═══════════════════════════════════════════

async function renderBacktest() {
    var content = document.getElementById('main-content');
    content.innerHTML =
        '<h2 class="mb-4"><i class="bi bi-graph-up me-2"></i>Backtest Individual</h2>' +
        '<div class="card shadow-sm mb-4"><div class="card-body"><div class="row g-3">' +
            '<div class="col-md-3"><label class="form-label">Ativo</label><select id="bt-ticker" class="form-select"></select></div>' +
            '<div class="col-md-3"><label class="form-label">Estratégia</label><select id="bt-strategy" class="form-select"></select></div>' +
            '<div class="col-md-2"><label class="form-label">Período</label><select id="bt-period" class="form-select">' +
                '<option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option><option value="2y">2 anos</option>' +
            '</select></div>' +
            '<div class="col-md-2"><label class="form-label">Capital</label><input type="number" id="bt-capital" class="form-control" value="10000" min="100"></div>' +
            '<div class="col-md-2 d-flex align-items-end"><button class="btn btn-primary w-100" onclick="runBacktest()"><i class="bi bi-play-fill me-1"></i>Executar</button></div>' +
        '</div></div></div>' +
        '<div id="bt-result"></div>';

    await Promise.all([loadTickers('bt-ticker', 'b3'), loadStrategies('bt-strategy')]);
}

async function runBacktest() {
    var ticker = document.getElementById('bt-ticker').value;
    var strategy = document.getElementById('bt-strategy').value;
    var period = document.getElementById('bt-period').value;
    var capital = document.getElementById('bt-capital').value;

    if (!ticker || !strategy) { showToast('Selecione ativo e estratégia', 'warning'); return; }

    var resultDiv = document.getElementById('bt-result');
    resultDiv.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-primary"></div><p class="mt-2">Executando backtest...</p></div>';

    var data = await API.get('/backtest?ticker=' + ticker + '&strategy=' + strategy + '&period=' + period + '&interval=1d&capital=' + capital);

    if (!data || !data.metrics) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Erro ao executar backtest. Verifique se há dados suficientes.</div>';
        return;
    }

    var m = data.metrics;
    var returnColor = m.total_return_pct >= 0 ? 'success' : 'danger';

    resultDiv.innerHTML =
        '<div class="row g-3 mb-4">' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body text-center">' +
                '<small class="text-muted">Retorno Total</small><div class="fs-4 fw-bold text-' + returnColor + '">' + fmtPct(m.total_return_pct) + '</div><small>' + fmtCurrency(m.total_return) + '</small>' +
            '</div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body text-center">' +
                '<small class="text-muted">Win Rate</small><div class="fs-4 fw-bold">' + fmt(m.win_rate) + '%</div><small>' + m.winning_trades + 'W / ' + m.losing_trades + 'L</small>' +
            '</div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body text-center">' +
                '<small class="text-muted">Profit Factor</small><div class="fs-4 fw-bold">' + fmt(m.profit_factor) + '</div><small>Sharpe: ' + fmt(m.sharpe_ratio) + '</small>' +
            '</div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body text-center">' +
                '<small class="text-muted">Max Drawdown</small><div class="fs-4 fw-bold text-danger">-' + fmt(m.max_drawdown_pct) + '%</div><small>' + fmtCurrency(m.max_drawdown) + '</small>' +
            '</div></div></div>' +
        '</div>' +
        '<div class="row g-3 mb-4">' +
            '<div class="col-md-8"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Curva de Capital</h6></div>' +
                '<div class="card-body"><canvas id="chart-equity" height="280"></canvas></div></div></div>' +
            '<div class="col-md-4"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Detalhes</h6></div>' +
                '<div class="card-body">' +
                    '<p><strong>Ativo:</strong> ' + data.ticker + '</p>' +
                    '<p><strong>Estratégia:</strong> ' + (data.strategy_name || data.strategy_id) + '</p>' +
                    '<p><strong>Período:</strong> ' + data.period + ' | ' + data.data_points + ' candles</p>' +
                    '<p><strong>Capital Inicial:</strong> ' + fmtCurrency(m.initial_capital) + '</p>' +
                    '<p><strong>Capital Final:</strong> ' + fmtCurrency(m.final_equity) + '</p>' +
                    '<p><strong>Total Trades:</strong> ' + m.total_trades + '</p>' +
                    '<hr><button class="btn btn-sm btn-outline-primary" onclick="saveBacktest()" id="btn-save-bt"><i class="bi bi-save me-1"></i>Salvar</button>' +
                '</div></div></div>' +
        '</div>' +
        '<div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Últimas Operações</h6></div>' +
            '<div class="card-body"><div class="table-responsive"><table class="table table-sm table-hover">' +
                '<thead><tr><th>Entrada</th><th>Saída</th><th>Preço E.</th><th>Preço S.</th><th>Qtd</th><th>Lucro</th><th>%</th></tr></thead>' +
                '<tbody>' + (data.trades || []).map(function(t) {
                    var c = t.profit >= 0 ? 'text-success' : 'text-danger';
                    return '<tr><td>' + t.entry_date + '</td><td>' + t.exit_date + '</td><td>' + fmt(t.entry_price) + '</td><td>' + fmt(t.exit_price) + '</td><td>' + t.shares + '</td><td class="' + c + '">' + fmtCurrency(t.profit) + '</td><td class="' + c + '">' + fmtPct(t.return_pct) + '</td></tr>';
                }).join('') + '</tbody></table></div></div></div>';

    APP._lastBacktest = data;

    // Equity chart
    if (data.equity_curve && data.equity_curve.length > 0) {
        destroyChart('chart-equity');
        var eqCanvas = document.getElementById('chart-equity');
        if (eqCanvas) {
            var eqColor = m.total_return_pct >= 0 ? '#198754' : '#dc3545';
            var eqBg = m.total_return_pct >= 0 ? 'rgba(25,135,84,0.1)' : 'rgba(220,53,69,0.1)';
            APP.charts['chart-equity'] = new Chart(eqCanvas, {
                type: 'line',
                data: {
                    labels: data.equity_curve.map(function(e) { return e.date; }),
                    datasets: [{
                        label: 'Capital',
                        data: data.equity_curve.map(function(e) { return e.equity; }),
                        borderColor: eqColor,
                        backgroundColor: eqBg,
                        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { maxTicksAutoSkip: true, maxRotation: 0 } },
                        y: { ticks: { callback: function(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR'); } } },
                    },
                },
            });
        }
    }
}

async function saveBacktest() {
    if (!APP._lastBacktest) return;
    var btn = document.getElementById('btn-save-bt');
    if (btn) btn.disabled = true;
    var resp = await API.post('/backtests/save', { result: APP._lastBacktest });
    if (resp && resp.success) { showToast('Backtest salvo!', 'success'); }
    else { showToast('Erro ao salvar', 'danger'); }
    if (btn) btn.disabled = false;
}

// ═══════════════════════════════════════════
// BACKTEST — BULK
// ═══════════════════════════════════════════

async function renderBulk() {
    var content = document.getElementById('main-content');
    content.innerHTML =
        '<h2 class="mb-4"><i class="bi bi-collection me-2"></i>Backtest em Massa</h2>' +
        '<div class="card shadow-sm mb-4"><div class="card-body"><div class="row g-3">' +
            '<div class="col-md-3"><label class="form-label">Mercado</label><select id="bulk-market" class="form-select"><option value="b3">B3</option><option value="bmf">BMF</option></select></div>' +
            '<div class="col-md-3"><label class="form-label">Estratégia</label><select id="bulk-strategy" class="form-select"></select></div>' +
            '<div class="col-md-2"><label class="form-label">Período</label><select id="bulk-period" class="form-select"><option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option></select></div>' +
            '<div class="col-md-2"><label class="form-label">Capital</label><input type="number" id="bulk-capital" class="form-control" value="10000"></div>' +
            '<div class="col-md-2 d-flex align-items-end"><button class="btn btn-primary w-100" onclick="runBulk()"><i class="bi bi-play-fill me-1"></i>Executar</button></div>' +
        '</div></div></div><div id="bulk-result"></div>';
    await loadStrategies('bulk-strategy');
}

async function runBulk() {
    var market = document.getElementById('bulk-market').value;
    var strategy = document.getElementById('bulk-strategy').value;
    var period = document.getElementById('bulk-period').value;
    var capital = document.getElementById('bulk-capital').value;
    if (!strategy) { showToast('Selecione uma estratégia', 'warning'); return; }

    var resultDiv = document.getElementById('bulk-result');
    resultDiv.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-primary"></div><p class="mt-2">Executando... (pode demorar)</p></div>';

    var data = await API.get('/backtest/bulk?market=' + market + '&strategy=' + strategy + '&period=' + period + '&interval=1d&capital=' + capital);
    if (!data || !data.results) { resultDiv.innerHTML = '<div class="alert alert-danger">Erro ao executar.</div>'; return; }

    resultDiv.innerHTML =
        '<div class="alert alert-info">' + data.total_tested + ' ativos testados</div>' +
        '<div class="card shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table table-sm table-hover table-striped">' +
            '<thead><tr><th>Ativo</th><th>Retorno %</th><th>Win Rate</th><th>Trades</th><th>PF</th><th>Max DD%</th><th>Sharpe</th><th>Capital Final</th></tr></thead>' +
            '<tbody>' + data.results.map(function(r) {
                var c = r.total_return_pct >= 0 ? 'text-success' : 'text-danger';
                return '<tr><td class="fw-bold">' + r.ticker + '</td><td class="' + c + '">' + fmtPct(r.total_return_pct) + '</td><td>' + fmt(r.win_rate) + '%</td><td>' + r.total_trades + '</td><td>' + fmt(r.profit_factor) + '</td><td class="text-danger">-' + fmt(r.max_drawdown_pct) + '%</td><td>' + fmt(r.sharpe_ratio) + '</td><td>' + fmtCurrency(r.final_equity) + '</td></tr>';
            }).join('') + '</tbody></table></div></div></div>';
}

// ═══════════════════════════════════════════
// BACKTEST — COMPARE
// ═══════════════════════════════════════════

async function renderCompare() {
    var content = document.getElementById('main-content');
    content.innerHTML =
        '<h2 class="mb-4"><i class="bi bi-bar-chart me-2"></i>Comparar Estratégias</h2>' +
        '<div class="card shadow-sm mb-4"><div class="card-body"><div class="row g-3">' +
            '<div class="col-md-4"><label class="form-label">Ativo</label><select id="cmp-ticker" class="form-select"></select></div>' +
            '<div class="col-md-3"><label class="form-label">Período</label><select id="cmp-period" class="form-select"><option value="3mo">3 meses</option><option value="6mo">6 meses</option><option value="1y" selected>1 ano</option></select></div>' +
            '<div class="col-md-3"><label class="form-label">Capital</label><input type="number" id="cmp-capital" class="form-control" value="10000"></div>' +
            '<div class="col-md-2 d-flex align-items-end"><button class="btn btn-primary w-100" onclick="runCompare()"><i class="bi bi-play-fill me-1"></i>Comparar</button></div>' +
        '</div></div></div><div id="cmp-result"></div>';
    await loadTickers('cmp-ticker', 'b3');
}

async function runCompare() {
    var ticker = document.getElementById('cmp-ticker').value;
    var period = document.getElementById('cmp-period').value;
    var capital = document.getElementById('cmp-capital').value;
    if (!ticker) { showToast('Selecione um ativo', 'warning'); return; }

    var resultDiv = document.getElementById('cmp-result');
    resultDiv.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-primary"></div><p class="mt-2">Comparando estratégias...</p></div>';

    var data = await API.get('/backtest/compare?ticker=' + ticker + '&period=' + period + '&interval=1d&capital=' + capital);
    if (!data || !data.results) { resultDiv.innerHTML = '<div class="alert alert-danger">Erro ao comparar.</div>'; return; }

    resultDiv.innerHTML =
        '<div class="alert alert-info">' + data.total_strategies + ' estratégias testadas com ' + ticker + '</div>' +
        '<div class="row g-3 mb-4">' +
            '<div class="col-md-8"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Retorno por Estratégia</h6></div>' +
                '<div class="card-body"><canvas id="chart-compare" height="300"></canvas></div></div></div>' +
            '<div class="col-md-4"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Ranking</h6></div>' +
                '<div class="card-body"><div class="table-responsive"><table class="table table-sm">' +
                    '<thead><tr><th>#</th><th>Estratégia</th><th>Retorno</th></tr></thead>' +
                    '<tbody>' + data.results.map(function(r, i) {
                        var met = r.metrics || {};
                        var c = (met.total_return_pct || 0) >= 0 ? 'text-success' : 'text-danger';
                        return '<tr><td>' + (i+1) + '</td><td>' + (r.strategy_name || r.strategy_id) + '</td><td class="' + c + '">' + fmtPct(met.total_return_pct) + '</td></tr>';
                    }).join('') + '</tbody></table></div></div></div>' +
        '</div>';

    destroyChart('chart-compare');
    var cmpCanvas = document.getElementById('chart-compare');
    if (cmpCanvas && data.results.length > 0) {
        var cmpLabels = data.results.map(function(r) { return r.strategy_name || r.strategy_id; });
        var cmpValues = data.results.map(function(r) { return (r.metrics || {}).total_return_pct || 0; });
        var cmpColors = cmpValues.map(function(v) { return v >= 0 ? '#198754' : '#dc3545'; });
        APP.charts['chart-compare'] = new Chart(cmpCanvas, {
            type: 'bar',
            data: { labels: cmpLabels, datasets: [{ label: 'Retorno %', data: cmpValues, backgroundColor: cmpColors }] },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { callback: function(v) { return v + '%'; } } } },
            },
        });
    }
}

// ═══════════════════════════════════════════
// STRATEGIES
// ═══════════════════════════════════════════

async function renderStrategies() {
    var content = document.getElementById('main-content');
    content.innerHTML = '<h2 class="mb-4"><i class="bi bi-lightbulb me-2"></i>Estratégias</h2><div id="strats-list"><div class="text-center my-4"><div class="spinner-border text-primary"></div></div></div>';

    var data = await API.get('/strategies');
    var listDiv = document.getElementById('strats-list');
    if (!data || !data.strategies || data.strategies.length === 0) {
        listDiv.innerHTML = '<div class="alert alert-warning">Nenhuma estratégia encontrada.</div>';
        return;
    }

    var groups = {};
    data.strategies.forEach(function(s) {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
    });

    var html = '';
    for (var cat in groups) {
        html += '<h5 class="mt-4 mb-3"><span class="badge bg-secondary">' + cat + '</span></h5><div class="row g-3">';
        groups[cat].forEach(function(s) {
            html += '<div class="col-md-4"><div class="card shadow-sm h-100"><div class="card-body">' +
                '<h6 class="card-title">' + s.name + '</h6>' +
                '<p class="card-text text-muted small">' + s.description + '</p>' +
                '<code class="small">' + s.id + '</code>' +
            '</div></div></div>';
        });
        html += '</div>';
    }
    listDiv.innerHTML = html;
}

// ═══════════════════════════════════════════
// SAVED BACKTESTS
// ═══════════════════════════════════════════

async function renderSaved() {
    var content = document.getElementById('main-content');
    content.innerHTML = '<h2 class="mb-4"><i class="bi bi-bookmark me-2"></i>Backtests Salvos</h2><div id="saved-list"><div class="text-center my-4"><div class="spinner-border text-primary"></div></div></div>';

    var data = await API.get('/backtests/saved');
    var list = (data && data.backtests) || [];
    var listDiv = document.getElementById('saved-list');

    if (list.length === 0) {
        listDiv.innerHTML = '<div class="alert alert-info">Nenhum backtest salvo ainda.</div>';
        return;
    }

    listDiv.innerHTML =
        '<div class="card shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table table-sm table-hover">' +
            '<thead><tr><th>ID</th><th>Ativo</th><th>Estratégia</th><th>Retorno</th><th>Data</th><th></th></tr></thead>' +
            '<tbody>' + list.map(function(bt) {
                var c = bt.total_return_pct >= 0 ? 'text-success' : 'text-danger';
                return '<tr><td><code>' + bt.id + '</code></td><td class="fw-bold">' + bt.ticker + '</td><td>' + bt.strategy + '</td><td class="' + c + '">' + fmtPct(bt.total_return_pct) + '</td><td>' + new Date(bt.saved_at).toLocaleDateString('pt-BR') + '</td><td><button class="btn btn-sm btn-outline-danger" onclick="deleteSavedBt(\'' + bt.id + '\')"><i class="bi bi-trash"></i></button></td></tr>';
            }).join('') + '</tbody></table></div></div></div>';
}

async function deleteSavedBt(id) {
    if (!confirm('Remover backtest salvo?')) return;
    await API.del('/backtests/saved/' + id);
    renderSaved();
}

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════

async function renderConfig() {
    var content = document.getElementById('main-content');

    if (!APP.pin) {
        content.innerHTML =
            '<h2 class="mb-4"><i class="bi bi-gear me-2"></i>Configurações</h2>' +
            '<div class="card shadow-sm" style="max-width:400px;"><div class="card-body">' +
                '<h5>Autenticação</h5><p class="text-muted">Digite o PIN para acessar.</p>' +
                '<div class="mb-3"><input type="password" id="cfg-pin" class="form-control" placeholder="PIN" maxlength="10"></div>' +
                '<button class="btn btn-primary" onclick="verifyPin()">Entrar</button>' +
                '<div id="pin-error" class="text-danger mt-2" style="display:none;"></div>' +
            '</div></div>';
        return;
    }

    content.innerHTML =
        '<h2 class="mb-4"><i class="bi bi-gear me-2"></i>Configurações</h2>' +
        '<div class="row g-4">' +
            '<div class="col-md-6"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Armazenamento</h6></div><div class="card-body" id="cfg-storage">Carregando...</div></div></div>' +
            '<div class="col-md-6"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Download de Dados</h6></div><div class="card-body">' +
                '<div class="mb-3"><label class="form-label">Ativo</label><input type="text" id="cfg-dl-ticker" class="form-control" placeholder="Ex: PETR4"></div>' +
                '<div class="row g-2 mb-3"><div class="col"><label class="form-label">Início</label><input type="date" id="cfg-dl-start" class="form-control"></div><div class="col"><label class="form-label">Fim</label><input type="date" id="cfg-dl-end" class="form-control"></div></div>' +
                '<button class="btn btn-primary" onclick="downloadData()"><i class="bi bi-download me-1"></i>Baixar</button><div id="cfg-dl-result" class="mt-2"></div>' +
            '</div></div></div>' +
            '<div class="col-md-6"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Atualização Manual</h6></div><div class="card-body">' +
                '<p class="text-muted">Atualizar dados dos ativos B3.</p>' +
                '<button class="btn btn-warning" onclick="manualUpdate()" id="btn-update"><i class="bi bi-arrow-clockwise me-1"></i>Atualizar Tudo</button><div id="cfg-update-result" class="mt-2"></div>' +
            '</div></div></div>' +
            '<div class="col-md-6"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Alterar PIN</h6></div><div class="card-body">' +
                '<div class="mb-3"><input type="password" id="cfg-new-pin" class="form-control" placeholder="Novo PIN"></div>' +
                '<button class="btn btn-outline-primary" onclick="changePin()">Alterar</button><div id="cfg-pin-result" class="mt-2"></div>' +
            '</div></div></div>' +
            '<div class="col-12"><div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Ativos Salvos</h6></div><div class="card-body" id="cfg-assets">Carregando...</div></div></div>' +
        '</div>' +
        '<div class="mt-3"><button class="btn btn-outline-secondary" onclick="logout()"><i class="bi bi-box-arrow-left me-1"></i>Sair</button></div>';

    var stats = await API.get('/storage/stats');
    var storageDiv = document.getElementById('cfg-storage');
    if (storageDiv && stats) {
        storageDiv.innerHTML =
            '<p><strong>Ativos:</strong> ' + stats.total_assets + '</p>' +
            '<p><strong>Diários:</strong> ' + stats.daily_assets + ' | <strong>Intraday:</strong> ' + stats.intraday_assets + '</p>' +
            '<p><strong>Registros:</strong> ' + stats.total_records + '</p>' +
            '<p><strong>Backtests:</strong> ' + stats.total_backtests + '</p>' +
            '<p><strong>Última atualização:</strong> ' + (stats.last_auto_update || 'Nunca') + '</p>';
    }

    var assetsData = await API.get('/config/assets');
    var assetsDiv = document.getElementById('cfg-assets');
    var assets = (assetsData && assetsData.assets) || [];
    if (assetsDiv) {
        if (assets.length === 0) {
            assetsDiv.innerHTML = '<p class="text-muted">Nenhum ativo salvo.</p>';
        } else {
            assetsDiv.innerHTML = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Ticker</th><th>Nome</th><th>Atualizado</th><th></th></tr></thead><tbody>' +
                assets.map(function(a) {
                    return '<tr><td class="fw-bold">' + a.ticker + '</td><td>' + (a.name || '—') + '</td><td>' + (a.last_update ? new Date(a.last_update).toLocaleDateString('pt-BR') : '—') + '</td><td><button class="btn btn-sm btn-outline-danger" onclick="deleteAsset(\'' + a.ticker + '\')"><i class="bi bi-trash"></i></button></td></tr>';
                }).join('') + '</tbody></table></div>';
        }
    }
}

async function verifyPin() {
    var pin = document.getElementById('cfg-pin').value;
    var errorDiv = document.getElementById('pin-error');
    var resp = await API.post('/config/verify-pin', { pin: pin });
    if (resp && resp.valid) { APP.pin = pin; renderConfig(); }
    else { errorDiv.textContent = 'PIN incorreto'; errorDiv.style.display = 'block'; }
}

async function downloadData() {
    var ticker = document.getElementById('cfg-dl-ticker').value.toUpperCase();
    var start = document.getElementById('cfg-dl-start').value;
    var end = document.getElementById('cfg-dl-end').value;
    var resultDiv = document.getElementById('cfg-dl-result');
    if (!ticker) { resultDiv.innerHTML = '<span class="text-warning">Informe o ticker</span>'; return; }
    resultDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Baixando...';
    var resp = await API.post('/config/download-data', { pin: APP.pin, ticker: ticker, start_date: start || '2025-01-01', end_date: end || new Date().toISOString().split('T')[0], timeframe: 'daily' });
    if (resp && resp.success) { resultDiv.innerHTML = '<span class="text-success">' + resp.message + '</span>'; }
    else { resultDiv.innerHTML = '<span class="text-danger">' + (resp ? resp.message : 'Erro') + '</span>'; }
}

async function manualUpdate() {
    var btn = document.getElementById('btn-update');
    var resultDiv = document.getElementById('cfg-update-result');
    btn.disabled = true;
    resultDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-warning"></div> Atualizando...';
    var resp = await API.post('/config/update-all', { pin: APP.pin });
    btn.disabled = false;
    if (resp && resp.success) { resultDiv.innerHTML = '<span class="text-success">' + resp.message + '</span>'; }
    else { resultDiv.innerHTML = '<span class="text-danger">Erro na atualização</span>'; }
}

async function changePin() {
    var newPin = document.getElementById('cfg-new-pin').value;
    var resultDiv = document.getElementById('cfg-pin-result');
    if (!newPin) { resultDiv.innerHTML = '<span class="text-warning">Digite o novo PIN</span>'; return; }
    var resp = await API.post('/config/change-pin', { old_pin: APP.pin, new_pin: newPin });
    if (resp && resp.success) { APP.pin = newPin; resultDiv.innerHTML = '<span class="text-success">PIN alterado!</span>'; }
    else { resultDiv.innerHTML = '<span class="text-danger">Erro ao alterar</span>'; }
}

async function deleteAsset(ticker) {
    if (!confirm('Remover ' + ticker + ' e todos os seus dados?')) return;
    await API.del('/config/asset/' + ticker + '?pin=' + APP.pin);
    renderConfig();
}

function logout() { APP.pin = null; renderConfig(); }

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-link[data-page]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navigate(link.dataset.page);
        });
    });
    navigate('dashboard');
});
