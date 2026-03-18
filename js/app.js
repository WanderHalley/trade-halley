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

// ─── Fetch ALL tickers from BRAPI for a given type ───
async function fetchAllBrapiTickers(type) {
    // type: "stock" | "fund" | "bdr"
    let tickers = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
        const data = await brapiGet("/quote/list", { type: type, limit: 100, page: page });
        if (!data || !data.stocks || data.stocks.length === 0) { hasMore = false; break; }
        data.stocks.forEach(s => tickers.push(s.stock));
        hasMore = data.hasNextPage || false;
        page++;
        if (page > 50) break; // safety limit
    }
    return tickers;
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
        let aNum = parseFloat(aVal.replace(/[R$%\s]/g, "").replace(/\./g, "").replace(",", "."));
        let bNum = parseFloat(bVal.replace(/[R$%\s]/g, "").replace(/\./g, "").replace(",", "."));
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
            <td>${bt.entry_strategy_name||bt.strategy_name||bt.strategy||bt.result?.entry_strategy_name||""}</td>
            <td>${fmtPct(bt.resultado_pct||bt.total_return_pct||bt.metrics?.resultado_pct||bt.result?.metrics?.resultado_pct)}</td>
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

    if (configAuthenticated && savedPin) {
        showConfigPanel();
        return;
    }

    if (savedPin) {
        const result = await apiPost("/config/verify-pin", { pin: savedPin });
        if (result && result.valid) {
            configAuthenticated = true;
            showConfigPanel();
            return;
        } else {
            localStorage.removeItem("config_pin");
        }
    }

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
        const lastUpdate = stats.last_auto_update ? new Date(stats.last_auto_update).toLocaleString("pt-BR") : "Nunca";
        statsDiv.innerHTML = `<div class="stats-grid">
            <div class="stat-mini"><div class="stat-val">${stats.total_assets||0}</div><div class="stat-lbl">Total Ativos</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.daily_assets||0}</div><div class="stat-lbl">Ativos Diários</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.intraday_assets||0}</div><div class="stat-lbl">Ativos Intraday</div></div>
            <div class="stat-mini"><div class="stat-val">${(stats.total_records||0).toLocaleString("pt-BR")}</div><div class="stat-lbl">Total Registros</div></div>
            <div class="stat-mini"><div class="stat-val">${stats.total_backtests||0}</div><div class="stat-lbl">Backtests Salvos</div></div>
            <div class="stat-mini"><div class="stat-val">${lastUpdate}</div><div class="stat-lbl">Última Atualização</div></div>
        </div>`;
    }

    // Load assets table from Supabase
    loadConfigAssetsTable();
}

