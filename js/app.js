// ============================================================
// js/app.js — Trade Halley Frontend v3.2 (COMPLETE + EXPORT)
// ============================================================

var API_BASE = "https://wanderhalleylee-trade-halley.hf.space";

function getBrapiToken() { return localStorage.getItem("brapi_token") || "ktC3hLVgH3QXrFnssfbcUj"; }
function setBrapiToken(token) { localStorage.setItem("brapi_token", token); }
function getStoredPin() { return localStorage.getItem("config_pin") || ""; }
function setStoredPin(pin) { localStorage.setItem("config_pin", pin); }

// ============================================================
// ABORT CONTROLLERS
// ============================================================
var backtestControllers = { daily: null, intraday: null, bmf: null };

function abortPrevious(key) {
    if (backtestControllers[key]) {
        backtestControllers[key].abort();
        backtestControllers[key] = null;
    }
}

// ============================================================
// API HELPERS
// ============================================================
async function apiGet(path) {
    try {
        var resp = await fetch(API_BASE + path);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return await resp.json();
    } catch (e) { console.error("GET " + path + ":", e); return null; }
}

async function apiPost(path, body, signal) {
    try {
        var opts = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        };
        if (signal) opts.signal = signal;
        var resp = await fetch(API_BASE + path, opts);
        if (!resp.ok) {
            var txt = await resp.text();
            throw new Error("HTTP " + resp.status + ": " + txt);
        }
        return await resp.json();
    } catch (e) {
        if (e.name === "AbortError") { console.log("POST " + path + ": cancelado"); return "__ABORTED__"; }
        console.error("POST " + path + ":", e);
        return null;
    }
}

async function apiDelete(path) {
    try {
        var resp = await fetch(API_BASE + path, { method: "DELETE" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return await resp.json();
    } catch (e) { console.error("DELETE " + path + ":", e); return null; }
}

async function brapiGet(endpoint, params) {
    if (!params) params = {};
    params.token = getBrapiToken();
    var qs = new URLSearchParams(params).toString();
    try {
        var resp = await fetch("https://brapi.dev/api" + endpoint + "?" + qs);
        if (!resp.ok) throw new Error("BRAPI " + resp.status);
        return await resp.json();
    } catch (e) { console.error("BRAPI " + endpoint + ":", e); return null; }
}

async function fetchAllBrapiTickers(type) {
    var tickers = [], page = 1, hasMore = true;
    while (hasMore) {
        var data = await brapiGet("/quote/list", { type: type, limit: 100, page: page });
        if (!data || !data.stocks || data.stocks.length === 0) { hasMore = false; break; }
        data.stocks.forEach(function(s) { tickers.push(s.stock); });
        hasMore = data.hasNextPage || false;
        page++;
        if (page > 50) break;
    }
    return tickers;
}

// ============================================================
// NAVIGATION
// ============================================================
var currentPage = "daily";

function navigate(page) {
    currentPage = page;
    document.querySelectorAll(".page-content").forEach(function(el) { el.classList.add("d-none"); });
    var target = document.getElementById("page-" + page);
    if (target) target.classList.remove("d-none");
    document.querySelectorAll(".nav-link").forEach(function(el) { el.classList.remove("active"); });
    var navLink = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (navLink) navLink.classList.add("active");
    var sb = document.getElementById("sidebar");
    if (sb) { sb.classList.remove("open"); sb.classList.remove("mobile-open"); }
    var ov = document.getElementById("sidebarOverlay");
    if (ov) ov.classList.remove("active");
    switch (page) {
        case "daily": loadDailyPage(); break;
        case "intraday": loadIntradayPage(); break;
        case "bmf-intraday": loadBmfIntradayPage(); break;
        case "strategies": loadStrategiesPage(); break;
        case "saved": loadSavedPage(); break;
        case "config": loadConfigPage(); break;
    }
}

// ============================================================
// UTILITIES
// ============================================================
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
    var d = new Date();
    d.setFullYear(d.getFullYear(), 0, 1);
    return d.toISOString().split("T")[0];
}

function populateSelect(selectId, options, defaultVal) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    options.forEach(function(opt) {
        var o = document.createElement("option");
        o.value = opt.id || opt.value || opt;
        o.textContent = opt.name || opt.label || opt;
        if (o.value === defaultVal) o.selected = true;
        sel.appendChild(o);
    });
}

// ============================================================
// SORTABLE TABLES
// ============================================================
var sortState = {};

function makeSortable(tableId) {
    var table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll("thead th").forEach(function(th, colIdx) {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.style.whiteSpace = "nowrap";
        var old = th.querySelector(".sort-arrow");
        if (old) old.remove();
        var arrow = document.createElement("span");
        arrow.className = "sort-arrow";
        arrow.style.marginLeft = "6px";
        arrow.style.fontSize = "0.7em";
        arrow.style.opacity = "0.4";
        arrow.textContent = "\u21C5";
        th.appendChild(arrow);
        var newTh = th.cloneNode(true);
        th.parentNode.replaceChild(newTh, th);
        newTh.addEventListener("click", function() { sortTable(tableId, colIdx); });
    });
}

