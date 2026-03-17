// ============================================================
// js/app.js — Trade Halley Frontend v3.2
// SPA: Dashboard, B3 Daily, B3 Intraday, BMF Intraday,
//      Estratégias, Salvos, Config (PIN + token BRAPI + download)
// ============================================================

const API_BASE = "https://wanderhalleylee-trade-halley.hf.space";

// ─── Stored credentials (localStorage) ───
function getBrapiToken() { return localStorage.getItem("brapi_token") || "ktC3hLVgH3QXrFnssfbcUj"; }
function setBrapiToken(token) { localStorage.setItem("brapi_token", token); }
function getStoredPin() { return localStorage.getItem("config_pin") || ""; }
function setStoredPin(pin) { localStorage.setItem("config_pin", pin); }

// ─── API Helpers ───
async function apiGet(path) {
    try {
        const resp = await fetch(`${API_BASE}${path}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) { console.error(`GET ${path}:`, e); return null; }
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
    } catch (e) { console.error(`POST ${path}:`, e); return null; }
}

async function apiDelete(path) {
    try {
        const resp = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) { console.error(`DELETE ${path}:`, e); return null; }
}

// ─── BRAPI Direct ───
async function brapiGet(endpoint, params = {}) {
    params.token = getBrapiToken();
    const qs = new URLSearchParams(params).toString();
    try {
        const resp = await fetch(`https://brapi.dev/api${endpoint}?${qs}`);
        if (!resp.ok) throw new Error(`BRAPI ${resp.status}`);
        return await resp.json();
    } catch (e) { console.error(`BRAPI ${endpoint}:`, e); return null; }
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

    document.getElementById("sidebar")?.classList.remove("open");

    switch (page) {
        case "dashboard": loadDashboard(); break;
        case "daily": loadDailyPage(); break;
        case "intraday": loadIntradayPage(); break;
        case "bmf-intraday": loadBmfIntradayPage(); break;
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

function fmtVol(val) {
    if (val === null || val === undefined || isNaN(val) || val === 0) return "0";
    if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(3).replace(".", ",") + " B";
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(3).replace(".", ",") + " M";
    if (Math.abs(val) >= 1e3) return Math.round(val).toLocaleString("pt-BR");
    return val.toLocaleString("pt-BR");
}

function getTodayStr() { return new Date().toISOString().split("T")[0]; }

function getDefaultStartDate() {
    const d = new Date(); d.setFullYear(d.getFullYear(), 0, 1);
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
let sortState = {};

function makeSortable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll("thead th").forEach((th, colIdx) => {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.style.whiteSpace = "nowrap";
        const old = th.querySelector(".sort-arrow"); if (old) old.remove();
        const arrow = document.createElement("span");
        arrow.className = "sort-arrow";
        arrow.style.marginLeft = "6px";
        arrow.style.fontSize = "0.7em";
        arrow.style.opacity = "0.4";
        arrow.textContent = "⇅";
        th.appendChild(arrow);
        th.addEventListener("click", () => sortTable(tableId, colIdx));
    });
}

function sortTable(tableId, colIdx) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) return;

    if (!sortState[tableId]) sortState[tableId] = {};
    const prev = sortState[tableId];
    let dir = "desc";
    if (prev.col === colIdx && prev.dir === "desc") dir = "asc";
    sortState[tableId] = { col: colIdx, dir };

    table.querySelectorAll("thead th").forEach((th, i) => {
        const arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        if (i === colIdx) { arrow.textContent = dir === "asc" ? "▲" : "▼"; arrow.style.opacity = "1"; }
        else { arrow.textContent = "⇅"; arrow.style.opacity = "0.4"; }
    });

    rows.sort((a, b) => {
        let aVal = a.cells[colIdx]?.textContent?.trim() || "";
        let bVal = b.cells[colIdx]?.textContent?.trim() || "";
        let aNum = parseFloat(aVal.replace(/[R$%,\s]/g, "").replace(",", "."));
        let bNum = parseFloat(bVal.replace(/[R$%,\s]/g, "").replace(",", "."));
        if (!isNaN(aNum) && !isNaN(bNum)) return dir === "asc" ? aNum - bNum : bNum - aNum;
        return dir === "asc" ? aVal.localeCompare(bVal, "pt-BR") : bVal.localeCompare(aVal, "pt-BR");
    });
    rows.forEach(row => tbody.appendChild(row));
}

// ─── Direction buttons ───
function setupDirectionButtons(buyBtnId, sellBtnId, hiddenFieldId) {
    const buyBtn = document.getElementById(buyBtnId);
    const sellBtn = document.getElementById(sellBtnId);
    const hidden = document.getElementById(hiddenFieldId);
    if (!buyBtn || !sellBtn) return;
    buyBtn.addEventListener("click", () => {
        buyBtn.classList.add("active-dir"); sellBtn.classList.remove("active-dir");
        if (hidden) hidden.value = "compra";
    });
    sellBtn.addEventListener("click", () => {
        sellBtn.classList.add("active-dir"); buyBtn.classList.remove("active-dir");
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
                <h6 class="text-info">Estratégias</h6><h3>${data.total_strategies || 13}</h3>
            </div></div>
            <div class="col-md-3"><div class="card bg-dark text-light p-3">
                <h6 class="text-info">Entrada+Saída</h6><h3>${(data.total_daily_entry||7)+(data.total_daily_exit||3)+(data.total_intraday_entry||12)+(data.total_intraday_exit||7)}</h3>
            </div></div>`;
    }
    const tickersDiv = document.getElementById("dashboard-tickers");
    if (tickersDiv && data.top_tickers) {
        let html = "";
        data.top_tickers.forEach(t => {
            const color = (t.change_pct||0) >= 0 ? "text-success" : "text-danger";
            const arrow = (t.change_pct||0) >= 0 ? "▲" : "▼";
            html += `<div class="col-md-3 mb-3"><div class="card bg-dark text-light p-3">
                <div class="d-flex justify-content-between"><strong>${t.ticker}</strong>
                <span class="${color}">${arrow} ${fmtPct(t.change_pct)}</span></div>
                <h4>R$ ${(t.price||0).toFixed(2)}</h4>
                <small class="text-muted">${t.name||""}</small>
            </div></div>`;
        });
        tickersDiv.innerHTML = html;
    }
}

// ============================================================
// STRATEGIES PAGE (sem coluna ID)
// ============================================================
async function loadStrategiesPage() {
    const data = await apiGet("/strategies/all");
    const container = document.getElementById("strategies-container");
    if (!container) return;
    if (!data) { container.innerHTML = '<p class="text-muted">Erro ao carregar estratégias.</p>'; return; }

    let html = "";
    function buildSection(icon, title, items, cols) {
        if (!items || items.length === 0) return "";
        let h = `<div class="strategy-section"><div class="strategy-section-title"><i class="fas fa-${icon}"></i> ${title} (${items.length})</div>`;
        h += `<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>`;
        cols.forEach(c => { h += `<th>${c}</th>`; });
        h += `</tr></thead><tbody>`;
        items.forEach(s => {
            h += `<tr><td><strong>${s.name||""}</strong></td><td>${s.description||""}</td><td>${s.category||""}</td>`;
            if (cols.length > 3) h += `<td>${(s.requires||[]).join(", ")||"—"}</td>`;
            h += `</tr>`;
        });
        h += `</tbody></table></div></div>`;
        return h;
    }
    html += buildSection("wave-square", "Indicadores Técnicos", data.indicator_strategies, ["Nome","Descrição","Categoria"]);
    html += buildSection("sign-in-alt", "Entrada Diário", data.daily_entry, ["Nome","Descrição","Categoria","Requer"]);
    html += buildSection("sign-out-alt", "Saída Diário", data.daily_exit, ["Nome","Descrição","Categoria"]);
    html += buildSection("sign-in-alt", "Entrada Intraday", data.intraday_entry, ["Nome","Descrição","Categoria","Requer"]);
    html += buildSection("sign-out-alt", "Saída Intraday", data.intraday_exit, ["Nome","Descrição","Categoria","Requer"]);
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
        container.innerHTML = '<p class="text-muted">Nenhum backtest salvo.</p>'; return;
    }
    let html = `<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>
    <th>Ticker</th><th>Estratégia</th><th>Resultado</th><th>Data</th><th>Ações</th></tr></thead><tbody>`;
    data.backtests.forEach(bt => {
        html += `<tr>
            <td>${bt.ticker||bt.result?.ticker||""}</td>
            <td>${bt.entry_strategy_name||bt.strategy_name||bt.result?.entry_strategy_name||""}</td>
            <td>${fmtPct(bt.resultado_pct||bt.metrics?.resultado_pct||bt.result?.metrics?.resultado_pct)}</td>
            <td>${bt.saved_at||""}</td>
            <td><button class="btn btn-outline-danger btn-sm" onclick="deleteSavedBacktest('${bt.id}')"><i class="fas fa-trash"></i></button></td>
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
// CONFIG PAGE — PIN LOGIN
// ============================================================
let configAuthenticated = false;

async function loadConfigPage() {
    const savedPin = getStoredPin();

    // Se já autenticou nesta sessão, mostra direto
    if (configAuthenticated && savedPin) {
        showConfigPanel();
        return;
    }

    // Se tem PIN salvo, tenta auto-verificar
    if (savedPin) {
        const result = await apiPost("/config/verify-pin", { pin: savedPin });
        if (result && result.valid) {
            configAuthenticated = true;
            showConfigPanel();
            return;
        } else {
            // PIN salvo inválido, limpa
            localStorage.removeItem("config_pin");
        }
    }

    // Mostra tela de login
    document.getElementById("config-login-screen").style.display = "block";
    document.getElementById("config-panel").style.display = "none";
    document.getElementById("config-pin-input")?.focus();
}

async function verifyConfigPin() {
    const pinInput = document.getElementById("config-pin-input");
    const errorDiv = document.getElementById("config-pin-error");
    const pin = pinInput?.value?.trim();

    if (!pin) {
        if (errorDiv) { errorDiv.className = "config-status error"; errorDiv.textContent = "Digite o PIN."; }
        return;
    }

    const result = await apiPost("/config/verify-pin", { pin });
    if (result && result.valid) {
        configAuthenticated = true;
        setStoredPin(pin);
        if (errorDiv) { errorDiv.className = "config-status"; errorDiv.style.display = "none"; }
        showConfigPanel();
    } else {
        if (errorDiv) { errorDiv.className = "config-status error"; errorDiv.textContent = "PIN incorreto. Tente novamente."; }
        if (pinInput) { pinInput.value = ""; pinInput.focus(); }
    }
}

async function showConfigPanel() {
    document.getElementById("config-login-screen").style.display = "none";
    document.getElementById("config-panel").style.display = "block";

    // Load saved token
    const tokenInput = document.getElementById("config-brapi-token");
    if (tokenInput) tokenInput.value = getBrapiToken();

    // Set default dates
    const sd = document.getElementById("config-start-date");
    const ed = document.getElementById("config-end-date");
    if (sd && !sd.value) { const d = new Date(); d.setFullYear(d.getFullYear()-1); sd.value = d.toISOString().split("T")[0]; }
    if (ed && !ed.value) ed.value = getTodayStr();

    // Load stats
    const stats = await apiGet("/storage/stats");
    const statsDiv = document.getElementById("config-stats");
    if (statsDiv && stats) {
        statsDiv.innerHTML = `<div class="stats-grid">
            <div class="stat-mini"><div class="stat-val">${stats.daily_assets||0}</div><div class="stat-lbl">Ativos Diários</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.intraday_assets||0}</div><div class="stat-lbl">Ativos Intraday</div></div>
            <div class="stat-mini"><div class="stat-val">${(stats.total_records||0).toLocaleString("pt-BR")}</div><div class="stat-lbl">Total Registros</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.total_backtests||0}</div><div class="stat-lbl">Backtests Salvos</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.storage_type||"supabase"}</div><div class="stat-lbl">Storage</div></div>
        </div>`;
    }
}

function saveBrapiToken() {
    const input = document.getElementById("config-brapi-token");
    const status = document.getElementById("config-token-status");
    if (!input || !input.value.trim()) {
        if (status) { status.className = "config-status error"; status.textContent = "Token não pode ser vazio."; }
        return;
    }
    setBrapiToken(input.value.trim());
    if (status) { status.className = "config-status success"; status.textContent = "Token salvo com sucesso!"; }
}

async function changeConfigPin() {
    const oldPin = document.getElementById("config-old-pin")?.value?.trim();
    const newPin = document.getElementById("config-new-pin")?.value?.trim();
    const status = document.getElementById("config-pin-change-status");

    if (!oldPin || !newPin) {
        if (status) { status.className = "config-status error"; status.textContent = "Preencha ambos os campos."; }
        return;
    }

    const result = await apiPost("/config/change-pin", { old_pin: oldPin, new_pin: newPin });
    if (result && result.success) {
        setStoredPin(newPin);
        if (status) { status.className = "config-status success"; status.textContent = "PIN alterado com sucesso!"; }
        document.getElementById("config-old-pin").value = "";
        document.getElementById("config-new-pin").value = "";
    } else {
        if (status) { status.className = "config-status error"; status.textContent = "Erro: PIN atual incorreto ou falha no servidor."; }
    }
}

// ─── Download All Assets by Type ───
async function downloadAllAssets() {
    const pin = getStoredPin();
    if (!pin) { alert("PIN não encontrado. Faça login novamente."); return; }

    const assetType = document.getElementById("config-asset-type")?.value || "stock";
    const timeframe = document.getElementById("config-timeframe")?.value || "daily";
    const startDate = document.getElementById("config-start-date")?.value || "";
    const endDate = document.getElementById("config-end-date")?.value || "";

    const progressDiv = document.getElementById("config-download-progress");
    const progressLabel = document.getElementById("config-progress-label");
    const progressCount = document.getElementById("config-progress-count");
    const progressBar = document.getElementById("config-progress-bar");
    const progressLog = document.getElementById("config-progress-log");
    const btn = document.getElementById("config-download-btn");

    if (progressDiv) progressDiv.style.display = "block";
    if (progressLog) progressLog.innerHTML = "";
    if (progressLabel) progressLabel.textContent = "Buscando lista de ativos...";
    if (progressBar) progressBar.style.width = "0%";
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...'; }

    // Fetch ticker list from BRAPI
    let tickers = [];
    try {
        let brapiType = assetType;
        if (assetType === "etf") brapiType = "stock";

        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const data = await brapiGet("/quote/list", { type: brapiType, limit: 100, page: page });
            if (!data || !data.stocks || data.stocks.length === 0) { hasMore = false; break; }
            data.stocks.forEach(s => tickers.push(s.stock));
            hasMore = data.hasNextPage || false;
            page++;
            if (page > 20) break;
        }

        // Filter by asset type
        if (assetType === "etf") {
            tickers = tickers.filter(t => t.endsWith("11"));
        } else if (assetType === "stock") {
            tickers = tickers.filter(t => !t.endsWith("11") && !t.endsWith("F"));
        }
        // fund and bdr already come filtered from brapi
    } catch (e) {
        if (progressLog) progressLog.innerHTML = `<div class="log-error">Erro ao buscar lista: ${e.message}</div>`;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
        return;
    }

    if (tickers.length === 0) {
        if (progressLog) progressLog.innerHTML = `<div class="log-error">Nenhum ativo encontrado para "${assetType}".</div>`;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
        return;
    }

    if (progressLabel) progressLabel.textContent = `Baixando ${tickers.length} ativos...`;
    if (progressCount) progressCount.textContent = `0/${tickers.length}`;

    let successCount = 0, errorCount = 0;

    for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        try {
            const result = await apiPost("/config/download-data", {
                pin: pin,
                ticker: ticker,
                start_date: startDate,
                end_date: endDate,
                timeframe: timeframe,
            });
            if (result && result.success) {
                successCount++;
                if (progressLog) progressLog.innerHTML += `<div class="log-success">✓ ${ticker} — ${result.records||0} registros</div>`;
            } else {
                errorCount++;
                if (progressLog) progressLog.innerHTML += `<div class="log-error">✗ ${ticker} — ${result?.message||"erro"}</div>`;
            }
        } catch (e) {
            errorCount++;
            if (progressLog) progressLog.innerHTML += `<div class="log-error">✗ ${ticker} — ${e.message}</div>`;
        }

        const pct = Math.round(((i + 1) / tickers.length) * 100);
        if (progressBar) progressBar.style.width = pct + "%";
        if (progressCount) progressCount.textContent = `${i + 1}/${tickers.length}`;
        if (progressLog) progressLog.scrollTop = progressLog.scrollHeight;
        await new Promise(r => setTimeout(r, 300));
    }

    if (progressLabel) progressLabel.textContent = `Concluído: ${successCount} ok, ${errorCount} erros`;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
    showConfigPanel();
}

// ─── Update All Assets (incremental) ───
async function updateAllAssets() {
    const pin = getStoredPin();
    if (!pin) { alert("PIN não encontrado. Faça login novamente."); return; }

    const timeframe = document.getElementById("config-timeframe")?.value || "daily";
    const progressDiv = document.getElementById("config-download-progress");
    const progressLabel = document.getElementById("config-progress-label");
    const progressCount = document.getElementById("config-progress-count");
    const progressBar = document.getElementById("config-progress-bar");
    const progressLog = document.getElementById("config-progress-log");
    const btn = document.getElementById("config-update-btn");

    if (progressDiv) progressDiv.style.display = "block";
    if (progressLog) progressLog.innerHTML = "";
    if (progressBar) progressBar.style.width = "0%";
    if (progressLabel) progressLabel.textContent = "Buscando ativos salvos...";
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...'; }

    const assetsData = await apiGet("/config/assets");
    const assets = assetsData?.assets || [];

    if (assets.length === 0) {
        if (progressLog) progressLog.innerHTML = '<div class="log-info">Nenhum ativo salvo. Baixe os dados primeiro.</div>';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados'; }
        return;
    }

    if (progressLabel) progressLabel.textContent = `Atualizando ${assets.length} ativos...`;
    if (progressCount) progressCount.textContent = `0/${assets.length}`;

    const today = getTodayStr();
    let successCount = 0, errorCount = 0;

    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const ticker = asset.ticker || asset;
        const lastUpdate = asset.last_update ? asset.last_update.split("T")[0] : "";

        try {
            const result = await apiPost("/config/download-data", {
                pin: pin,
                ticker: ticker,
                start_date: lastUpdate || "",
                end_date: today,
                timeframe: asset.timeframe || timeframe,
            });
            if (result && result.success) {
                successCount++;
                if (progressLog) progressLog.innerHTML += `<div class="log-success">✓ ${ticker} — ${result.records||0} novos</div>`;
            } else {
                errorCount++;
                if (progressLog) progressLog.innerHTML += `<div class="log-error">✗ ${ticker} — ${result?.message||"erro"}</div>`;
            }
        } catch (e) {
            errorCount++;
            if (progressLog) progressLog.innerHTML += `<div class="log-error">✗ ${ticker} — ${e.message}</div>`;
        }

        const pct = Math.round(((i + 1) / assets.length) * 100);
        if (progressBar) progressBar.style.width = pct + "%";
        if (progressCount) progressCount.textContent = `${i + 1}/${assets.length}`;
        if (progressLog) progressLog.scrollTop = progressLog.scrollHeight;
        await new Promise(r => setTimeout(r, 300));
    }

    if (progressLabel) progressLabel.textContent = `Concluído: ${successCount} ok, ${errorCount} erros`;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados'; }
    showConfigPanel();
}

// ============================================================
// B3 DAILY
// ============================================================
async function loadDailyPage() {
    const entryData = await apiGet("/strategies/daily/entry");
    if (entryData?.strategies) populateSelect("daily-entry-strategy", entryData.strategies, "pct_prev_close");
    const exitData = await apiGet("/strategies/daily/exit");
    if (exitData?.strategies) populateSelect("daily-exit-strategy", exitData.strategies, "close_same_day");
    setupDirectionButtons("daily-btn-compra", "daily-btn-venda", "daily-direction");

    const s = document.getElementById("daily-start-date");
    const e = document.getElementById("daily-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();

    const entrySelect = document.getElementById("daily-entry-strategy");
    if (entrySelect) {
        entrySelect.addEventListener("change", () => {
            const varDiv = document.getElementById("daily-variation-div");
            if (!varDiv) return;
            const needs = ["pct_prev_close","pct_prev_open","pct_current_open","pct_prev_close_sniper","pct_prev_open_sniper"];
            varDiv.style.display = needs.includes(entrySelect.value) ? "block" : "none";
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

    if (!entryStrategy || !exitStrategy) { alert("Selecione as estratégias de entrada e saída."); return; }

    const btn = document.getElementById("daily-run-btn");
    const origHTML = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }

    const body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction, variation_pct: variationPct, start_date: startDate || null, end_date: endDate || null };
    if (tickersInput) body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    else if (market && market !== "custom") body.market = market;
    else body.market = "b3";

    const result = await apiPost("/backtest/daily", body);
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
    if (!result) { alert("Erro ao executar backtest."); return; }
    displayResults("daily-results", "daily-results-table", result);
}

// ============================================================
// B3 INTRADAY
// ============================================================
async function loadIntradayPage() {
    const entryData = await apiGet("/strategies/intraday/entry");
    if (entryData?.strategies) populateSelect("intra-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    const exitData = await apiGet("/strategies/intraday/exit");
    if (exitData?.strategies) populateSelect("intra-exit-strategy", exitData.strategies, "intra_exit_day_close");
    setupDirectionButtons("intra-btn-compra", "intra-btn-venda", "intra-direction");
    const s = document.getElementById("intra-start-date");
    const e = document.getElementById("intra-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();
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

    if (!entryStrategy || !exitStrategy) { alert("Selecione as estratégias."); return; }

    const btn = document.getElementById("intra-run-btn");
    const origHTML = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }

    const body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction, variation_pct: variationPct, hour_start: hourStart, hour_end: hourEnd, period: "3mo", start_date: startDate || null, end_date: endDate || null };
    if (tickersInput) body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    else if (market && market !== "custom") body.market = market;
    else body.market = "b3";

    const result = await apiPost("/backtest/intraday", body);
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
    if (!result) { alert("Erro ao executar backtest intraday."); return; }
    displayResults("intra-results", "intra-results-table", result);
}

// ============================================================
// BMF INTRADAY
// ============================================================
async function loadBmfIntradayPage() {
    const entryData = await apiGet("/strategies/intraday/entry");
    if (entryData?.strategies) populateSelect("bmf-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    const exitData = await apiGet("/strategies/intraday/exit");
    if (exitData?.strategies) populateSelect("bmf-exit-strategy", exitData.strategies, "intra_exit_day_close");
    setupDirectionButtons("bmf-btn-compra", "bmf-btn-venda", "bmf-direction");
    const s = document.getElementById("bmf-start-date");
    const e = document.getElementById("bmf-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();
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

    if (!entryStrategy || !exitStrategy) { alert("Selecione as estratégias."); return; }

    const btn = document.getElementById("bmf-run-btn");
    const origHTML = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }

    const body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction, variation_pct: variationPct, hour_start: hourStart, hour_end: hourEnd, period: "3mo", start_date: startDate || null, end_date: endDate || null };
    if (tickersInput) body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    else body.market = "bmf";

    const result = await apiPost("/backtest/intraday", body);
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
    if (!result) { alert("Erro ao executar backtest BMF."); return; }
    displayResults("bmf-results", "bmf-results-table", result);
}

// ============================================================
// SHARED RESULTS DISPLAY
// ============================================================
function displayResults(containerId, tableId, result) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let rows = [];
    if (result.ticker && result.metrics) {
        const m = result.metrics;
        rows.push({ acao: result.ticker, total_gain: m.total_gain, pct_gain: m.pct_gain, total_loss: m.total_loss, pct_loss: m.pct_loss, total_trades: m.total_trades, resultado_pct: m.resultado_pct, max_drawdown_pct: m.max_drawdown_pct, ganho_maximo_pct: m.ganho_maximo_pct, ganho_medio_pct: m.ganho_medio_pct, volume_medio: m.volume_medio });
    } else if (result.results) {
        rows = result.results;
    }

    if (rows.length === 0) { container.innerHTML = '<p class="text-muted" style="padding:1rem">Nenhum resultado encontrado.</p>'; return; }

    let html = `<div class="glass-card mt-4"><div class="card-header-custom"><i class="fas fa-table"></i> Resultados (${rows.length} ativo${rows.length>1?"s":""})</div><div class="card-body-custom">
    <div class="table-responsive">
        <table class="table table-dark table-striped table-sm" id="${tableId}">
            <thead><tr>
                <th>AÇÃO</th><th>TOTAL GAIN</th><th>% GAIN</th><th>TOTAL LOSS</th><th>% LOSS</th>
                <th>TOTAL TRADES</th><th>RESULTADO %</th><th>MAX DRAWDOWN %</th>
                <th>GANHO MÁXIMO %</th><th>GANHO MÉDIO %</th><th>VOLUME MÉDIO</th>
            </tr></thead><tbody>`;

    rows.forEach(r => {
        const cls = (r.resultado_pct||0) >= 0 ? "text-success" : "text-danger";
        html += `<tr>
            <td><strong>${r.acao||""}</strong></td>
            <td>${r.total_gain||0}</td><td>${fmtPct(r.pct_gain)}</td>
            <td>${r.total_loss||0}</td><td>${fmtPct(r.pct_loss)}</td>
            <td>${r.total_trades||0}</td>
            <td class="${cls}">${fmtPct(r.resultado_pct)}</td>
            <td>${fmtPct(r.max_drawdown_pct)}</td>
            <td>${fmtPct(r.ganho_maximo_pct)}</td>
            <td>${fmtPct(r.ganho_medio_pct)}</td>
            <td>${fmtVol(r.volume_medio)}</td>
        </tr>`;
    });

    html += `</tbody></table></div></div></div>`;
    container.innerHTML = html;
    makeSortable(tableId);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-link[data-page]").forEach(link => {
        link.addEventListener("click", (e) => { e.preventDefault(); navigate(link.dataset.page); });
    });
    navigate("dashboard");
});
