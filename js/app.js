// ═══════════════════════════════════════════════
// Trade Halley - Aplicação Principal
// ═══════════════════════════════════════════════

let backtestResults = [];
let currentParams = {};

// ─── Inicialização ───
document.addEventListener('DOMContentLoaded', function() {
    initDatePickers();
    initSelect2();
    initDirectionButtons();
    initOperationLogic();
    loadStocks(1);
    
    toastr.options = {
        positionClass: 'toast-top-center',
        timeOut: 5000,
        closeButton: true
    };
});

function initDatePickers() {
    flatpickr('.datepicker', {
        dateFormat: 'Y-m-d',
        locale: 'pt',
        allowInput: true
    });
}

function initSelect2() {
    $('#selectAtivos').select2({
        placeholder: 'Selecione seus ativos',
        allowClear: true,
        width: '100%'
    });
}

function initDirectionButtons() {
    const btnCompra = document.getElementById('btnCompra');
    const btnVenda = document.getElementById('btnVenda');
    const dirInput = document.getElementById('direction');

    btnCompra.addEventListener('click', () => {
        dirInput.value = 'buy';
        btnCompra.className = 'btn btn-success';
        btnCompra.disabled = true;
        btnVenda.className = 'btn btn-outline-danger ms-2';
        btnVenda.disabled = false;
    });

    btnVenda.addEventListener('click', () => {
        dirInput.value = 'sell';
        btnVenda.className = 'btn btn-danger ms-2';
        btnVenda.disabled = true;
        btnCompra.className = 'btn btn-outline-success';
        btnCompra.disabled = false;
    });
}

function initOperationLogic() {
    const opIn = document.getElementById('operationIn');
    const pctGroup = document.getElementById('percentGroup');

    opIn.addEventListener('change', () => {
        const val = parseInt(opIn.value);
        // Operações que não precisam de %
        const noPct = [4, 5];
        pctGroup.style.display = noPct.includes(val) ? 'none' : 'block';
    });
}

async function loadStocks(type) {
    const select = $('#selectAtivos');
    select.empty();
    
    const data = await TradeHalleyAPI.getStocks(type);
    
    if (data.stocks && data.stocks.length > 0) {
        data.stocks.forEach(s => {
            select.append(new Option(`${s.symbol} - ${s.name}`, s.symbol, false, false));
        });
    }
    select.trigger('change');
}

// Atualizar ativos quando muda tipo
document.querySelectorAll('input[name="tipoAtivo"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        loadStocks(parseInt(e.target.value));
    });
});

// ─── Executar Backtest ───
async function executeBacktest() {
    const dateStart = document.getElementById('dateStart').value;
    const dateEnd = document.getElementById('dateEnd').value;
    
    if (!dateStart || !dateEnd) {
        toastr.warning('Preencha as datas de início e fim');
        return;
    }

    const selectedStocks = $('#selectAtivos').val() || [];
    
    // Se nenhum ativo selecionado, pegar todos visíveis
    let stocks = selectedStocks;
    if (stocks.length === 0) {
        const select = document.getElementById('selectAtivos');
        stocks = Array.from(select.options).map(o => o.value);
    }

    if (stocks.length === 0) {
        toastr.warning('Nenhum ativo disponível');
        return;
    }

    // Limitar a 30 ativos
    if (stocks.length > 30) {
        stocks = stocks.slice(0, 30);
        toastr.info('Limitado a 30 ativos por execução');
    }

    const percent = parseFloat(document.getElementById('percent').value) || 0;

    currentParams = {
        stocks: stocks,
        dateStart: dateStart,
        dateEnd: dateEnd,
        operationIn: parseInt(document.getElementById('operationIn').value),
        operationOut: parseInt(document.getElementById('operationOut').value),
        percent: percent,
        direction: document.getElementById('direction').value,
        timeframe: 'daily',
        interval: '1d'
    };

    // Mostrar progresso
    showProgress(true);
    document.getElementById('btnExecutar').disabled = true;

    const result = await TradeHalleyAPI.runBacktest(currentParams);
    
    showProgress(false);
    document.getElementById('btnExecutar').disabled = false;

    if (result && result.results) {
        backtestResults = result.results;
        renderResults(result.results);
        document.getElementById('btnDownload').disabled = false;
        toastr.success(`Backtest concluído! ${result.total} ativos processados.`);
    }
}

function showProgress(show) {
    document.getElementById('progressContainer').style.display = show ? 'block' : 'none';
}