function sortTable(tableId, colIdx) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) return;
    if (!sortState[tableId]) sortState[tableId] = {};
    var prev = sortState[tableId];
    var dir = "desc";
    if (prev.col === colIdx && prev.dir === "desc") dir = "asc";
    sortState[tableId] = { col: colIdx, dir: dir };
    table.querySelectorAll("thead th").forEach(function(th, i) {
        var arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        if (i === colIdx) { arrow.textContent = dir === "asc" ? "\u25B2" : "\u25BC"; arrow.style.opacity = "1"; }
        else { arrow.textContent = "\u21C5"; arrow.style.opacity = "0.4"; }
    });
    rows.sort(function(a, b) {
        var aVal = a.cells[colIdx] ? a.cells[colIdx].textContent.trim() : "";
        var bVal = b.cells[colIdx] ? b.cells[colIdx].textContent.trim() : "";
        var aNum = parseFloat(aVal.replace(/[R$%\s]/g, "").replace(/\./g, "").replace(",", "."));
        var bNum = parseFloat(bVal.replace(/[R$%\s]/g, "").replace(/\./g, "").replace(",", "."));
        if (!isNaN(aNum) && !isNaN(bNum)) return dir === "asc" ? aNum - bNum : bNum - aNum;
        return dir === "asc" ? aVal.localeCompare(bVal, "pt-BR") : bVal.localeCompare(aVal, "pt-BR");
    });
    rows.forEach(function(row) { tbody.appendChild(row); });
}

function setupDirectionButtons(buyBtnId, sellBtnId, hiddenFieldId) {
    var buyBtn = document.getElementById(buyBtnId);
    var sellBtn = document.getElementById(sellBtnId);
    var hidden = document.getElementById(hiddenFieldId);
    if (!buyBtn || !sellBtn) return;
    buyBtn.addEventListener("click", function() {
        buyBtn.classList.add("active-dir"); sellBtn.classList.remove("active-dir");
        if (hidden) hidden.value = "compra";
    });
    sellBtn.addEventListener("click", function() {
        sellBtn.classList.add("active-dir"); buyBtn.classList.remove("active-dir");
        if (hidden) hidden.value = "venda";
    });
}

// ============================================================
// STRATEGIES PAGE
// ============================================================
async function loadStrategiesPage() {
    var data = await apiGet("/strategies/all");
    var container = document.getElementById("strategies-container");
    if (!container) return;
    if (!data) { container.innerHTML = '<p class="text-muted">Erro ao carregar estrat\u00e9gias.</p>'; return; }
    var html = "";
    function buildSection(icon, title, items, cols) {
        if (!items || items.length === 0) return "";
        var h = '<div class="strategy-section"><div class="strategy-section-title"><i class="fas fa-' + icon + '"></i> ' + title + ' (' + items.length + ')</div>';
        h += '<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>';
        cols.forEach(function(c) { h += '<th>' + c + '</th>'; });
        h += '</tr></thead><tbody>';
        items.forEach(function(s) {
            h += '<tr><td><strong>' + (s.name || "") + '</strong></td><td>' + (s.description || "") + '</td><td>' + (s.category || "") + '</td>';
            if (cols.length > 3) h += '<td>' + ((s.requires || []).join(", ") || "\u2014") + '</td>';
            h += '</tr>';
        });
        h += '</tbody></table></div></div>';
        return h;
    }
    html += buildSection("wave-square", "Indicadores T\u00e9cnicos", data.indicator_strategies, ["Nome", "Descri\u00e7\u00e3o", "Categoria"]);
    html += buildSection("sign-in-alt", "Entrada Di\u00e1rio", data.daily_entry, ["Nome", "Descri\u00e7\u00e3o", "Categoria", "Requer"]);
    html += buildSection("sign-out-alt", "Sa\u00edda Di\u00e1rio", data.daily_exit, ["Nome", "Descri\u00e7\u00e3o", "Categoria"]);
    html += buildSection("sign-in-alt", "Entrada Intraday", data.intraday_entry, ["Nome", "Descri\u00e7\u00e3o", "Categoria", "Requer"]);
    html += buildSection("sign-out-alt", "Sa\u00edda Intraday", data.intraday_exit, ["Nome", "Descri\u00e7\u00e3o", "Categoria", "Requer"]);
    container.innerHTML = html;
}

