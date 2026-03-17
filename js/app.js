/* ============================================================
   Trade Halley — Frontend Trade Certo v3.0
   Arquivo único: js/app.js
   ============================================================ */

(function () {
"use strict";

// ─── CONFIG ───
const CONFIG = {
    API_BASE: "https://wanderhalleylee-trade-halley.hf.space",
    BRAPI_BASE: "https://brapi.dev/api",
    BRAPI_TOKEN: "ktC3hLVgH3QXrFnssfbcUj",
};

// ─── API HELPER ───
const API = {
    async get(path) {
        try {
            const r = await fetch(CONFIG.API_BASE + path);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            console.error("API GET error:", path, e);
            return null;
        }
    },
    async post(path, body) {
        try {
            const r = await fetch(CONFIG.API_BASE + path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            console.error("API POST error:", path, e);
            return null;
        }
    },
    async del(path) {
        try {
            const r = await fetch(CONFIG.API_BASE + path, { method: "DELETE" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            console.error("API DELETE error:", path, e);
            return null;
        }
    },
};

// ─── SPINNER ───
function showSpinner() { document.getElementById("spinner").classList.add("show"); }
function hideSpinner() { document.getElementById("spinner").classList.remove("show"); }

// ─── NAVIGATION ───
function navigate(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const page = document.getElementById("page-" + pageId);
    if (page) page.classList.add("active");
    const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (nav) nav.classList.add("active");

    // Lazy load page data
    if (pageId === "dashboard") loadDashboard();
    else if (pageId === "strategies") loadStrategiesPage();
    else if (pageId === "saved") loadSavedBacktests();
    else if (pageId === "config") loadStorageStats();
    else if (pageId === "bt-b3-daily") initDailyForm();
    else if (pageId === "bt-b3-intraday") initIntradayForm("b3");
    else if (pageId === "bt-bmf-intraday") initIntradayForm("bmf");
    else if (pageId === "bt-indicators") initIndicatorForm();
}

// Bind sidebar clicks
document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
});

// ─── UTILITIES ───
function fmt(n, d = 2) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtMoney(n) {
    if (n == null || isNaN(n)) return "—";
    if (Math.abs(n) >= 1e9) return "R$ " + fmt(n / 1e9, 1) + "B";
    if (Math.abs(n) >= 1e6) return "R$ " + fmt(n / 1e6, 1) + "M";
    if (Math.abs(n) >= 1e3) return "R$ " + fmt(n / 1e3, 1) + "K";
    return "R$ " + fmt(n, 2);
}

function colorClass(val) {
    if (val > 0) return "text-green";
    if (val < 0) return "text-red";
    return "";
}

function generateHourOptions() {
    const opts = [];
    for (let h = 9; h <= 18; h++) {
        for (let m = 0; m < 60; m += 5) {
            const hh = String(h).padStart(2, "0");
            const mm = String(m).padStart(2, "0");
            opts.push(`${hh}:${mm}`);
        }
    }
    return opts;
}

function populateHourSelect(selectId, defaultVal) {
    const sel = document.getElementById(selectId);
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML = "";
    generateHourOptions().forEach(h => {
        const opt = document.createElement("option");
        opt.value = h; opt.textContent = h;
        if (h === defaultVal) opt.selected = true;
        sel.appendChild(opt);
    });
}

function populateSelect(selectId, items, valueKey, textKey) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item[valueKey];
        opt.textContent = item[textKey] || item[valueKey];
        sel.appendChild(opt);
    });
}

// ─── DIRECTION BUTTONS ───
window.setDirection = function (prefix, dir) {
    document.getElementById(prefix + "-direction").value = dir;
    const buyBtn = document.getElementById(prefix + "-dir-buy");
    const sellBtn = document.getElementById(prefix + "-dir-sell");
    if (dir === "compra") {
        buyBtn.classList.add("active");
        sellBtn.classList.remove("active");
    } else {
        sellBtn.classList.add("active");
        buyBtn.classList.remove("active");
    }
};

