// ============================================================
// js/app.js — Trade Halley Frontend v3.1
// SPA completo: Dashboard, B3 Daily, B3 Intraday, BMF Intraday,
//               Indicadores, Estratégias, Salvos, Config
// ============================================================

const API_BASE = "https://wanderhalleylee-trade-halley.hf.space";

// ─── API Helper ───
async function apiGet(path) {
    try {
        const resp = await fetch(`${API_BASE}${path}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.error(`GET ${path}:`, e);
        return null;
    }
}

async function apiPost(path, body) {
    try {
        const resp = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }
        return await resp.json();
    } catch (e) {
        console.error(`POST ${path}:`, e);
        return null;
    }
}

async function apiDelete(path) {
    try {
        const resp = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.error(`DELETE ${path}:`, e);
        return null;
    }
}

// ─── Navigation ───
let currentPage = "dashboard";

function navigate(page) {
    currentPage = page;
    document.querySelectorAll(".page-content").forEach(el => el.classList.add("d-none"));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.remove("d-none");

    document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.classList.add("active");

    // Load page data
    switch (page) {
        case "dashboard": loadDashboard(); break;
        case "daily": loadDailyPage(); break;
        case "intraday": loadIntradayPage(); break;
        case "bmf-intraday": loadBmfIntradayPage(); break;
        case "indicators": loadIndicatorsPage(); break;
        case "strategies": loadStrategiesPage(); break;
        case "saved": loadSavedPage(); break;
        case "config": loadConfigPage(); break;
    }
}

// ─── Utility Functions ───
function fmtPct(val) {
    if (val === null || val === undefined || isNaN(val)) return "0%";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + "%";
}

function fmtNum(val) {
    if (val === null || val === undefined || isNaN(val)) return "0";
    if (Math.abs(val) >= 1e9) return "R$ " + (val / 1e9).toFixed(1) + "B";
    if (Math.abs(val) >= 1e6) return "R$ " + (val / 1e6).toFixed(1) + "M";
    if (Math.abs(val) >= 1e3) return val.toLocaleString("pt-BR");
    return val.toLocaleString("pt-BR");
}

function fmtVol(val) {
    if (val === null || val === undefined || isNaN(val) || val === 0) return "0";
    if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(3).replace(".", ",") + " B";
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(3).replace(".", ",") + " M";
    if (Math.abs(val) >= 1e3) return Math.round(val).toLocaleString("pt-BR");
    return val.toLocaleString("pt-BR");
}

function getTodayStr() {
    const d = new Date();
    return d.toISOString().split("T")[0];
}

function getDefaultStartDate() {
    const d = new Date();
    d.setFullYear(d.getFullYear(), 0, 1); // 1 de janeiro do ano atual
    return d.toISOString().split("T")[0];
}

function populateSelect(selectId, options, defaultVal) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.id || opt.value || opt;
        o.textContent = opt.name || opt.label || opt;
        if (o.value === defaultVal) o.selected = true;
        sel.appendChild(o);
    });
}

// ─── Sortable Table ───
let sortState = {}; // { tableId: { col: index, dir: 'asc'|'desc' } }

function makeSortable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headers = table.querySelectorAll("thead th");

    headers.forEach((th, colIdx) => {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.style.whiteSpace = "nowrap";

        // Remove old arrow if any
        const oldArrow = th.querySelector(".sort-arrow");
        if (oldArrow) oldArrow.remove();

        // Add arrow span
        const arrow = document.createElement("span");
        arrow.className = "sort-arrow";
        arrow.style.marginLeft = "6px";
        arrow.style.fontSize = "0.75em";
        arrow.style.opacity = "0.4";
        arrow.textContent = "⇅";
        th.appendChild(arrow);

        th.addEventListener("click", () => {
            sortTable(tableId, colIdx);
        });
    });
}

function sortTable(tableId, colIdx) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) return;

    // Determine direction
    if (!sortState[tableId]) sortState[tableId] = {};
    const prev = sortState[tableId];
    let dir = "desc";
    if (prev.col === colIdx && prev.dir === "desc") dir = "asc";
    sortState[tableId] = { col: colIdx, dir: dir };

    // Update arrows
    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, i) => {
        const arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        if (i === colIdx) {
            arrow.textContent = dir === "asc" ? "▲" : "▼";
            arrow.style.opacity = "1";
        } else {
            arrow.textContent = "⇅";
            arrow.style.opacity = "0.4";
        }
    });

    // Sort rows
    rows.sort((a, b) => {
        let aVal = a.cells[colIdx]?.textContent?.trim() || "";
        let bVal = b.cells[colIdx]?.textContent?.trim() || "";

        // Try numeric
        let aNum = parseFloat(aVal.replace(/[R$%,\s]/g, "").replace(",", "."));
        let bNum = parseFloat(bVal.replace(/[R$%,\s]/g, "").replace(",", "."));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return dir === "asc" ? aNum - bNum : bNum - aNum;
        }

        // Fallback string
        return dir === "asc"
            ? aVal.localeCompare(bVal, "pt-BR")
            : bVal.localeCompare(aVal, "pt-BR");
    });

    // Re-append rows
    rows.forEach(row => tbody.appendChild(row));
}

// ─── Direction buttons ───
function setupDirectionButtons(buyBtnId, sellBtnId, hiddenFieldId) {
    const buyBtn = document.getElementById(buyBtnId);
    const sellBtn = document.getElementById(sellBtnId);
    const hidden = document.getElementById(hiddenFieldId);
    if (!buyBtn || !sellBtn) return;

    buyBtn.addEventListener("click", () => {
        buyBtn.classList.add("btn-success");
        buyBtn.classList.remove("btn-outline-success");
        sellBtn.classList.add("btn-outline-danger");
        sellBtn.classList.remove("btn-danger");
        if (hidden) hidden.value = "compra";
    });
    sellBtn.addEventListener("click", () => {
        sellBtn.classList.add("btn-danger");
        sellBtn.classList.remove("btn-outline-danger");
        buyBtn.classList.add("btn-outline-success");
        buyBtn.classList.remove("btn-success");
        if (hidden) hidden.value = "venda";
    });
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    const data = await apiGet("/dashboard/summary");
    if (!data) return;

    const statsDiv = document.getElementById("dashboard-stats");
    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Ativos B3</h6><h3>${data.total_b3 || 30}</h3>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Ativos BMF</h6><h3>${data.total_bmf || 10}</h3>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Indicadores</h6><h3>${data.total_strategies || 13}</h3>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Estratégias Daily</h6><h3>${(data.total_daily_entry || 7) + (data.total_daily_exit || 3)}</h3>
            </div></div>
        `;
    }

    const tickersDiv = document.getElementById("dashboard-tickers");
    if (tickersDiv && data.top_tickers) {
        let html = "";
        data.top_tickers.forEach(t => {
            const color = (t.change_pct || 0) >= 0 ? "text-success" : "text-danger";
            const arrow = (t.change_pct || 0) >= 0 ? "▲" : "▼";
            html += `
                <div class="col-md-3 mb-3"><div class="card bg-dark text-light p-3">
                    <div class="d-flex justify-content-between">
                        <strong>${t.ticker}</strong>
                        <span class="${color}">${arrow} ${fmtPct(t.change_pct)}</span>
                    </div>
                    <h4>R$ ${(t.price || 0).toFixed(2)}</h4>
                    <small class="text-muted">${t.name || ""}</small>
                </div></div>
            `;
        });
        tickersDiv.innerHTML = html;
    }
}

// ============================================================
// STRATEGIES PAGE
// ============================================================

async function loadStrategiesPage() {
    const data = await apiGet("/strategies/all");
    if (!data) return;

    const container = document.getElementById("strategies-container");
    if (!container) return;

    let html = "";

    // Indicator strategies
    if (data.indicator_strategies && data.indicator_strategies.length > 0) {
        html += `<h5 class="text-info mt-3">Indicadores Técnicos (${data.indicator_strategies.length})</h5>
        <div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
        <th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th></tr></thead><tbody>`;
        data.indicator_strategies.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // Daily entry
    if (data.daily_entry && data.daily_entry.length > 0) {
        html += `<h5 class="text-info mt-4">Entrada Diário (${data.daily_entry.length})</h5>
        <div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
        <th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Requer</th></tr></thead><tbody>`;
        data.daily_entry.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td><td>${(s.requires || []).join(", ")}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // Daily exit
    if (data.daily_exit && data.daily_exit.length > 0) {
        html += `<h5 class="text-info mt-4">Saída Diário (${data.daily_exit.length})</h5>
        <div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
        <th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th></tr></thead><tbody>`;
        data.daily_exit.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // Intraday entry
    if (data.intraday_entry && data.intraday_entry.length > 0) {
        html += `<h5 class="text-info mt-4">Entrada Intraday (${data.intraday_entry.length})</h5>
        <div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
        <th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Requer</th></tr></thead><tbody>`;
        data.intraday_entry.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td><td>${(s.requires || []).join(", ")}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // Intraday exit
    if (data.intraday_exit && data.intraday_exit.length > 0) {
        html += `<h5 class="text-info mt-4">Saída Intraday (${data.intraday_exit.length})</h5>
        <div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
        <th>ID</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Requer</th></tr></thead><tbody>`;
        data.intraday_exit.forEach(s => {
            html += `<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.description}</td><td>${s.category}</td><td>${(s.requires || []).join(", ")}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    container.innerHTML = html;
}

// ============================================================
// SAVED BACKTESTS
// ============================================================

async function loadSavedPage() {
    const data = await apiGet("/backtests/saved");
    const container = document.getElementById("saved-container");
    if (!container) return;

    if (!data || !data.backtests || data.backtests.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum backtest salvo.</p>';
        return;
    }

    let html = `<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
    <th>ID</th><th>Ticker</th><th>Estratégia</th><th>Resultado</th><th>Data</th><th>Ações</th></tr></thead><tbody>`;
    data.backtests.forEach(bt => {
        html += `<tr>
            <td>${bt.id || ""}</td>
            <td>${bt.ticker || bt.result?.ticker || ""}</td>
            <td>${bt.entry_strategy_name || bt.strategy_name || bt.result?.entry_strategy_name || ""}</td>
            <td>${fmtPct(bt.resultado_pct || bt.metrics?.resultado_pct || bt.result?.metrics?.resultado_pct)}</td>
            <td>${bt.saved_at || ""}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="deleteSavedBacktest('${bt.id}')">Excluir</button></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function deleteSavedBacktest(id) {
    if (!confirm("Excluir este backtest salvo?")) return;
    await apiDelete(`/backtests/saved/${id}`);
    loadSavedPage();
}

// ============================================================
// CONFIG PAGE
// ============================================================

async function loadConfigPage() {
    const stats = await apiGet("/storage/stats");
    const statsDiv = document.getElementById("config-stats");
    if (statsDiv && stats) {
        statsDiv.innerHTML = `
            <p>Ativos diários: <strong>${stats.daily_assets || 0}</strong></p>
            <p>Ativos intraday: <strong>${stats.intraday_assets || 0}</strong></p>
            <p>Total registros: <strong>${stats.total_records || 0}</strong></p>
            <p>Backtests salvos: <strong>${stats.total_backtests || 0}</strong></p>
            <p>Storage: <strong>${stats.storage_type || "supabase"}</strong></p>
        `;
    }
}

// ============================================================
// B3 DAILY — Sem campos Período e Capital Inicial
// ============================================================

async function loadDailyPage() {
    // Load entry strategies
    const entryData = await apiGet("/strategies/daily/entry");
    if (entryData && entryData.strategies) {
        populateSelect("daily-entry-strategy", entryData.strategies, "pct_prev_close");
    }

    // Load exit strategies
    const exitData = await apiGet("/strategies/daily/exit");
    if (exitData && exitData.strategies) {
        populateSelect("daily-exit-strategy", exitData.strategies, "close_same_day");
    }

    // Setup direction buttons
    setupDirectionButtons("daily-btn-compra", "daily-btn-venda", "daily-direction");

    // Set default dates
    const startInput = document.getElementById("daily-start-date");
    const endInput = document.getElementById("daily-end-date");
    if (startInput && !startInput.value) startInput.value = getDefaultStartDate();
    if (endInput && !endInput.value) endInput.value = getTodayStr();

    // Show/hide variation field based on strategy
    const entrySelect = document.getElementById("daily-entry-strategy");
    if (entrySelect) {
        entrySelect.addEventListener("change", () => {
            const varDiv = document.getElementById("daily-variation-div");
            if (!varDiv) return;
            const needsVariation = ["pct_prev_close", "pct_prev_open", "pct_current_open",
                                    "pct_prev_close_sniper", "pct_prev_open_sniper"];
            varDiv.style.display = needsVariation.includes(entrySelect.value) ? "block" : "none";
        });
        entrySelect.dispatchEvent(new Event("change"));
    }
}

async function runDailyBacktest() {
    const entryStrategy = document.getElementById("daily-entry-strategy")?.value;
    const exitStrategy = document.getElementById("daily-exit-strategy")?.value;
    const direction = document.getElementById("daily-direction")?.value || "compra";
    const variationPct = parseFloat(document.getElementById("daily-variation")?.value || "0");
    const startDate = document.getElementById("daily-start-date")?.value || "";
    const endDate = document.getElementById("daily-end-date")?.value || "";
    const tickersInput = document.getElementById("daily-tickers")?.value?.trim() || "";
    const market = document.getElementById("daily-market")?.value || "";

    if (!entryStrategy || !exitStrategy) {
        alert("Selecione as estratégias de entrada e saída.");
        return;
    }

    // Show loading
    const btn = document.getElementById("daily-run-btn");
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Executando..."; }

    const body = {
        entry_strategy: entryStrategy,
        exit_strategy: exitStrategy,
        direction: direction,
        variation_pct: variationPct,
        start_date: startDate || null,
        end_date: endDate || null,
    };

    // Resolve tickers
    if (tickersInput) {
        body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    } else if (market) {
        body.market = market;
    } else {
        body.market = "b3";
    }

    const result = await apiPost("/backtest/daily", body);

    if (btn) { btn.disabled = false; btn.textContent = origText; }

    if (!result) {
        alert("Erro ao executar backtest. Verifique os parâmetros.");
        return;
    }

    displayDailyResults(result);
}

function displayDailyResults(result) {
    const container = document.getElementById("daily-results");
    if (!container) return;

    let rows = [];

    // Single ticker result
    if (result.ticker && result.metrics) {
        const m = result.metrics;
        rows.push({
            acao: result.ticker,
            total_gain: m.total_gain,
            pct_gain: m.pct_gain,
            total_loss: m.total_loss,
            pct_loss: m.pct_loss,
            total_trades: m.total_trades,
            resultado_pct: m.resultado_pct,
            max_drawdown_pct: m.max_drawdown_pct,
            ganho_maximo_pct: m.ganho_maximo_pct,
            ganho_medio_pct: m.ganho_medio_pct,
            volume_medio: m.volume_medio,
        });
    }
    // Bulk result
    else if (result.results) {
        rows = result.results;
    }

    if (rows.length === 0) {
        container.innerHTML = '<p class="text-muted mt-3">Nenhum resultado encontrado.</p>';
        return;
    }

    let html = `
    <h5 class="text-info mt-4">Resultados</h5>
    <div class="table-responsive">
        <table class="table table-dark table-striped table-sm" id="daily-results-table">
            <thead>
                <tr>
                    <th>AÇÃO</th>
                    <th>TOTAL GAIN</th>
                    <th>% GAIN</th>
                    <th>TOTAL LOSS</th>
                    <th>% LOSS</th>
                    <th>TOTAL TRADES</th>
                    <th>RESULTADO %</th>
                    <th>MAX DRAWDOWN %</th>
                    <th>GANHO MÁXIMO %</th>
                    <th>GANHO MÉDIO %</th>
                    <th>VOLUME MÉDIO</th>
                </tr>
            </thead>
            <tbody>`;

    rows.forEach(r => {
        const resClass = (r.resultado_pct || 0) >= 0 ? "text-success" : "text-danger";
        html += `<tr>
            <td><strong>${r.acao || ""}</strong></td>
            <td>${r.total_gain || 0}</td>
            <td>${fmtPct(r.pct_gain)}</td>
            <td>${r.total_loss || 0}</td>
            <td>${fmtPct(r.pct_loss)}</td>
            <td>${r.total_trades || 0}</td>
            <td class="${resClass}">${fmtPct(r.resultado_pct)}</td>
            <td>${fmtPct(r.max_drawdown_pct)}</td>
            <td>${fmtPct(r.ganho_maximo_pct)}</td>
            <td>${fmtPct(r.ganho_medio_pct)}</td>
            <td>${fmtVol(r.volume_medio)}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // Ativa setas de ordenação
    makeSortable("daily-results-table");
}

// ============================================================
// INDICATORS PAGE
// ============================================================

async function loadIndicatorsPage() {
    const data = await apiGet("/strategies");
    if (data && data.strategies) {
        populateSelect("indicator-strategy", data.strategies, "sma_cross_9_21");
    }
}

async function runIndicatorBacktest() {
    const ticker = document.getElementById("indicator-ticker")?.value?.trim().toUpperCase();
    const strategy = document.getElementById("indicator-strategy")?.value;
    const period = document.getElementById("indicator-period")?.value || "1y";
    const capital = parseFloat(document.getElementById("indicator-capital")?.value || "10000");

    if (!ticker || !strategy) {
        alert("Informe o ticker e selecione a estratégia.");
        return;
    }

    const btn = document.getElementById("indicator-run-btn");
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Executando..."; }

    const result = await apiGet(`/backtest?ticker=${ticker}&strategy=${strategy}&period=${period}&capital=${capital}`);

    if (btn) { btn.disabled = false; btn.textContent = origText; }

    if (!result) {
        alert("Erro ao executar backtest.");
        return;
    }

    displayIndicatorResults(result);
}

function displayIndicatorResults(result) {
    const container = document.getElementById("indicator-results");
    if (!container || !result.metrics) return;

    const m = result.metrics;
    container.innerHTML = `
        <div class="row mt-3">
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Total Trades</h6><h4>${m.total_trades}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Win Rate</h6><h4>${fmtPct(m.win_rate)}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Retorno Total</h6><h4 class="${m.total_return_pct >= 0 ? 'text-success' : 'text-danger'}">${fmtPct(m.total_return_pct)}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Max Drawdown</h6><h4>${fmtPct(m.max_drawdown_pct)}</h4>
            </div></div>
        </div>
        <div class="row mt-2">
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Profit Factor</h6><h4>${m.profit_factor?.toFixed(2) || "0"}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Sharpe Ratio</h6><h4>${m.sharpe_ratio?.toFixed(2) || "0"}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Capital Final</h6><h4>R$ ${m.final_capital?.toLocaleString("pt-BR") || "0"}</h4>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Avg Win / Avg Loss</h6><h4>${fmtPct(m.avg_win)} / ${fmtPct(m.avg_loss)}</h4>
            </div></div>
        </div>
    `;
}

// ============================================================
// B3 INTRADAY
// ============================================================

async function loadIntradayPage() {
    const entryData = await apiGet("/strategies/intraday/entry");
    if (entryData && entryData.strategies) {
        populateSelect("intra-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    }
    const exitData = await apiGet("/strategies/intraday/exit");
    if (exitData && exitData.strategies) {
        populateSelect("intra-exit-strategy", exitData.strategies, "intra_exit_day_close");
    }
    setupDirectionButtons("intra-btn-compra", "intra-btn-venda", "intra-direction");

    const startInput = document.getElementById("intra-start-date");
    const endInput = document.getElementById("intra-end-date");
    if (startInput && !startInput.value) startInput.value = getDefaultStartDate();
    if (endInput && !endInput.value) endInput.value = getTodayStr();
}

async function runIntradayBacktest() {
    const entryStrategy = document.getElementById("intra-entry-strategy")?.value;
    const exitStrategy = document.getElementById("intra-exit-strategy")?.value;
    const direction = document.getElementById("intra-direction")?.value || "compra";
    const variationPct = parseFloat(document.getElementById("intra-variation")?.value || "0");
    const hourStart = document.getElementById("intra-hour-start")?.value || "09:00";
    const hourEnd = document.getElementById("intra-hour-end")?.value || "17:00";
    const startDate = document.getElementById("intra-start-date")?.value || "";
    const endDate = document.getElementById("intra-end-date")?.value || "";
    const tickersInput = document.getElementById("intra-tickers")?.value?.trim() || "";
    const market = document.getElementById("intra-market")?.value || "";

    if (!entryStrategy || !exitStrategy) {
        alert("Selecione as estratégias de entrada e saída.");
        return;
    }

    const btn = document.getElementById("intra-run-btn");
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Executando..."; }

    const body = {
        entry_strategy: entryStrategy,
        exit_strategy: exitStrategy,
        direction: direction,
        variation_pct: variationPct,
        hour_start: hourStart,
        hour_end: hourEnd,
        period: "3mo",
        start_date: startDate || null,
        end_date: endDate || null,
    };

    if (tickersInput) {
        body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    } else if (market) {
        body.market = market;
    } else {
        body.market = "b3";
    }

    const result = await apiPost("/backtest/intraday", body);

    if (btn) { btn.disabled = false; btn.textContent = origText; }

    if (!result) {
        alert("Erro ao executar backtest intraday.");
        return;
    }

    displayIntradayResults(result);
}

function displayIntradayResults(result) {
    const container = document.getElementById("intra-results");
    if (!container) return;

    let rows = [];
    if (result.ticker && result.metrics) {
        const m = result.metrics;
        rows.push({
            acao: result.ticker,
            total_gain: m.total_gain,
            pct_gain: m.pct_gain,
            total_loss: m.total_loss,
            pct_loss: m.pct_loss,
            total_trades: m.total_trades,
            resultado_pct: m.resultado_pct,
            max_drawdown_pct: m.max_drawdown_pct,
            ganho_maximo_pct: m.ganho_maximo_pct,
            ganho_medio_pct: m.ganho_medio_pct,
            volume_medio: m.volume_medio,
        });
    } else if (result.results) {
        rows = result.results;
    }

    if (rows.length === 0) {
        container.innerHTML = '<p class="text-muted mt-3">Nenhum resultado encontrado.</p>';
        return;
    }

    let html = `
    <h5 class="text-info mt-4">Resultados</h5>
    <div class="table-responsive">
        <table class="table table-dark table-striped table-sm" id="intra-results-table">
            <thead>
                <tr>
                    <th>AÇÃO</th>
                    <th>TOTAL GAIN</th>
                    <th>% GAIN</th>
                    <th>TOTAL LOSS</th>
                    <th>% LOSS</th>
                    <th>TOTAL TRADES</th>
                    <th>RESULTADO %</th>
                    <th>MAX DRAWDOWN %</th>
                    <th>GANHO MÁXIMO %</th>
                    <th>GANHO MÉDIO %</th>
                    <th>VOLUME MÉDIO</th>
                </tr>
            </thead>
            <tbody>`;

    rows.forEach(r => {
        const resClass = (r.resultado_pct || 0) >= 0 ? "text-success" : "text-danger";
        html += `<tr>
            <td><strong>${r.acao || ""}</strong></td>
            <td>${r.total_gain || 0}</td>
            <td>${fmtPct(r.pct_gain)}</td>
            <td>${r.total_loss || 0}</td>
            <td>${fmtPct(r.pct_loss)}</td>
            <td>${r.total_trades || 0}</td>
            <td class="${resClass}">${fmtPct(r.resultado_pct)}</td>
            <td>${fmtPct(r.max_drawdown_pct)}</td>
            <td>${fmtPct(r.ganho_maximo_pct)}</td>
            <td>${fmtPct(r.ganho_medio_pct)}</td>
            <td>${fmtVol(r.volume_medio)}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // Ativa setas de ordenação
    makeSortable("intra-results-table");
}

// ============================================================
// BMF INTRADAY (mesma lógica, mercado BMF)
// ============================================================

async function loadBmfIntradayPage() {
    const entryData = await apiGet("/strategies/intraday/entry");
    if (entryData && entryData.strategies) {
        populateSelect("bmf-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    }
    const exitData = await apiGet("/strategies/intraday/exit");
    if (exitData && exitData.strategies) {
        populateSelect("bmf-exit-strategy", exitData.strategies, "intra_exit_day_close");
    }
    setupDirectionButtons("bmf-btn-compra", "bmf-btn-venda", "bmf-direction");

    const startInput = document.getElementById("bmf-start-date");
    const endInput = document.getElementById("bmf-end-date");
    if (startInput && !startInput.value) startInput.value = getDefaultStartDate();
    if (endInput && !endInput.value) endInput.value = getTodayStr();
}

async function runBmfIntradayBacktest() {
    const entryStrategy = document.getElementById("bmf-entry-strategy")?.value;
    const exitStrategy = document.getElementById("bmf-exit-strategy")?.value;
    const direction = document.getElementById("bmf-direction")?.value || "compra";
    const variationPct = parseFloat(document.getElementById("bmf-variation")?.value || "0");
    const hourStart = document.getElementById("bmf-hour-start")?.value || "09:00";
    const hourEnd = document.getElementById("bmf-hour-end")?.value || "17:00";
    const startDate = document.getElementById("bmf-start-date")?.value || "";
    const endDate = document.getElementById("bmf-end-date")?.value || "";
    const tickersInput = document.getElementById("bmf-tickers")?.value?.trim() || "";

    if (!entryStrategy || !exitStrategy) {
        alert("Selecione as estratégias de entrada e saída.");
        return;
    }

    const btn = document.getElementById("bmf-run-btn");
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Executando..."; }

    const body = {
        entry_strategy: entryStrategy,
        exit_strategy: exitStrategy,
        direction: direction,
        variation_pct: variationPct,
        hour_start: hourStart,
        hour_end: hourEnd,
        period: "3mo",
        start_date: startDate || null,
        end_date: endDate || null,
    };

    if (tickersInput) {
        body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    } else {
        body.market = "bmf";
    }

    const result = await apiPost("/backtest/intraday", body);

    if (btn) { btn.disabled = false; btn.textContent = origText; }

    if (!result) {
        alert("Erro ao executar backtest BMF intraday.");
        return;
    }

    displayBmfIntradayResults(result);
}

function displayBmfIntradayResults(result) {
    const container = document.getElementById("bmf-results");
    if (!container) return;

    let rows = [];
    if (result.ticker && result.metrics) {
        const m = result.metrics;
        rows.push({
            acao: result.ticker,
            total_gain: m.total_gain,
            pct_gain: m.pct_gain,
            total_loss: m.total_loss,
            pct_loss: m.pct_loss,
            total_trades: m.total_trades,
            resultado_pct: m.resultado_pct,
            max_drawdown_pct: m.max_drawdown_pct,
            ganho_maximo_pct: m.ganho_maximo_pct,
            ganho_medio_pct: m.ganho_medio_pct,
            volume_medio: m.volume_medio,
        });
    } else if (result.results) {
        rows = result.results;
    }

    if (rows.length === 0) {
        container.innerHTML = '<p class="text-muted mt-3">Nenhum resultado encontrado.</p>';
        return;
    }

    let html = `
    <h5 class="text-info mt-4">Resultados</h5>
    <div class="table-responsive">
        <table class="table table-dark table-striped table-sm" id="bmf-results-table">
            <thead>
                <tr>
                    <th>AÇÃO</th>
                    <th>TOTAL GAIN</th>
                    <th>% GAIN</th>
                    <th>TOTAL LOSS</th>
                    <th>% LOSS</th>
                    <th>TOTAL TRADES</th>
                    <th>RESULTADO %</th>
                    <th>MAX DRAWDOWN %</th>
                    <th>GANHO MÁXIMO %</th>
                    <th>GANHO MÉDIO %</th>
                    <th>VOLUME MÉDIO</th>
                </tr>
            </thead>
            <tbody>`;

    rows.forEach(r => {
        const resClass = (r.resultado_pct || 0) >= 0 ? "text-success" : "text-danger";
        html += `<tr>
            <td><strong>${r.acao || ""}</strong></td>
            <td>${r.total_gain || 0}</td>
            <td>${fmtPct(r.pct_gain)}</td>
            <td>${r.total_loss || 0}</td>
            <td>${fmtPct(r.pct_loss)}</td>
            <td>${r.total_trades || 0}</td>
            <td class="${resClass}">${fmtPct(r.resultado_pct)}</td>
            <td>${fmtPct(r.max_drawdown_pct)}</td>
            <td>${fmtPct(r.ganho_maximo_pct)}</td>
            <td>${fmtPct(r.ganho_medio_pct)}</td>
            <td>${fmtVol(r.volume_medio)}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    makeSortable("bmf-results-table");
}

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    // Navigation
    document.querySelectorAll(".nav-link[data-page]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navigate(link.dataset.page);
        });
    });

    // Start on dashboard
    navigate("dashboard");
});