// ============================================================
// SAVED BACKTESTS
// ============================================================
async function loadSavedPage() {
    var data = await apiGet("/backtests/saved");
    var container = document.getElementById("saved-container");
    if (!container) return;
    if (!data || !data.backtests || data.backtests.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum backtest salvo.</p>'; return;
    }
    var html = '<div class="table-responsive"><table class="table table-dark table-sm"><thead><tr>';
    html += '<th>Ticker</th><th>Estrat\u00e9gia</th><th>Resultado</th><th>Data</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>';
    data.backtests.forEach(function(bt) {
        var tk = bt.ticker || (bt.result ? bt.result.ticker : "") || "";
        var st = bt.entry_strategy_name || bt.strategy_name || bt.strategy || (bt.result ? bt.result.entry_strategy_name : "") || "";
        var rp = bt.resultado_pct || bt.total_return_pct || (bt.metrics ? bt.metrics.resultado_pct : 0) || (bt.result && bt.result.metrics ? bt.result.metrics.resultado_pct : 0) || 0;
        html += '<tr><td>' + tk + '</td><td>' + st + '</td><td>' + fmtPct(rp) + '</td><td>' + (bt.saved_at || "") + '</td>';
        html += '<td><button class="btn btn-outline-danger btn-sm" onclick="deleteSavedBacktest(\'' + bt.id + '\')"><i class="fas fa-trash"></i></button></td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function deleteSavedBacktest(id) {
    if (!confirm("Excluir este backtest salvo?")) return;
    await apiDelete("/backtests/saved/" + id);
    loadSavedPage();
}

// ============================================================
// CONFIG PAGE
// ============================================================
var configAuthenticated = false;

async function loadConfigPage() {
    var savedPin = getStoredPin();
    if (configAuthenticated && savedPin) { showConfigPanel(); return; }
    if (savedPin) {
        var result = await apiPost("/config/verify-pin", { pin: savedPin });
        if (result && result.valid) { configAuthenticated = true; showConfigPanel(); return; }
        else { localStorage.removeItem("config_pin"); }
    }
    document.getElementById("config-login-screen").style.display = "block";
    document.getElementById("config-panel").style.display = "none";
    var pi = document.getElementById("config-pin-input");
    if (pi) pi.focus();
}

async function verifyConfigPin() {
    var pinInput = document.getElementById("config-pin-input");
    var errorDiv = document.getElementById("config-pin-error");
    var pin = pinInput ? pinInput.value.trim() : "";
    if (!pin) {
        if (errorDiv) { errorDiv.className = "config-status error"; errorDiv.textContent = "Digite o PIN."; }
        return;
    }
    var result = await apiPost("/config/verify-pin", { pin: pin });
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
    var tokenInput = document.getElementById("config-brapi-token");
    if (tokenInput) tokenInput.value = getBrapiToken();
    var sd = document.getElementById("config-start-date");
    var ed = document.getElementById("config-end-date");
    if (sd && !sd.value) { var d = new Date(); d.setFullYear(d.getFullYear() - 1); sd.value = d.toISOString().split("T")[0]; }
    if (ed && !ed.value) ed.value = getTodayStr();
    var stats = await apiGet("/storage/stats");
    var statsDiv = document.getElementById("config-stats");
    if (statsDiv && stats) {
        var lastUpdate = stats.last_auto_update ? new Date(stats.last_auto_update).toLocaleString("pt-BR") : "Nunca";
        statsDiv.innerHTML = '<div class="stats-grid">' +
            '<div class="stat-mini"><div class="stat-val">' + (stats.total_assets || 0) + '</div><div class="stat-lbl">Total Ativos</div></div>' +
            '<div class="stat-mini"><div class="stat-val">' + (stats.daily_assets || 0) + '</div><div class="stat-lbl">Ativos Di\u00e1rios</div></div>' +
            '<div class="stat-mini"><div class="stat-val">' + (stats.intraday_assets || 0) + '</div><div class="stat-lbl">Ativos Intraday</div></div>' +
            '<div class="stat-mini"><div class="stat-val">' + (stats.total_records || 0).toLocaleString("pt-BR") + '</div><div class="stat-lbl">Total Registros</div></div>' +
            '<div class="stat-mini"><div class="stat-val">' + (stats.total_backtests || 0) + '</div><div class="stat-lbl">Backtests Salvos</div></div>' +
            '<div class="stat-mini"><div class="stat-val">' + lastUpdate + '</div><div class="stat-lbl">\u00daltima Atualiza\u00e7\u00e3o</div></div>' +
            '</div>';
    }
    loadConfigAssetsTable();
}

async function loadConfigAssetsTable() {
    var container = document.getElementById("config-assets-table");
    if (!container) return;
    var assetsData = await apiGet("/config/assets");
    var assets = (assetsData && assetsData.assets) ? assetsData.assets : [];
    if (assets.length === 0) {
        container.innerHTML = '<div class="no-assets-msg"><i class="fas fa-inbox"></i><p>Nenhum ativo armazenado no Supabase.<br>Use "Baixar Dados" acima para come\u00e7ar.</p></div>';
        return;
    }
    var html = '<div class="assets-stored-table"><div class="table-responsive">' +
        '<table class="table table-dark table-sm" id="config-assets-tbl"><thead><tr>' +
        '<th>Ticker</th><th>Nome</th><th>\u00daltima Atualiza\u00e7\u00e3o</th><th>Data In\u00edcio</th><th>Data Fim</th><th>Timeframe</th><th>Registros</th>' +
        '</tr></thead><tbody>';
    assets.forEach(function(a) {
        var lastUpd = a.last_update ? new Date(a.last_update).toLocaleString("pt-BR") : "\u2014";
        var dStart = a.daily_start || "\u2014", dEnd = a.daily_end || "\u2014";
        var iStart = a.intraday_start || "", iEnd = a.intraday_end || "";
        var dRec = a.daily_records || 0, iRec = a.intraday_records || 0;
        if (dRec > 0) html += '<tr><td><strong>' + (a.ticker || "") + '</strong></td><td>' + (a.name || "\u2014") + '</td><td>' + lastUpd + '</td><td>' + dStart + '</td><td>' + dEnd + '</td><td>Di\u00e1rio</td><td>' + dRec.toLocaleString("pt-BR") + '</td></tr>';
        if (iRec > 0) html += '<tr><td><strong>' + (a.ticker || "") + '</strong></td><td>' + (a.name || "\u2014") + '</td><td>' + lastUpd + '</td><td>' + (iStart || "\u2014") + '</td><td>' + (iEnd || "\u2014") + '</td><td>Intraday</td><td>' + iRec.toLocaleString("pt-BR") + '</td></tr>';
        if (dRec === 0 && iRec === 0) html += '<tr><td><strong>' + (a.ticker || "") + '</strong></td><td>' + (a.name || "\u2014") + '</td><td>' + lastUpd + '</td><td>\u2014</td><td>\u2014</td><td>\u2014</td><td>0</td></tr>';
    });
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
    makeSortable("config-assets-tbl");
}

function saveBrapiToken() {
    var input = document.getElementById("config-brapi-token");
    var status = document.getElementById("config-token-status");
    if (!input || !input.value.trim()) { if (status) { status.className = "config-status error"; status.textContent = "Token n\u00e3o pode ser vazio."; } return; }
    setBrapiToken(input.value.trim());
    if (status) { status.className = "config-status success"; status.textContent = "Token salvo com sucesso!"; }
}

async function changeConfigPin() {
    var oldPin = document.getElementById("config-old-pin") ? document.getElementById("config-old-pin").value.trim() : "";
    var newPin = document.getElementById("config-new-pin") ? document.getElementById("config-new-pin").value.trim() : "";
    var status = document.getElementById("config-pin-change-status");
    if (!oldPin || !newPin) { if (status) { status.className = "config-status error"; status.textContent = "Preencha ambos os campos."; } return; }
    var result = await apiPost("/config/change-pin", { old_pin: oldPin, new_pin: newPin });
    if (result && result.success) {
        setStoredPin(newPin);
        if (status) { status.className = "config-status success"; status.textContent = "PIN alterado com sucesso!"; }
        document.getElementById("config-old-pin").value = "";
        document.getElementById("config-new-pin").value = "";
    } else {
        if (status) { status.className = "config-status error"; status.textContent = "Erro: PIN atual incorreto ou falha no servidor."; }
    }
}

async function downloadAllAssets() {
    var pin = getStoredPin();
    if (!pin) { alert("PIN n\u00e3o encontrado. Fa\u00e7a login novamente."); return; }
    var assetType = document.getElementById("config-asset-type") ? document.getElementById("config-asset-type").value : "stock";
    var timeframe = document.getElementById("config-timeframe") ? document.getElementById("config-timeframe").value : "daily";
    var startDate = document.getElementById("config-start-date") ? document.getElementById("config-start-date").value : "";
    var endDate = document.getElementById("config-end-date") ? document.getElementById("config-end-date").value : "";
    var progressDiv = document.getElementById("config-download-progress");
    var progressLabel = document.getElementById("config-progress-label");
    var progressCount = document.getElementById("config-progress-count");
    var progressBar = document.getElementById("config-progress-bar");
    var progressLog = document.getElementById("config-progress-log");
    var btn = document.getElementById("config-download-btn");
    if (progressDiv) progressDiv.style.display = "block";
    if (progressLog) progressLog.innerHTML = "";
    if (progressLabel) progressLabel.textContent = "Buscando lista de ativos...";
    if (progressBar) progressBar.style.width = "0%";
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...'; }
    var tickers = [];
    try {
        var brapiType = assetType;
        if (assetType === "etf") brapiType = "stock";
        tickers = await fetchAllBrapiTickers(brapiType);
        if (assetType === "etf") tickers = tickers.filter(function(t) { return t.endsWith("11"); });
        else if (assetType === "stock") tickers = tickers.filter(function(t) { return !t.endsWith("11") && !t.endsWith("F"); });
    } catch (e) {
        if (progressLog) progressLog.innerHTML = '<div class="log-error">Erro ao buscar lista: ' + e.message + '</div>';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
        return;
    }
    if (tickers.length === 0) {
        if (progressLog) progressLog.innerHTML = '<div class="log-error">Nenhum ativo encontrado.</div>';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
        return;
    }
    if (progressLabel) progressLabel.textContent = "Baixando " + tickers.length + " ativos...";
    if (progressCount) progressCount.textContent = "0/" + tickers.length;
    var successCount = 0, errorCount = 0;
    for (var i = 0; i < tickers.length; i++) {
        var ticker = tickers[i];
        try {
            var result = await apiPost("/config/download-data", { pin: pin, ticker: ticker, start_date: startDate, end_date: endDate, timeframe: timeframe });
            if (result && result.success) { successCount++; if (progressLog) progressLog.innerHTML += '<div class="log-success">\u2713 ' + ticker + ' \u2014 ' + (result.records || 0) + ' registros</div>'; }
            else { errorCount++; if (progressLog) progressLog.innerHTML += '<div class="log-error">\u2717 ' + ticker + ' \u2014 ' + (result ? result.message || "erro" : "erro") + '</div>'; }
        } catch (e) { errorCount++; if (progressLog) progressLog.innerHTML += '<div class="log-error">\u2717 ' + ticker + ' \u2014 ' + e.message + '</div>'; }
        var pct = Math.round(((i + 1) / tickers.length) * 100);
        if (progressBar) progressBar.style.width = pct + "%";
        if (progressCount) progressCount.textContent = (i + 1) + "/" + tickers.length;
        if (progressLog) progressLog.scrollTop = progressLog.scrollHeight;
        await new Promise(function(r) { setTimeout(r, 300); });
    }
    if (progressLabel) progressLabel.textContent = "Conclu\u00eddo: " + successCount + " ok, " + errorCount + " erros";
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Dados'; }
    showConfigPanel();
}

async function updateAllAssets() {
    var pin = getStoredPin();
    if (!pin) { alert("PIN n\u00e3o encontrado."); return; }
    var timeframe = document.getElementById("config-timeframe") ? document.getElementById("config-timeframe").value : "daily";
    var progressDiv = document.getElementById("config-download-progress");
    var progressLabel = document.getElementById("config-progress-label");
    var progressCount = document.getElementById("config-progress-count");
    var progressBar = document.getElementById("config-progress-bar");
    var progressLog = document.getElementById("config-progress-log");
    var btn = document.getElementById("config-update-btn");
    if (progressDiv) progressDiv.style.display = "block";
    if (progressLog) progressLog.innerHTML = "";
    if (progressBar) progressBar.style.width = "0%";
    if (progressLabel) progressLabel.textContent = "Buscando ativos salvos...";
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...'; }
    var assetsData = await apiGet("/config/assets");
    var assets = (assetsData && assetsData.assets) ? assetsData.assets : [];
    if (assets.length === 0) {
        if (progressLog) progressLog.innerHTML = '<div class="log-info">Nenhum ativo salvo.</div>';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados'; }
        return;
    }
    if (progressLabel) progressLabel.textContent = "Atualizando " + assets.length + " ativos...";
    if (progressCount) progressCount.textContent = "0/" + assets.length;
    var today = getTodayStr();
    var successCount = 0, errorCount = 0;
    for (var i = 0; i < assets.length; i++) {
        var asset = assets[i];
        var ticker = asset.ticker || asset;
        var lastDate = asset.daily_end || asset.intraday_end || asset.last_update || "";
        var startFrom = lastDate ? lastDate.split("T")[0] : "";
        try {
            var result = await apiPost("/config/download-data", { pin: pin, ticker: ticker, start_date: startFrom, end_date: today, timeframe: asset.timeframe || timeframe });
            if (result && result.success) { successCount++; if (progressLog) progressLog.innerHTML += '<div class="log-success">\u2713 ' + ticker + ' \u2014 ' + (result.records || 0) + ' novos</div>'; }
            else { errorCount++; if (progressLog) progressLog.innerHTML += '<div class="log-error">\u2717 ' + ticker + ' \u2014 ' + (result ? result.message || "erro" : "erro") + '</div>'; }
        } catch (e) { errorCount++; if (progressLog) progressLog.innerHTML += '<div class="log-error">\u2717 ' + ticker + ' \u2014 ' + e.message + '</div>'; }
        var pct = Math.round(((i + 1) / assets.length) * 100);
        if (progressBar) progressBar.style.width = pct + "%";
        if (progressCount) progressCount.textContent = (i + 1) + "/" + assets.length;
        if (progressLog) progressLog.scrollTop = progressLog.scrollHeight;
        await new Promise(function(r) { setTimeout(r, 300); });
    }
    if (progressLabel) progressLabel.textContent = "Conclu\u00eddo: " + successCount + " ok, " + errorCount + " erros";
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados'; }
    showConfigPanel();
}

// ============================================================
// B3 DAILY
// ============================================================
async function loadDailyPage() {
    var entryData = await apiGet("/strategies/daily/entry");
    if (entryData && entryData.strategies) populateSelect("daily-entry-strategy", entryData.strategies, "pct_prev_close");
    var exitData = await apiGet("/strategies/daily/exit");
    if (exitData && exitData.strategies) populateSelect("daily-exit-strategy", exitData.strategies, "close_same_day");
    setupDirectionButtons("daily-btn-compra", "daily-btn-venda", "daily-direction");
    var s = document.getElementById("daily-start-date");
    var e = document.getElementById("daily-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();
    var entrySelect = document.getElementById("daily-entry-strategy");
    if (entrySelect) {
        entrySelect.addEventListener("change", function() {
            var varDiv = document.getElementById("daily-variation-div");
            if (!varDiv) return;
            var needs = ["pct_prev_close", "pct_prev_open", "pct_current_open", "pct_prev_close_sniper", "pct_prev_open_sniper"];
            varDiv.style.display = needs.indexOf(entrySelect.value) >= 0 ? "block" : "none";
        });
        entrySelect.dispatchEvent(new Event("change"));
    }
}

async function runDailyBacktest() {
    abortPrevious("daily");
    var resultsDiv = document.getElementById("daily-results");
    if (resultsDiv) resultsDiv.innerHTML = "";
    var controller = new AbortController();
    backtestControllers.daily = controller;
    var entryStrategy = document.getElementById("daily-entry-strategy") ? document.getElementById("daily-entry-strategy").value : "";
    var exitStrategy = document.getElementById("daily-exit-strategy") ? document.getElementById("daily-exit-strategy").value : "";
    var direction = document.getElementById("daily-direction") ? document.getElementById("daily-direction").value : "compra";
    var variationPct = parseFloat(document.getElementById("daily-variation") ? document.getElementById("daily-variation").value : "0");
    var startDate = document.getElementById("daily-start-date") ? document.getElementById("daily-start-date").value : "";
    var endDate = document.getElementById("daily-end-date") ? document.getElementById("daily-end-date").value : "";
    var tickersInput = document.getElementById("daily-tickers") ? document.getElementById("daily-tickers").value.trim() : "";
    var marketSel = document.getElementById("daily-market") ? document.getElementById("daily-market").value : "b3";
    if (!entryStrategy || !exitStrategy) { alert("Selecione as estrat\u00e9gias de entrada e sa\u00edda."); return; }
    var btn = document.getElementById("daily-run-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }
    try {
        var body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction: direction, variation_pct: variationPct, start_date: startDate || null, end_date: endDate || null };
        if (marketSel === "custom" && tickersInput) {
            body.tickers = tickersInput.split(",").map(function(t) { return t.trim().toUpperCase(); }).filter(function(t) { return t; });
        } else { body.market = "b3"; }
        var result = await apiPost("/backtest/daily", body, controller.signal);
        if (result === "__ABORTED__") return;
        if (!result) { alert("Erro ao executar backtest."); return; }
        displayResults("daily-results", "daily-results-table", result);
    } catch (e) {
        if (e.name === "AbortError") return;
        console.error("runDailyBacktest error:", e);
        alert("Erro ao executar backtest: " + e.message);
    } finally {
        backtestControllers.daily = null;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Executar Back-teste'; }
    }
}

// ============================================================
// B3 INTRADAY
// ============================================================
async function loadIntradayPage() {
    var entryData = await apiGet("/strategies/intraday/entry");
    if (entryData && entryData.strategies) populateSelect("intra-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    var exitData = await apiGet("/strategies/intraday/exit");
    if (exitData && exitData.strategies) populateSelect("intra-exit-strategy", exitData.strategies, "intra_exit_day_close");
    setupDirectionButtons("intra-btn-compra", "intra-btn-venda", "intra-direction");
    var s = document.getElementById("intra-start-date");
    var e = document.getElementById("intra-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();
}

async function runIntradayBacktest() {
    abortPrevious("intraday");
    var resultsDiv = document.getElementById("intra-results");
    if (resultsDiv) resultsDiv.innerHTML = "";
    var controller = new AbortController();
    backtestControllers.intraday = controller;
    var entryStrategy = document.getElementById("intra-entry-strategy") ? document.getElementById("intra-entry-strategy").value : "";
    var exitStrategy = document.getElementById("intra-exit-strategy") ? document.getElementById("intra-exit-strategy").value : "";
    var direction = document.getElementById("intra-direction") ? document.getElementById("intra-direction").value : "compra";
    var variationPct = parseFloat(document.getElementById("intra-variation") ? document.getElementById("intra-variation").value : "0");
    var hourStart = document.getElementById("intra-hour-start") ? document.getElementById("intra-hour-start").value : "09:00";
    var hourEnd = document.getElementById("intra-hour-end") ? document.getElementById("intra-hour-end").value : "17:00";
    var startDate = document.getElementById("intra-start-date") ? document.getElementById("intra-start-date").value : "";
    var endDate = document.getElementById("intra-end-date") ? document.getElementById("intra-end-date").value : "";
    var tickersInput = document.getElementById("intra-tickers") ? document.getElementById("intra-tickers").value.trim() : "";
    var marketSel = document.getElementById("intra-market") ? document.getElementById("intra-market").value : "b3";
    if (!entryStrategy || !exitStrategy) { alert("Selecione as estrat\u00e9gias."); return; }
    var btn = document.getElementById("intra-run-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }
    try {
        var body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction: direction, variation_pct: variationPct, hour_start: hourStart, hour_end: hourEnd, period: "3mo", start_date: startDate || null, end_date: endDate || null };
        if (marketSel === "custom" && tickersInput) {
            body.tickers = tickersInput.split(",").map(function(t) { return t.trim().toUpperCase(); }).filter(function(t) { return t; });
        } else { body.market = "b3"; }
        var result = await apiPost("/backtest/intraday", body, controller.signal);
        if (result === "__ABORTED__") return;
        if (!result) { alert("Erro ao executar backtest intraday."); return; }
        displayResults("intra-results", "intra-results-table", result);
    } catch (e) {
        if (e.name === "AbortError") return;
        console.error("runIntradayBacktest error:", e);
        alert("Erro ao executar backtest: " + e.message);
    } finally {
        backtestControllers.intraday = null;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Executar Back-teste Intraday B3'; }
    }
}

// ============================================================
// BMF INTRADAY
// ============================================================
async function loadBmfIntradayPage() {
    var entryData = await apiGet("/strategies/intraday/entry");
    if (entryData && entryData.strategies) populateSelect("bmf-entry-strategy", entryData.strategies, "intra_pct_prev_close");
    var exitData = await apiGet("/strategies/intraday/exit");
    if (exitData && exitData.strategies) populateSelect("bmf-exit-strategy", exitData.strategies, "intra_exit_day_close");
    setupDirectionButtons("bmf-btn-compra", "bmf-btn-venda", "bmf-direction");
    var s = document.getElementById("bmf-start-date");
    var e = document.getElementById("bmf-end-date");
    if (s && !s.value) s.value = getDefaultStartDate();
    if (e && !e.value) e.value = getTodayStr();
}

async function runBmfIntradayBacktest() {
    abortPrevious("bmf");
    var resultsDiv = document.getElementById("bmf-results");
    if (resultsDiv) resultsDiv.innerHTML = "";
    var controller = new AbortController();
    backtestControllers.bmf = controller;
    var entryStrategy = document.getElementById("bmf-entry-strategy") ? document.getElementById("bmf-entry-strategy").value : "";
    var exitStrategy = document.getElementById("bmf-exit-strategy") ? document.getElementById("bmf-exit-strategy").value : "";
    var direction = document.getElementById("bmf-direction") ? document.getElementById("bmf-direction").value : "compra";
    var variationPct = parseFloat(document.getElementById("bmf-variation") ? document.getElementById("bmf-variation").value : "0");
    var hourStart = document.getElementById("bmf-hour-start") ? document.getElementById("bmf-hour-start").value : "09:00";
    var hourEnd = document.getElementById("bmf-hour-end") ? document.getElementById("bmf-hour-end").value : "17:00";
    var startDate = document.getElementById("bmf-start-date") ? document.getElementById("bmf-start-date").value : "";
    var endDate = document.getElementById("bmf-end-date") ? document.getElementById("bmf-end-date").value : "";
    var tickersInput = document.getElementById("bmf-tickers") ? document.getElementById("bmf-tickers").value.trim() : "";
    var marketSel = document.getElementById("bmf-market") ? document.getElementById("bmf-market").value : "bmf";
    if (!entryStrategy || !exitStrategy) { alert("Selecione as estrat\u00e9gias."); return; }
    var btn = document.getElementById("bmf-run-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executando...'; }
    try {
        var body = { entry_strategy: entryStrategy, exit_strategy: exitStrategy, direction: direction, variation_pct: variationPct, hour_start: hourStart, hour_end: hourEnd, period: "3mo", start_date: startDate || null, end_date: endDate || null };
        if (marketSel === "custom" && tickersInput) {
            body.tickers = tickersInput.split(",").map(function(t) { return t.trim().toUpperCase(); }).filter(function(t) { return t; });
        } else { body.market = "bmf"; }
        var result = await apiPost("/backtest/intraday", body, controller.signal);
        if (result === "__ABORTED__") return;
        if (!result) { alert("Erro ao executar backtest BMF."); return; }
        displayResults("bmf-results", "bmf-results-table", result);
    } catch (e) {
        if (e.name === "AbortError") return;
        console.error("runBmfIntradayBacktest error:", e);
        alert("Erro ao executar backtest: " + e.message);
    } finally {
        backtestControllers.bmf = null;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Executar Back-teste BMF Intraday'; }
    }
}

// ============================================================
// DISPLAY RESULTS (COMPLETE - 10 COLUMNS) + EXPORT BUTTONS
// ============================================================
function displayResults(containerId, tableId, result) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // --- Normaliza rows ---
    var rows = [];
    if (result.ticker && result.metrics) {
        var m = result.metrics;
        rows.push({
            acao: result.ticker, total_gain: m.total_gain, pct_gain: m.pct_gain,
            total_loss: m.total_loss, pct_loss: m.pct_loss, total_trades: m.total_trades,
            resultado_pct: m.resultado_pct, max_drawdown_pct: m.max_drawdown_pct,
            ganho_maximo_pct: m.ganho_maximo_pct, ganho_medio_pct: m.ganho_medio_pct,
            volume_medio: m.volume_medio
        });
    } else if (result.results) {
        rows = result.results;
    }

    if (rows.length === 0) {
        container.innerHTML = '<p class="text-muted" style="padding:1rem">Nenhum resultado encontrado.</p>';
        return;
    }

    // --- Estilos inline para th ---
    var thS = 'style="padding:8px 12px;background:#12122a;color:#8888aa;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;text-align:center"';
    var thSL = 'style="padding:8px 12px;background:#12122a;color:#8888aa;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;text-align:left"';

    var t = '';

    // --- Export buttons bar ---
    t += '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-bottom:0.8rem;margin-top:1rem;flex-wrap:wrap">';
    t += '<button onclick="exportResultsPDF(\'' + tableId + '\')" style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><i class="fas fa-file-pdf"></i> Baixar PDF</button>';
    t += '<button onclick="exportResultsXLSX(\'' + tableId + '\')" style="background:linear-gradient(135deg,#27ae60,#1e8449);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><i class="fas fa-file-excel"></i> Baixar XLSX</button>';
    t += '</div>';

    // --- Tabela com 10 colunas ---
    t += '<div class="table-responsive" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">';
    t += '<table class="table table-dark table-sm" id="' + tableId + '" style="margin:0">';
    t += '<thead><tr>';
    t += '<th ' + thSL + '>A\u00c7\u00c3O</th>';
    t += '<th ' + thS + '>TOTAL GAIN</th>';
    t += '<th ' + thS + '>% GAIN</th>';
    t += '<th ' + thS + '>TOTAL LOSS</th>';
    t += '<th ' + thS + '>% LOSS</th>';
    t += '<th ' + thS + '>TOTAL TRADES</th>';
    t += '<th ' + thS + '>RESULTADO %</th>';
    t += '<th ' + thS + '>MAX DRAWDOWN %</th>';
    t += '<th ' + thS + '>GANHO M\u00c1XIMO %</th>';
    t += '<th ' + thS + '>GANHO M\u00c9DIO %</th>';
    t += '<th ' + thS + '>VOLUME M\u00c9DIO</th>';
    t += '</tr></thead><tbody>';

    var tdS = 'style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.85rem;white-space:nowrap"';
    var tdSL = 'style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:left;font-size:0.85rem;font-weight:600;white-space:nowrap"';

    rows.forEach(function(row) {
        var ticker = row.acao || row.ticker || "";
        var tg = row.total_gain || 0;
        var pg = row.pct_gain || 0;
        var tl = row.total_loss || 0;
        var pl = row.pct_loss || 0;
        var tt = row.total_trades || 0;
        var rp = row.resultado_pct || 0;
        var md = row.max_drawdown_pct || 0;
        var gm = row.ganho_maximo_pct || 0;
        var gmp = row.ganho_medio_pct || 0;
        var vm = row.volume_medio || 0;

        var rpColor = rp >= 0 ? "#00d4aa" : "#ff6b6b";
        var mdColor = md >= 0 ? "#00d4aa" : "#ff6b6b";
        var gmColor = gm >= 0 ? "#00d4aa" : "#ff6b6b";
        var gmpColor = gmp >= 0 ? "#00d4aa" : "#ff6b6b";

        t += '<tr>';
        t += '<td ' + tdSL + '>' + ticker + '</td>';
        t += '<td ' + tdS + '>' + tg + '</td>';
        t += '<td ' + tdS + '>' + fmtPct(pg) + '</td>';
        t += '<td ' + tdS + '>' + tl + '</td>';
        t += '<td ' + tdS + '>' + fmtPct(pl) + '</td>';
        t += '<td ' + tdS + '>' + tt + '</td>';
        t += '<td ' + tdS + ' style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.85rem;white-space:nowrap;color:' + rpColor + ';font-weight:700">' + fmtPct(rp) + '</td>';
        t += '<td ' + tdS + ' style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.85rem;white-space:nowrap;color:' + mdColor + ';font-weight:600">' + fmtPct(md) + '</td>';
        t += '<td ' + tdS + ' style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.85rem;white-space:nowrap;color:' + gmColor + ';font-weight:600">' + fmtPct(gm) + '</td>';
        t += '<td ' + tdS + ' style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.85rem;white-space:nowrap;color:' + gmpColor + ';font-weight:600">' + fmtPct(gmp) + '</td>';
        t += '<td ' + tdS + '>' + fmtVol(vm) + '</td>';
        t += '</tr>';
    });

    t += '</tbody></table></div>';

    // --- Summary ---
    if (rows.length > 1) {
        var totalPositive = 0, totalNegative = 0, totalTrades = 0;
        rows.forEach(function(r) {
            var rp = r.resultado_pct || 0;
            if (rp > 0) totalPositive++;
            else if (rp < 0) totalNegative++;
            totalTrades += (r.total_trades || 0);
        });
        t += '<div style="display:flex;gap:1rem;margin-top:0.8rem;flex-wrap:wrap">';
        t += '<div style="background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.3);padding:8px 16px;border-radius:8px;font-size:0.8rem"><span style="color:#8888aa">Positivos:</span> <strong style="color:#00d4aa">' + totalPositive + '</strong></div>';
        t += '<div style="background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);padding:8px 16px;border-radius:8px;font-size:0.8rem"><span style="color:#8888aa">Negativos:</span> <strong style="color:#ff6b6b">' + totalNegative + '</strong></div>';
        t += '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:8px 16px;border-radius:8px;font-size:0.8rem"><span style="color:#8888aa">Ativos:</span> <strong style="color:#fff">' + rows.length + '</strong></div>';
        t += '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:8px 16px;border-radius:8px;font-size:0.8rem"><span style="color:#8888aa">Total Trades:</span> <strong style="color:#fff">' + totalTrades + '</strong></div>';
        t += '</div>';
    }

    container.innerHTML = t;
    makeSortable(tableId);
}

// ============================================================
// EXPORT: PDF
// ============================================================
function exportResultsPDF(tableId) {
    // Detecta jsPDF
    var JsPDFClass = null;
    if (window.jspdf && window.jspdf.jsPDF) {
        JsPDFClass = window.jspdf.jsPDF;
    } else if (typeof jsPDF !== "undefined") {
        JsPDFClass = jsPDF;
    }
    if (!JsPDFClass) {
        alert("Biblioteca jsPDF n\u00e3o carregada. Verifique sua conex\u00e3o e recarregue a p\u00e1gina.");
        return;
    }

    var table = document.getElementById(tableId);
    if (!table) { alert("Tabela n\u00e3o encontrada."); return; }

    var doc = new JsPDFClass({ orientation: "landscape", unit: "mm", format: "a4" });

    // T\u00edtulo
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Trade Halley - Resultado Backtest", 14, 15);

    // Data
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Exportado em: " + new Date().toLocaleString("pt-BR"), 14, 22);

    // Headers
    var headers = [];
    table.querySelectorAll("thead th").forEach(function(th) {
        var txt = th.textContent.trim();
        // Remove sort arrows
        txt = txt.replace(/[\u21C5\u25B2\u25BC]/g, "").trim();
        headers.push(txt);
    });

    // Body
    var body = [];
    table.querySelectorAll("tbody tr").forEach(function(tr) {
        var rowData = [];
        tr.querySelectorAll("td").forEach(function(td) {
            rowData.push(td.textContent.trim());
        });
        if (rowData.length > 0) body.push(rowData);
    });

    // autoTable
    var atOpts = {
        head: [headers],
        body: body,
        startY: 28,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [18, 18, 42], textColor: [200, 200, 220], fontSize: 7, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        margin: { left: 8, right: 8 },
        didDrawPage: function(data) {
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text("Trade Halley v3.2", data.settings.margin.left, doc.internal.pageSize.height - 5);
            doc.text("P\u00e1gina " + doc.internal.getCurrentPageInfo().pageNumber, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 5);
        }
    };

    if (typeof doc.autoTable === "function") {
        doc.autoTable(atOpts);
    } else if (typeof autoTable === "function") {
        autoTable(doc, atOpts);
    } else if (window.jspdfAutoTable) {
        window.jspdfAutoTable(doc, atOpts);
    } else {
        alert("Plugin autoTable n\u00e3o encontrado. Verifique o CDN.");
        return;
    }

    doc.save("backtest_" + getTodayStr() + ".pdf");
}

// ============================================================
// EXPORT: XLSX
// ============================================================
function exportResultsXLSX(tableId) {
    if (typeof XLSX === "undefined") {
        alert("Biblioteca SheetJS/XLSX n\u00e3o carregada. Verifique sua conex\u00e3o e recarregue a p\u00e1gina.");
        return;
    }

    var table = document.getElementById(tableId);
    if (!table) { alert("Tabela n\u00e3o encontrada."); return; }

    // Headers
    var headers = [];
    table.querySelectorAll("thead th").forEach(function(th) {
        var txt = th.textContent.trim();
        txt = txt.replace(/[\u21C5\u25B2\u25BC]/g, "").trim();
        headers.push(txt);
    });

    // Rows
    var data = [headers];
    table.querySelectorAll("tbody tr").forEach(function(tr) {
        var rowData = [];
        tr.querySelectorAll("td").forEach(function(td, idx) {
            var txt = td.textContent.trim();
            if (idx === 0) {
                rowData.push(txt); // ticker como texto
            } else {
                // Tenta converter para n\u00famero
                var num = parseFloat(txt.replace(/[%\s]/g, "").replace(/\./g, "").replace(",", "."));
                if (!isNaN(num)) {
                    rowData.push(num);
                } else {
                    rowData.push(txt);
                }
            }
        });
        if (rowData.length > 0) data.push(rowData);
    });

    var ws = XLSX.utils.aoa_to_sheet(data);

    // Auto-size columns
    var colWidths = headers.map(function(h, i) {
        var max = h.length;
        data.forEach(function(row) {
            var cell = row[i];
            if (cell !== undefined && cell !== null) {
                var len = String(cell).length;
                if (len > max) max = len;
            }
        });
        return { wch: max + 2 };
    });
    ws["!cols"] = colWidths;

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backtest");

    var filename = "backtest_" + getTodayStr() + ".xlsx";
    XLSX.writeFile(wb, filename);
}