// ─── Renderizar Resultados ───
function renderResults(results) {
    const container = document.getElementById('resultsTable');
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Nenhum resultado encontrado</p>';
        return;
    }

    let html = `
    <table class="results-table" id="mainResultsTable">
        <thead>
            <tr>
                <th onclick="sortTable(0)">Ação ↕</th>
                <th onclick="sortTable(1)">Total Gain ↕</th>
                <th onclick="sortTable(2)">% Gain ↕</th>
                <th onclick="sortTable(3)">Total Loss ↕</th>
                <th onclick="sortTable(4)">% Loss ↕</th>
                <th onclick="sortTable(5)">Total Trades ↕</th>
                <th onclick="sortTable(6)">Resultado ↕</th>
                <th onclick="sortTable(7)">Max DrawDown ↕</th>
                <th onclick="sortTable(8)">Ganho Máximo ↕</th>
                <th onclick="sortTable(9)">Ganho Médio ↕</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>`;

    results.forEach((r, i) => {
        const pctClass = r.percentTotal >= 0 ? 'positive' : 'negative';
        html += `
            <tr>
                <td><strong>${r.stock}</strong></td>
                <td class="positive">${formatPercent(r.totalGain)}</td>
                <td class="positive">${formatPercent(r.percentGain)}</td>
                <td class="negative">${formatPercent(r.totalLoss)}</td>
                <td class="negative">${formatPercent(r.percentLoss)}</td>
                <td>${r.totalTrades}</td>
                <td class="${pctClass}">${formatPercent(r.percentTotal)}</td>
                <td class="negative">${formatPercent(r.maxDrawdown)}</td>
                <td class="positive">${formatPercent(r.maxGain)}</td>
                <td>${formatPercent(r.averagePercentGain)}</td>
                <td>
                    <button class="btn btn-sm btn-dark" onclick="showDetail('${r.stock}')" title="Detalhar">
                        <i class="fa-solid fa-list"></i>
                    </button>
                </td>
            </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ─── Detalhes do Ativo ───
async function showDetail(symbol) {
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    document.getElementById('detailModalTitle').textContent = `Detalhes - ${symbol}`;
    document.getElementById('detailModalBody').innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary" role="status"></div>
            <p>Carregando detalhes...</p>
        </div>`;
    modal.show();

    const params = { ...currentParams, stocks: [symbol] };
    const result = await TradeHalleyAPI.runDetailedBacktest(symbol, params);

    if (!result) {
        document.getElementById('detailModalBody').innerHTML = '<p class="text-danger">Erro ao carregar dados</p>';
        return;
    }

    let html = `
    <div class="row mb-3">
        <div class="col-md-3"><div class="stat-card">
            <div class="stat-label">Total Trades</div>
            <div class="stat-value">${result.totalTrades}</div>
        </div></div>
        <div class="col-md-3"><div class="stat-card">
            <div class="stat-label">Resultado</div>
            <div class="stat-value ${result.percentTotal >= 0 ? 'positive' : 'negative'}">${formatPercent(result.percentTotal)}</div>
        </div></div>
        <div class="col-md-3"><div class="stat-card">
            <div class="stat-label">Max DrawDown</div>
            <div class="stat-value negative">${formatPercent(result.maxDrawdown)}</div>
        </div></div>
        <div class="col-md-3"><div class="stat-card">
            <div class="stat-label">Ganho Médio</div>
            <div class="stat-value">${formatPercent(result.averagePercentGain)}</div>
        </div></div>
    </div>`;

    if (result.operations && result.operations.length > 0) {
        html += `
        <table class="results-table">
            <thead><tr>
                <th>Data</th><th>Abertura</th><th>Máxima</th><th>Mínima</th><th>Fechamento</th><th>Percentual</th><th>Tipo</th>
            </tr></thead><tbody>`;
        
        result.operations.forEach(op => {
            const pctClass = op.percentOp > 0 ? 'positive' : op.percentOp < 0 ? 'negative' : '';
            const tipo = op.tradeType === 1 ? '🟢 Entrada' : op.tradeType === 2 ? '🔴 Saída' : '-';
            html += `<tr>
                <td>${op.dateOp}</td>
                <td>R$ ${op.open.toFixed(2)}</td>
                <td>R$ ${op.max.toFixed(2)}</td>
                <td>R$ ${op.min.toFixed(2)}</td>
                <td>R$ ${op.close.toFixed(2)}</td>
                <td class="${pctClass}">${op.trade ? formatPercent(op.percentOp) : '-'}</td>
                <td>${tipo}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }

    document.getElementById('detailModalBody').innerHTML = html;
}

// ─── Utilidades ───
function formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return '0,00%';
    return val.toFixed(2).replace('.', ',') + '%';
}

function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
    return 'R$ ' + val.toFixed(2).replace('.', ',');
}

// ─── Ordenação da Tabela ───
let sortDir = {};
function sortTable(col) {
    const table = document.getElementById('mainResultsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.rows);
    
    sortDir[col] = !sortDir[col];
    
    rows.sort((a, b) => {
        let aVal = a.cells[col].textContent.trim();
        let bVal = b.cells[col].textContent.trim();
        
        // Tentar converter para número
        let aNum = parseFloat(aVal.replace(/[%R$,\s]/g, '').replace(',', '.'));
        let bNum = parseFloat(bVal.replace(/[%R$,\s]/g, '').replace(',', '.'));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDir[col] ? aNum - bNum : bNum - aNum;
        }
        return sortDir[col] ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    
    rows.forEach(row => tbody.appendChild(row));
}

// ─── Download Excel ───
function downloadExcel() {
    if (!backtestResults || backtestResults.length === 0) {
        toastr.warning('Nenhum resultado para exportar');
        return;
    }

    const data = backtestResults.map(r => ({
        'Ação': r.stock,
        'Total Gain': r.totalGain,
        '% Gain': r.percentGain,
        'Total Loss': r.totalLoss,
        '% Loss': r.percentLoss,
        'Total Trades': r.totalTrades,
        'Resultado': r.percentTotal,
        'Max DrawDown': r.maxDrawdown,
        'Ganho Máximo': r.maxGain,
        'Ganho Médio': r.averagePercentGain,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TradeHalley');
    XLSX.writeFile(wb, 'TradeHalley_Backtest.xlsx');
    
    toastr.success('Excel exportado com sucesso!');
}