async function loadConfigAssetsTable() {
    const container = document.getElementById("config-assets-table");
    if (!container) return;

    const assetsData = await apiGet("/config/assets");
    const assets = assetsData?.assets || [];

    if (assets.length === 0) {
        container.innerHTML = '<div class="no-assets-msg"><i class="fas fa-inbox"></i><p>Nenhum ativo armazenado no Supabase.<br>Use "Baixar Dados" acima para começar.</p></div>';
        return;
    }

    let html = `<div class="assets-stored-table"><div class="table-responsive">
    <table class="table table-dark table-sm" id="config-assets-tbl">
    <thead><tr>
        <th>Ticker</th><th>Nome</th><th>Última Atualização</th>
        <th>Data Início</th><th>Data Fim</th><th>Timeframe</th><th>Registros</th>
    </tr></thead><tbody>`;

    assets.forEach(a => {
        const lastUpd = a.last_update ? new Date(a.last_update).toLocaleString("pt-BR") : "—";
        const dailyStart = a.daily_start || "—";
        const dailyEnd = a.daily_end || "—";
        const intraStart = a.intraday_start || "";
        const intraEnd = a.intraday_end || "";
        const dailyRec = a.daily_records || 0;
        const intraRec = a.intraday_records || 0;

        // Show daily row if has daily data
        if (dailyRec > 0) {
            html += `<tr>
                <td><strong>${a.ticker||""}</strong></td>
                <td>${a.name||"—"}</td>
                <td>${lastUpd}</td>
                <td>${dailyStart}</td>
                <td>${dailyEnd}</td>
                <td>Diário</td>
                <td>${dailyRec.toLocaleString("pt-BR")}</td>
            </tr>`;
        }
        // Show intraday row if has intraday data
        if (intraRec > 0) {
            html += `<tr>
                <td><strong>${a.ticker||""}</strong></td>
                <td>${a.name||"—"}</td>
                <td>${lastUpd}</td>
                <td>${intraStart||"—"}</td>
                <td>${intraEnd||"—"}</td>
                <td>Intraday</td>
                <td>${intraRec.toLocaleString("pt-BR")}</td>
            </tr>`;
        }
        // If neither, show basic row
        if (dailyRec === 0 && intraRec === 0) {
            html += `<tr>
                <td><strong>${a.ticker||""}</strong></td>
                <td>${a.name||"—"}</td>
                <td>${lastUpd}</td>
                <td>—</td><td>—</td><td>—</td><td>0</td>
            </tr>`;
        }
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
    makeSortable("config-assets-tbl");
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

    let tickers = [];
    try {
        let brapiType = assetType;
        if (assetType === "etf") brapiType = "stock";

        tickers = await fetchAllBrapiTickers(brapiType);

        // Filter by asset type
        if (assetType === "etf") {
            tickers = tickers.filter(t => t.endsWith("11"));
        } else if (assetType === "stock") {
            tickers = tickers.filter(t => !t.endsWith("11") && !t.endsWith("F"));
        }
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
        const lastDate = asset.daily_end || asset.intraday_end || asset.last_update || "";
        const startFrom = lastDate ? lastDate.split("T")[0] : "";

        try {
            const result = await apiPost("/config/download-data", {
                pin: pin,
                ticker: ticker,
                start_date: startFrom,
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

    if (tickersInput) {
        body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    } else if (market === "b3" || market === "" || market === undefined) {
        // Fetch ALL B3 stock tickers from BRAPI instead of using the hardcoded 30
        try {
            const allTickers = await fetchAllBrapiTickers("stock");
            // Filter out ETFs (ending in 11) and fractional (ending in F)
            const stockTickers = allTickers.filter(t => !t.endsWith("11") && !t.endsWith("F"));
            if (stockTickers.length > 0) {
                body.tickers = stockTickers;
            } else {
                body.market = "b3"; // fallback
            }
        } catch (e) {
            console.error("Failed to fetch all tickers, falling back to market=b3:", e);
            body.market = "b3";
        }
    } else if (market !== "custom") {
        body.market = market;
    } else {
        body.market = "b3";
    }

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

    if (tickersInput) {
        body.tickers = tickersInput.split(",").map(t => t.trim().toUpperCase()).filter(t => t);
    } else if (market === "b3" || market === "" || market === undefined) {
        try {
            const allTickers = await fetchAllBrapiTickers("stock");
            const stockTickers = allTickers.filter(t => !t.endsWith("11") && !t.endsWith("F"));
            if (stockTickers.length > 0) {
                body.tickers = stockTickers;
            } else {
                body.market = "b3";
            }
        } catch (e) {
            console.error("Failed to fetch all tickers:", e);
            body.market = "b3";
        }
    } else if (market !== "custom") {
        body.market = market;
    } else {
        body.market = "b3";
    }

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

    // Build table HTML
    let tableHTML = `<table id="${tableId}" style="min-width:1400px;width:max-content;white-space:nowrap;table-layout:auto;border-collapse:collapse;font-size:.83rem;">
        <thead><tr>
            <th>AÇÃO</th><th>TOTAL GAIN</th><th>% GAIN</th><th>TOTAL LOSS</th><th>% LOSS</th>
            <th>TOTAL TRADES</th><th>RESULTADO %</th><th>MAX DRAWDOWN %</th>
            <th>GANHO MÁXIMO %</th><th>GANHO MÉDIO %</th><th>VOLUME MÉDIO</th>
        </tr></thead><tbody>`;

    rows.forEach(r => {
        const cls = (r.resultado_pct||0) >= 0 ? "text-success" : "text-danger";
        tableHTML += `<tr>
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
    tableHTML += `</tbody></table>`;

    // Create elements via DOM (not innerHTML) to guarantee styles
    container.innerHTML = '';

    // Card wrapper
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(18,18,48,0.55);border:1px solid rgba(255,255,255,0.06);border-radius:16px;margin-top:1.5rem;margin-bottom:1.2rem;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:1rem 1.3rem;border-bottom:1px solid rgba(255,255,255,0.08);font-size:.9rem;font-weight:600;color:#eeeef5;display:flex;align-items:center;gap:.5rem;background:rgba(255,255,255,0.02);border-radius:16px 16px 0 0;';
    header.innerHTML = `<i class="fas fa-table" style="color:#00d4a1;font-size:.85rem;"></i> Resultados (${rows.length} ativo${rows.length>1?"s":""})`;
    card.appendChild(header);

    // Scroll wrapper — THIS is the key element
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = 'overflow-x:scroll;overflow-y:visible;-webkit-overflow-scrolling:touch;width:100%;max-width:100%;display:block;padding-bottom:2px;';
    scrollWrapper.innerHTML = tableHTML;
    card.appendChild(scrollWrapper);

    container.appendChild(card);

    // Style thead/tbody after insertion
    const tbl = document.getElementById(tableId);
    if (tbl) {
        tbl.querySelectorAll('thead th').forEach(th => {
            th.style.cssText = 'padding:.7rem .8rem;background:#12122a;color:#8888aa;font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;position:sticky;top:0;cursor:pointer;user-select:none;';
        });
        tbl.querySelectorAll('tbody td').forEach(td => {
            td.style.cssText = 'padding:.6rem .8rem;border-bottom:1px solid rgba(255,255,255,0.03);color:#eeeef5;vertical-align:middle;white-space:nowrap;';
        });
        tbl.querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(0,212,161,0.04)');
            tr.addEventListener('mouseleave', () => tr.style.background = '');
        });
    }

    // Force scrollbar visibility
    const styleId = 'results-scroll-style';
    if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            #${containerId} > div > div:nth-child(2)::-webkit-scrollbar { height: 12px !important; }
            #${containerId} > div > div:nth-child(2)::-webkit-scrollbar-track { background: #0c0c1e !important; border-radius: 6px !important; }
            #${containerId} > div > div:nth-child(2)::-webkit-scrollbar-thumb { background: #00d4a1 !important; border-radius: 6px !important; }
            #${containerId} > div > div:nth-child(2)::-webkit-scrollbar-thumb:hover { background: #00b88a !important; }
        `;
        document.head.appendChild(s);
    }

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
