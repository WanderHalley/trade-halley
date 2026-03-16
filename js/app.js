async function renderDashboardPage() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card" id="cardIBOV">
                <div class="stat-label"><i class="fas fa-chart-line"></i> IBOVESPA</div>
                <div class="stat-value" id="valIBOV">--</div>
                <div class="stat-change" id="chgIBOV">--</div>
            </div>
            <div class="stat-card" id="cardDOLAR">
                <div class="stat-label"><i class="fas fa-dollar-sign"></i> Dólar (USD/BRL)</div>
                <div class="stat-value" id="valDOLAR">--</div>
                <div class="stat-change" id="chgDOLAR">--</div>
            </div>
            <div class="stat-card" id="cardBOVA11">
                <div class="stat-label"><i class="fas fa-layer-group"></i> BOVA11</div>
                <div class="stat-value" id="valBOVA11">--</div>
                <div class="stat-change" id="chgBOVA11">--</div>
            </div>
            <div class="stat-card" id="cardSTORAGE">
                <div class="stat-label"><i class="fas fa-database"></i> Ativos Cadastrados</div>
                <div class="stat-value" id="valSTORAGE">--</div>
                <div class="stat-change" id="chgSTORAGE">Supabase</div>
            </div>
        </div>

        <div class="charts-section">
            <div class="chart-container">
                <h3><i class="fas fa-chart-area"></i> IBOVESPA (BOVA11) — 3 meses</h3>
                <canvas id="chartIBOV"></canvas>
                <p class="chart-note" id="chartIBOVNote"></p>
            </div>
            <div class="chart-container">
                <h3><i class="fas fa-chart-area"></i> Dólar (USD/BRL) — 3 meses</h3>
                <canvas id="chartDOLAR"></canvas>
                <p class="chart-note" id="chartDOLARNote"></p>
            </div>
        </div>

        <div class="market-table-section">
            <h3><i class="fas fa-table"></i> Mercado — Cotações em Tempo Real</h3>
            <div class="table-responsive">
                <table class="data-table" id="marketTable">
                    <thead>
                        <tr>
                            <th>Ativo</th><th>Nome</th><th>Preço</th>
                            <th>Variação</th><th>Volume</th>
                        </tr>
                    </thead>
                    <tbody id="marketTableBody">
                        <tr><td colspan="5" class="loading-cell">Carregando cotações...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Fetch all dashboard data
    const dashTickers = ['^BVSP', 'USDBRL=X', 'BOVA11', 'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3'];
    const marketTickers = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 'WEGE3', 'RENT3', 'BBAS3',
                           'PRIO3', 'SUZB3', 'MGLU3', 'HAPV3', 'JBSS3', 'GGBR4', 'B3SA3', 'BOVA11'];

    try {
        // Real-time quotes
        const quotes = await API.getDashboardQuotes(dashTickers);
        const qMap = {};
        quotes.forEach(q => { qMap[q.symbol] = q; });

        // IBOV card
        const ibov = qMap['^BVSP'];
        if (ibov) {
            document.getElementById('valIBOV').textContent = Utils.formatNumber(ibov.regularMarketPrice, 0);
            const chgEl = document.getElementById('chgIBOV');
            const pct = ibov.regularMarketChangePercent;
            chgEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
            chgEl.className = `stat-change ${pct >= 0 ? 'positive' : 'negative'}`;
        }

        // Dólar card
        const dol = qMap['USDBRL=X'];
        if (dol) {
            document.getElementById('valDOLAR').textContent = `R$ ${dol.regularMarketPrice.toFixed(4)}`;
            const chgEl = document.getElementById('chgDOLAR');
            const pct = dol.regularMarketChangePercent;
            chgEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
            chgEl.className = `stat-change ${pct >= 0 ? 'positive' : 'negative'}`;
        }

        // BOVA11 card
        const bova = qMap['BOVA11'];
        if (bova) {
            document.getElementById('valBOVA11').textContent = Utils.formatCurrency(bova.regularMarketPrice);
            const chgEl = document.getElementById('chgBOVA11');
            const pct = bova.regularMarketChangePercent;
            chgEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
            chgEl.className = `stat-change ${pct >= 0 ? 'positive' : 'negative'}`;
        }

        // Storage card
        try {
            const stats = await API.getStorageStats();
            document.getElementById('valSTORAGE').textContent = stats.total_assets || 0;
            document.getElementById('storageCount').textContent = stats.total_assets || 0;
        } catch (e) {
            document.getElementById('valSTORAGE').textContent = '0';
        }

    } catch (e) {
        console.error('Dashboard quote error:', e);
        Utils.showToast('Erro ao carregar cotações', 'error');
    }

    // Charts — use PETR4 as proxy for IBOV chart (BOVA11 historical empty on free plan)
    // and USDBRL=X historical is also empty, so we'll use what's available
    try {
        // Try BOVA11 historical; fallback to PETR4
        let ibovData = await API.getHistoricalData('BOVA11', '3mo', '1d');
        let ibovLabel = 'BOVA11';
        if (!ibovData || ibovData.length === 0) {
            ibovData = await API.getHistoricalData('PETR4', '3mo', '1d');
            ibovLabel = 'PETR4 (proxy)';
            document.getElementById('chartIBOVNote').textContent =
                'Nota: Dados históricos de BOVA11 indisponíveis no plano atual. Exibindo PETR4 como referência.';
        }
        if (ibovData && ibovData.length > 0) {
            const labels = ibovData.map(d => {
                const dt = new Date(d.date * 1000);
                return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });
            const prices = ibovData.map(d => d.close);
            Charts.priceLine('chartIBOV', labels, prices, ibovLabel);
        }
    } catch (e) {
        console.error('Chart IBOV error:', e);
    }

    try {
        let dolData = await API.getHistoricalData('USDBRL=X', '3mo', '1d');
        let dolLabel = 'USD/BRL';
        if (!dolData || dolData.length === 0) {
            // No historical for USDBRL=X on free plan — show message
            document.getElementById('chartDOLARNote').textContent =
                'Dados históricos de USD/BRL indisponíveis no plano atual da brapi.dev.';
        } else {
            const labels = dolData.map(d => {
                const dt = new Date(d.date * 1000);
                return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });
            const prices = dolData.map(d => d.close);
            Charts.priceLine('chartDOLAR', labels, prices, dolLabel);
        }
    } catch (e) {
        console.error('Chart DOLAR error:', e);
    }

    // Market table — fetch all market tickers
    try {
        const mktQuotes = await API.getDashboardQuotes(marketTickers);
        const tbody = document.getElementById('marketTableBody');
        if (mktQuotes && mktQuotes.length > 0) {
            tbody.innerHTML = mktQuotes.map(q => {
                const pct = q.regularMarketChangePercent || 0;
                const cls = pct >= 0 ? 'positive' : 'negative';
                const arrow = pct >= 0 ? '▲' : '▼';
                return `<tr>
                    <td><strong>${q.symbol}</strong></td>
                    <td>${q.shortName || q.longName || q.symbol}</td>
                    <td>${Utils.formatCurrency(q.regularMarketPrice)}</td>
                    <td class="${cls}">${arrow} ${pct.toFixed(2)}%</td>
                    <td>${Utils.formatVolume(q.regularMarketVolume)}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">Sem dados</td></tr>';
        }
    } catch (e) {
        console.error('Market table error:', e);
    }
}