// ─── CHARTS ───
let charts = {};
function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    const data = await API.get("/dashboard/summary");
    if (!data) return;

    const statsDiv = document.getElementById("dashboard-stats");
    statsDiv.innerHTML = `
        <div class="stat-card"><div class="value text-blue">${data.total_b3 || 0}</div><div class="label">Ativos B3</div></div>
        <div class="stat-card"><div class="value text-purple">${data.total_bmf || 0}</div><div class="label">Ativos BMF</div></div>
        <div class="stat-card"><div class="value text-green">${data.total_strategies || 0}</div><div class="label">Indicadores</div></div>
        <div class="stat-card"><div class="value text-yellow">${data.total_daily_entry || 7}</div><div class="label">Entradas Daily</div></div>
        <div class="stat-card"><div class="value text-yellow">${data.total_daily_exit || 3}</div><div class="label">Saídas Daily</div></div>
        <div class="stat-card"><div class="value text-yellow">${data.total_intraday_entry || 12}</div><div class="label">Entradas Intra</div></div>
    `;

    // Quotes
    const quotesDiv = document.getElementById("dashboard-quotes");
    quotesDiv.innerHTML = "";
    if (data.top_tickers && data.top_tickers.length > 0) {
        data.top_tickers.forEach(t => {
            const chg = t.change_pct || 0;
            const cls = chg >= 0 ? "text-green" : "text-red";
            const icon = chg >= 0 ? "fa-arrow-up" : "fa-arrow-down";
            quotesDiv.innerHTML += `
                <div class="col-6 col-md-3 col-lg-2">
                    <div class="stat-card">
                        <div class="label">${t.ticker || t.symbol || "?"}</div>
                        <div class="value" style="font-size:1.1rem">${fmt(t.price)}</div>
                        <div class="${cls}" style="font-size:0.8rem">
                            <i class="fas ${icon}"></i> ${fmt(chg)}%
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        quotesDiv.innerHTML = '<div class="col-12 text-secondary">Sem cotações disponíveis</div>';
    }

    // Chart
    loadDashboardChart();
}

async function loadDashboardChart() {
    const data = await API.get("/market-data/PETR4?period=3mo&interval=1d");
    if (!data || !data.data) return;

    destroyChart("chart-dashboard");
    const ctx = document.getElementById("chart-dashboard");
    if (!ctx) return;

    const labels = data.data.map(d => d.date ? d.date.substring(0, 10) : "");
    const closes = data.data.map(d => d.close || d.Close || 0);

    charts["chart-dashboard"] = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "PETR4 Close",
                data: closes,
                borderColor: "#58a6ff",
                backgroundColor: "rgba(88,166,255,0.1)",
                fill: true, tension: 0.3, pointRadius: 0,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#e6edf3" } } },
            scales: {
                x: { ticks: { color: "#8b949e", maxTicksLimit: 10 }, grid: { color: "#30363d" } },
                y: { ticks: { color: "#8b949e" }, grid: { color: "#30363d" } },
            },
        },
    });
}


// ============================================================
// STRATEGIES PAGE
// ============================================================

async function loadStrategiesPage() {
    const data = await API.get("/strategies/all");
    if (!data) return;
    const div = document.getElementById("strategies-list");

    let html = "";

    const sections = [
        { key: "indicator_strategies", title: "Indicadores Técnicos", color: "text-blue" },
        { key: "daily_entry", title: "Entrada — Diário (Trade Certo)", color: "text-green" },
        { key: "daily_exit", title: "Saída — Diário (Trade Certo)", color: "text-red" },
        { key: "intraday_entry", title: "Entrada — Intraday (Trade Certo)", color: "text-yellow" },
        { key: "intraday_exit", title: "Saída — Intraday (Trade Certo)", color: "text-purple" },
    ];

    sections.forEach(sec => {
        const items = data[sec.key];
        if (!items || items.length === 0) return;
        html += `<h5 class="${sec.color} mt-3">${sec.title} (${items.length})</h5>`;
        html += '<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>';
        html += '<th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th></tr></thead><tbody>';
        items.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td></tr>`;
        });
        html += '</tbody></table></div>';
    });

    div.innerHTML = html || "Nenhuma estratégia encontrada.";
}


// ============================================================
// SAVED BACKTESTS
// ============================================================

async function loadSavedBacktests() {
    const data = await API.get("/backtests/saved");
    const div = document.getElementById("saved-list");

    if (!data || !data.backtests || data.backtests.length === 0) {
        div.innerHTML = "<p class='text-secondary'>Nenhum backtest salvo.</p>";
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>';
    html += '<th>ID</th><th>Ticker</th><th>Estratégia</th><th>Resultado %</th><th>Data</th><th></th>';
    html += '</tr></thead><tbody>';

    data.backtests.forEach(bt => {
        const res = bt.metrics ? bt.metrics.resultado_pct || bt.metrics.total_return_pct || 0 : 0;
        html += `<tr>
            <td><code>${bt.id || "?"}</code></td>
            <td>${bt.ticker || "—"}</td>
            <td>${bt.strategy_name || bt.entry_strategy_name || bt.strategy || "—"}</td>
            <td class="${colorClass(res)}">${fmt(res)}%</td>
            <td>${bt.saved_at ? bt.saved_at.substring(0, 10) : "—"}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteSaved('${bt.id}')"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    div.innerHTML = html;
}

window.deleteSaved = async function (id) {
    if (!confirm("Remover backtest salvo?")) return;
    await API.del("/backtests/saved/" + id);
    loadSavedBacktests();
};


// ============================================================
// CONFIG
// ============================================================

async function loadStorageStats() {
    const data = await API.get("/storage/stats");
    const div = document.getElementById("cfg-storage-stats");
    if (!data) { div.innerHTML = "Erro ao carregar."; return; }
    div.innerHTML = `
        <p>Total ativos: <strong>${data.total_assets || 0}</strong></p>
        <p>Registros diários: <strong>${data.daily_assets || 0}</strong></p>
        <p>Registros intraday: <strong>${data.intraday_assets || 0}</strong></p>
        <p>Backtests salvos: <strong>${data.total_backtests || 0}</strong></p>
        <p>Último update: <strong>${data.last_auto_update || "—"}</strong></p>
    `;
}

window.verifyPin = async function () {
    const pin = document.getElementById("cfg-pin").value;
    const data = await API.post("/config/verify-pin", { pin });
    const div = document.getElementById("cfg-pin-result");
    if (data && data.valid) {
        div.innerHTML = '<span class="text-green"><i class="fas fa-check"></i> PIN válido</span>';
    } else {
        div.innerHTML = '<span class="text-red"><i class="fas fa-times"></i> PIN inválido</span>';
    }
};

window.changePin = async function () {
    const old_pin = document.getElementById("cfg-old-pin").value;
    const new_pin = document.getElementById("cfg-new-pin").value;
    const data = await API.post("/config/change-pin", { old_pin, new_pin });
    const div = document.getElementById("cfg-pin-change-result");
    if (data && data.success) {
        div.innerHTML = '<span class="text-green"><i class="fas fa-check"></i> PIN alterado</span>';
    } else {
        div.innerHTML = '<span class="text-red"><i class="fas fa-times"></i> Erro ao alterar PIN</span>';
    }
};

window.downloadData = async function () {
    const pin = document.getElementById("cfg-pin").value;
    const ticker = document.getElementById("cfg-dl-ticker").value;
    const div = document.getElementById("cfg-dl-result");
    if (!pin || !ticker) { div.innerHTML = '<span class="text-red">Preencha PIN e Ticker</span>'; return; }
    showSpinner();
    const data = await API.post("/config/download-data", { pin, ticker, start_date: "", end_date: "", timeframe: "daily" });
    hideSpinner();
    if (data && data.success) {
        div.innerHTML = `<span class="text-green"><i class="fas fa-check"></i> ${data.message || "Dados baixados"}</span>`;
    } else {
        div.innerHTML = `<span class="text-red"><i class="fas fa-times"></i> ${data ? data.message || "Erro" : "Erro"}</span>`;
    }
};

// ============================================================
// DAILY BACKTEST FORM
// ============================================================

let dailyStrategiesLoaded = false;

async function initDailyForm() {
    if (dailyStrategiesLoaded) return;

    // Market toggle
    document.getElementById("daily-market").addEventListener("change", function () {
        document.getElementById("daily-tickers-wrap").style.display = this.value === "custom" ? "" : "none";
    });

    // Load entry strategies
    const entryData = await API.get("/strategies/daily/entry");
    if (entryData && entryData.strategies) {
        populateSelect("daily-entry-strategy", entryData.strategies, "id", "name");
    }

    // Load exit strategies
    const exitData = await API.get("/strategies/daily/exit");
    if (exitData && exitData.strategies) {
        populateSelect("daily-exit-strategy", exitData.strategies, "id", "name");
    }

    dailyStrategiesLoaded = true;
}

window.runDailyBacktest = async function () {
    const market = document.getElementById("daily-market").value;
    const customTickers = document.getElementById("daily-tickers").value.trim();
    const direction = document.getElementById("daily-direction").value;
    const entryStrat = document.getElementById("daily-entry-strategy").value;
    const exitStrat = document.getElementById("daily-exit-strategy").value;
    const variation = parseFloat(document.getElementById("daily-variation").value) || 0;
    const period = document.getElementById("daily-period").value;
    const capital = parseFloat(document.getElementById("daily-capital").value) || 10000;
    const startDate = document.getElementById("daily-start-date").value || null;
    const endDate = document.getElementById("daily-end-date").value || null;

    const body = {
        entry_strategy: entryStrat,
        exit_strategy: exitStrat,
        direction,
        variation_pct: variation,
        period,
        initial_capital: capital,
        start_date: startDate,
        end_date: endDate,
    };

    if (market === "custom" && customTickers) {
        body.tickers = customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    } else {
        body.market = "b3";
    }

    showSpinner();
    const data = await API.post("/backtest/daily", body);
    hideSpinner();

    if (!data) { alert("Erro ao executar backtest"); return; }

    displayDailyResults(data);
};

function displayDailyResults(data) {
    const card = document.getElementById("daily-results-card");
    const tbody = document.querySelector("#daily-results-table tbody");
    card.style.display = "";
    tbody.innerHTML = "";

    // Se veio resultado único (ticker), converte em array
    let results = data.results || [];
    if (results.length === 0 && data.metrics) {
        results = [{
            acao: data.ticker,
            total_gain: data.metrics.total_gain,
            pct_gain: data.metrics.pct_gain,
            total_loss: data.metrics.total_loss,
            pct_loss: data.metrics.pct_loss,
            total_trades: data.metrics.total_trades,
            resultado_pct: data.metrics.resultado_pct,
            max_drawdown_pct: data.metrics.max_drawdown_pct,
            ganho_maximo_pct: data.metrics.ganho_maximo_pct,
            ganho_medio_pct: data.metrics.ganho_medio_pct,
            volume_medio: data.metrics.volume_medio,
        }];
    }

    results.forEach(r => {
        const res = r.resultado_pct || 0;
        tbody.innerHTML += `<tr>
            <td><strong>${r.acao}</strong></td>
            <td>${r.total_gain}</td>
            <td>${fmt(r.pct_gain)}%</td>
            <td>${r.total_loss}</td>
            <td>${fmt(r.pct_loss)}%</td>
            <td>${r.total_trades}</td>
            <td class="${colorClass(res)}"><strong>${fmt(res)}%</strong></td>
            <td class="text-red">${fmt(r.max_drawdown_pct)}%</td>
            <td class="text-green">${fmt(r.ganho_maximo_pct)}%</td>
            <td>${fmt(r.ganho_medio_pct, 4)}%</td>
            <td>${fmtMoney(r.volume_medio)}</td>
        </tr>`;
    });
}


// ============================================================
// INDICATOR BACKTEST
// ============================================================

let indStratsLoaded = false;

async function initIndicatorForm() {
    if (indStratsLoaded) return;
    const data = await API.get("/strategies");
    if (data && data.strategies) {
        populateSelect("ind-strategy", data.strategies, "id", "name");
    }
    indStratsLoaded = true;
}

window.runIndicatorBacktest = async function () {
    const ticker = document.getElementById("ind-ticker").value.trim().toUpperCase();
    const strategy = document.getElementById("ind-strategy").value;
    const period = document.getElementById("ind-period").value;
    const interval = document.getElementById("ind-interval").value;
    const capital = parseFloat(document.getElementById("ind-capital").value) || 10000;

    if (!ticker || !strategy) { alert("Preencha todos os campos"); return; }

    showSpinner();
    const url = `/backtest?ticker=${ticker}&strategy=${strategy}&period=${period}&interval=${interval}&capital=${capital}`;
    const data = await API.get(url);
    hideSpinner();

    if (!data || !data.metrics) { alert("Sem resultado"); return; }

    const card = document.getElementById("ind-results-card");
    card.style.display = "";

    const m = data.metrics;
    const statsDiv = document.getElementById("ind-stats");
    statsDiv.innerHTML = `
        <div class="stat-card"><div class="value ${colorClass(m.resultado_pct)}">${fmt(m.resultado_pct)}%</div><div class="label">Resultado</div></div>
        <div class="stat-card"><div class="value">${m.total_trades}</div><div class="label">Total Trades</div></div>
        <div class="stat-card"><div class="value text-green">${fmt(m.win_rate)}%</div><div class="label">Win Rate</div></div>
        <div class="stat-card"><div class="value text-red">${fmt(m.max_drawdown_pct)}%</div><div class="label">Max DrawDown</div></div>
        <div class="stat-card"><div class="value">${fmt(m.profit_factor)}</div><div class="label">Profit Factor</div></div>
        <div class="stat-card"><div class="value">${fmt(m.sharpe_ratio)}</div><div class="label">Sharpe</div></div>
    `;

    // Equity curve chart
    if (m.equity_curve && m.equity_curve.length > 0) {
        destroyChart("chart-indicator");
        const ctx = document.getElementById("chart-indicator");
        charts["chart-indicator"] = new Chart(ctx, {
            type: "line",
            data: {
                labels: m.equity_curve.map((_, i) => i),
                datasets: [{
                    label: "Equity",
                    data: m.equity_curve,
                    borderColor: m.equity_curve[m.equity_curve.length - 1] >= m.equity_curve[0] ? "#3fb950" : "#f85149",
                    backgroundColor: "rgba(88,166,255,0.05)",
                    fill: true, tension: 0.3, pointRadius: 0,
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: "#e6edf3" } } },
                scales: {
                    x: { display: false },
                    y: { ticks: { color: "#8b949e" }, grid: { color: "#30363d" } },
                },
            },
        });
    }
};

// ============================================================
// INTRADAY BACKTEST FORM
// ============================================================

let intraStratsLoaded = { b3: false, bmf: false };

async function initIntradayForm(marketType) {
    const prefix = "intra-" + marketType;

    // Market toggle
    const marketSel = document.getElementById(prefix + "-market");
    if (marketSel) {
        marketSel.onchange = function () {
            const wrap = document.getElementById(prefix + "-tickers-wrap");
            if (wrap) wrap.style.display = this.value === "custom" ? "" : "none";
        };
    }

    if (intraStratsLoaded[marketType]) return;

    // Populate hour selects
    populateHourSelect(prefix + "-hour-start", "09:00");
    populateHourSelect(prefix + "-hour-end", "17:00");
    populateHourSelect(prefix + "-hour-target", "15:00");

    // Load entry strategies
    const entryData = await API.get("/strategies/intraday/entry");
    if (entryData && entryData.strategies) {
        populateSelect(prefix + "-entry-strategy", entryData.strategies, "id", "name");
    }

    // Load exit strategies
    const exitData = await API.get("/strategies/intraday/exit");
    if (exitData && exitData.strategies) {
        populateSelect(prefix + "-exit-strategy", exitData.strategies, "id", "name");
    }

    intraStratsLoaded[marketType] = true;
}

window.runIntradayBacktest = async function (marketType) {
    const prefix = "intra-" + marketType;
    const marketSel = document.getElementById(prefix + "-market").value;
    const customTickers = document.getElementById(prefix + "-tickers") ?
        document.getElementById(prefix + "-tickers").value.trim() : "";

    const direction = document.getElementById(prefix + "-direction").value;
    const entryStrat = document.getElementById(prefix + "-entry-strategy").value;
    const exitStrat = document.getElementById(prefix + "-exit-strategy").value;
    const variation = parseFloat(document.getElementById(prefix + "-variation").value) || 0;
    const hourStart = document.getElementById(prefix + "-hour-start").value;
    const hourEnd = document.getElementById(prefix + "-hour-end").value;
    const hourTarget = document.getElementById(prefix + "-hour-target").value;
    const targetPct = document.getElementById(prefix + "-target-pct").value ?
        parseFloat(document.getElementById(prefix + "-target-pct").value) : null;
    const stopPct = document.getElementById(prefix + "-stop-pct").value ?
        parseFloat(document.getElementById(prefix + "-stop-pct").value) : null;
    const maxTrades = parseInt(document.getElementById(prefix + "-max-trades").value) || 99;
    const closeEod = document.getElementById(prefix + "-close-eod").checked;
    const bbWindow = parseInt(document.getElementById(prefix + "-bb-window").value) || 20;
    const bbStd = parseFloat(document.getElementById(prefix + "-bb-std").value) || 2.0;
    const maPeriod = parseInt(document.getElementById(prefix + "-ma-period").value) || 20;
    const period = document.getElementById(prefix + "-period").value;
    const startDate = document.getElementById(prefix + "-start-date").value || null;
    const endDate = document.getElementById(prefix + "-end-date").value || null;
    const capital = parseFloat(document.getElementById(prefix + "-capital").value) || 10000;

    const body = {
        entry_strategy: entryStrat,
        exit_strategy: exitStrat,
        direction,
        variation_pct: variation,
        hour_start: hourStart,
        hour_end: hourEnd,
        hour_target: hourTarget,
        target_pct: targetPct,
        stop_loss_pct: stopPct,
        close_eod: closeEod,
        max_trades_per_day: maxTrades,
        bb_window: bbWindow,
        bb_std: bbStd,
        ma_period: maPeriod,
        period,
        initial_capital: capital,
        start_date: startDate,
        end_date: endDate,
    };

    if (marketSel === "custom" && customTickers) {
        body.tickers = customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    } else {
        body.market = marketType;
    }

    showSpinner();
    const data = await API.post("/backtest/intraday", body);
    hideSpinner();

    if (!data) { alert("Erro ao executar backtest intraday"); return; }

    displayIntradayResults(data, prefix);
};

function displayIntradayResults(data, prefix) {
    const card = document.getElementById(prefix + "-results-card");
    const tbody = document.querySelector("#" + prefix + "-results-table tbody");
    card.style.display = "";
    tbody.innerHTML = "";

    let results = data.results || [];
    if (results.length === 0 && data.metrics) {
        results = [{
            acao: data.ticker,
            total_gain: data.metrics.total_gain,
            pct_gain: data.metrics.pct_gain,
            total_loss: data.metrics.total_loss,
            pct_loss: data.metrics.pct_loss,
            total_trades: data.metrics.total_trades,
            resultado_pct: data.metrics.resultado_pct,
            max_drawdown_pct: data.metrics.max_drawdown_pct,
            ganho_maximo_pct: data.metrics.ganho_maximo_pct,
            ganho_medio_pct: data.metrics.ganho_medio_pct,
            volume_medio: data.metrics.volume_medio,
        }];
    }

    results.forEach(r => {
        const res = r.resultado_pct || 0;
        tbody.innerHTML += `<tr>
            <td><strong>${r.acao}</strong></td>
            <td>${r.total_gain}</td>
            <td>${fmt(r.pct_gain)}%</td>
            <td>${r.total_loss}</td>
            <td>${fmt(r.pct_loss)}%</td>
            <td>${r.total_trades}</td>
            <td class="${colorClass(res)}"><strong>${fmt(res)}%</strong></td>
            <td class="text-red">${fmt(r.max_drawdown_pct)}%</td>
            <td class="text-green">${fmt(r.ganho_maximo_pct)}%</td>
            <td>${fmt(r.ganho_medio_pct, 4)}%</td>
            <td>${fmtMoney(r.volume_medio)}</td>
        </tr>`;
    });
}


// ============================================================
// INIT
// ============================================================

navigate("dashboard");

})();
