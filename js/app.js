/**
 * Trade Halley - App Principal
 * Controla navegação, renderização e interações
 */

const App = (() => {
  let currentPage = 'dashboard';
  let cachedStrategies = [];
  let cachedDashboard = null;

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  function init() {
    setupNavigation();
    setupMobileMenu();
    updateMarketStatus();
    setInterval(updateMarketStatus, 60000);
    navigateTo('dashboard');
  }

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');
        navigateTo(page);
      });
    });
  }

  function navigateTo(page) {
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      'b3-daily': 'Back-tests B3 Daily',
      'b3-intraday': 'Back-tests B3 Intraday',
      'bmf-intraday': 'Back-tests BMF Intraday',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

    closeMobileMenu();
    renderPage(page);
  }

  function renderPage(page) {
    const container = document.getElementById('pageContent');
    if (!container) return;

    container.innerHTML = '<div class="loading-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>';

    switch (page) {
      case 'dashboard':
        renderDashboard(container);
        break;
      case 'b3-daily':
        renderBacktestPage(container, 'b3', '1d', 'B3 Daily');
        break;
      case 'b3-intraday':
        renderBacktestPage(container, 'b3', '1h', 'B3 Intraday');
        break;
      case 'bmf-intraday':
        renderBacktestPage(container, 'bmf', '1h', 'BMF Intraday');
        break;
      default:
        renderDashboard(container);
    }
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  async function renderDashboard(container) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="stats-grid" id="dashStats">
          ${renderStatCardSkeleton(4)}
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-chart-line"></i> IBOVESPA</div>
              <div class="card-actions">
                <select class="form-select" id="ibovPeriod" style="width:auto">
                  <option value="1mo">1 Mês</option>
                  <option value="3mo">3 Meses</option>
                  <option value="6mo" selected>6 Meses</option>
                  <option value="1y">1 Ano</option>
                </select>
              </div>
            </div>
            <div class="card-body">
              <div class="chart-container" id="chartIbovContainer"><canvas id="chartIbov"></canvas></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-dollar-sign"></i> USD/BRL</div>
            </div>
            <div class="card-body">
              <div class="chart-container" id="chartDolarContainer"><canvas id="chartDolar"></canvas></div>
            </div>
          </div>
        </div>

        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-th-list"></i> Visão de Mercado</div>
            <div class="card-actions">
              <button class="btn btn-sm btn-ghost" onclick="App.refreshDashboard()">
                <i class="fas fa-sync-alt"></i> Atualizar
              </button>
            </div>
          </div>
          <div class="card-body no-padding">
            <div class="table-container">
              <table class="data-table" id="marketTable">
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th>Nome</th>
                    <th>Preço</th>
                    <th>Variação</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody id="marketTableBody">
                  <tr><td colspan="5" class="loading-inline"><div class="spinner-sm"></div><span>Carregando dados do mercado...</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-brain"></i> Estratégias Disponíveis</div>
            <span class="badge badge-green" id="stratCount">-</span>
          </div>
          <div class="card-body">
            <div class="strategy-grid" id="strategyGrid">
              <div class="loading-inline"><div class="spinner-sm"></div><span>Carregando estratégias...</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    loadDashboardData();
    loadIbovChart('6mo');
    loadDolarChart();
    loadStrategies();

    document.getElementById('ibovPeriod')?.addEventListener('change', (e) => {
      loadIbovChart(e.target.value);
    });
  }

  async function loadDashboardData() {
    try {
      const data = await API.getDashboardSummary();
      cachedDashboard = data;

      const statsEl = document.getElementById('dashStats');
      if (statsEl && data.market_overview) {
        const totalAssets = data.total_b3_assets + data.total_bmf_assets;
        const positiveAssets = data.market_overview.filter(a => a.change_pct > 0).length;

        statsEl.innerHTML = `
          ${renderStatCard('Ativos B3', data.total_b3_assets, 'fas fa-chart-bar', 'green', 'Ações mapeadas')}
          ${renderStatCard('Ativos BMF', data.total_bmf_assets, 'fas fa-exchange-alt', 'blue', 'Derivativos')}
          ${renderStatCard('Estratégias', data.total_strategies, 'fas fa-brain', 'yellow', 'Disponíveis')}
          ${renderStatCard('Total Ativos', totalAssets, 'fas fa-database', 'green', positiveAssets + ' em alta')}
        `;
      }

      const tbody = document.getElementById('marketTableBody');
      if (tbody && data.market_overview && data.market_overview.length > 0) {
        tbody.innerHTML = data.market_overview.map(asset => `
          <tr>
            <td class="ticker-cell">${asset.ticker}</td>
            <td style="color: var(--text-secondary); font-family: var(--font-main)">${asset.name || '-'}</td>
            <td>${Utils.formatCurrency(asset.price)}</td>
            <td class="${Utils.getColorClass(asset.change_pct)}">
              <span class="badge ${Utils.getBadgeClass(asset.change_pct)}">${Utils.formatPercent(asset.change_pct)}</span>
            </td>
            <td style="color: var(--text-secondary)">${Utils.formatVolume(asset.volume || 0)}</td>
          </tr>
        `).join('');
      } else if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-info-circle"></i><p>Dados de mercado indisponíveis no momento</p></div></td></tr>';
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      Utils.showToast('Erro ao carregar dados do dashboard. Verifique a API.', 'error');

      const statsEl = document.getElementById('dashStats');
      if (statsEl) {
        statsEl.innerHTML = `
          ${renderStatCard('Ativos B3', 30, 'fas fa-chart-bar', 'green', 'Ações mapeadas')}
          ${renderStatCard('Ativos BMF', 10, 'fas fa-exchange-alt', 'blue', 'Derivativos')}
          ${renderStatCard('Estratégias', 13, 'fas fa-brain', 'yellow', 'Disponíveis')}
          ${renderStatCard('Total Ativos', 40, 'fas fa-database', 'green', 'Monitorados')}
        `;
      }
    }
  }

  async function loadIbovChart(period) {
    try {
      const data = await API.getMarketData('IBOV', period, '1d');
      if (data && data.data && data.data.length > 0) {
        Charts.priceLine('chartIbov', data.data, 'IBOVESPA');
      } else {
        showChartFallback('chartIbovContainer', 'IBOVESPA indisponível');
      }
    } catch (e) {
      console.warn('Gráfico IBOV indisponível, tentando BOVA11...');
      try {
        const data = await API.getMarketData('BOVA11', period, '1d');
        if (data && data.data && data.data.length > 0) {
          Charts.priceLine('chartIbov', data.data, 'BOVA11 (ETF IBOV)');
        } else {
          showChartFallback('chartIbovContainer', 'IBOVESPA indisponível');
        }
      } catch (e2) {
        console.warn('Gráfico IBOV fallback também falhou, tentando PETR4...');
        try {
          const data = await API.getMarketData('PETR4', period, '1d');
          if (data && data.data && data.data.length > 0) {
            Charts.priceLine('chartIbov', data.data, 'PETR4 (referência)');
          } else {
            showChartFallback('chartIbovContainer', 'Gráfico indisponível');
          }
        } catch (e3) {
          showChartFallback('chartIbovContainer', 'Gráfico indisponível');
        }
      }
    }
  }

  async function loadDolarChart() {
    try {
      const data = await API.getMarketData('DOLAR', '6mo', '1d');
      if (data && data.data && data.data.length > 0) {
        Charts.priceLine('chartDolar', data.data, 'USD/BRL');
      } else {
        showChartFallback('chartDolarContainer', 'USD/BRL indisponível');
      }
    } catch (e) {
      console.warn('Gráfico Dólar indisponível, tentando VALE3...');
      try {
        const data = await API.getMarketData('VALE3', '6mo', '1d');
        if (data && data.data && data.data.length > 0) {
          Charts.priceLine('chartDolar', data.data, 'VALE3 (referência)');
        } else {
          showChartFallback('chartDolarContainer', 'Gráfico indisponível');
        }
      } catch (e2) {
        showChartFallback('chartDolarContainer', 'Gráfico indisponível');
      }
    }
  }

  function showChartFallback(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="height:100%;display:flex;align-items:center;justify-content:center">
          <div style="text-align:center">
            <i class="fas fa-chart-line" style="font-size:36px;opacity:0.2;margin-bottom:12px;display:block"></i>
            <p style="font-size:13px;color:var(--text-muted)">${message}</p>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px">Tente atualizar em alguns minutos</p>
          </div>
        </div>
      `;
    }
  }

  async function loadStrategies() {
    try {
      const data = await API.getStrategies();
      cachedStrategies = data.strategies || [];

      const countEl = document.getElementById('stratCount');
      if (countEl) countEl.textContent = cachedStrategies.length;

      const grid = document.getElementById('strategyGrid');
      if (grid) {
        grid.innerHTML = cachedStrategies.map(s => `
          <div class="strategy-card" onclick="App.navigateTo('b3-daily')">
            <div class="strategy-name">${s.name}</div>
            <div class="strategy-category">
              <span class="badge badge-blue">${s.category}</span>
            </div>
            <div class="strategy-desc">${s.description}</div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error('Erro ao carregar estratégias:', e);
      const grid = document.getElementById('strategyGrid');
      if (grid) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar estratégias</p></div>';
      }
    }
  }

  // ============================================================
  // BACKTEST PAGE
  // ============================================================
  async function renderBacktestPage(container, market, interval, pageLabel) {
    if (cachedStrategies.length === 0) {
      try {
        const data = await API.getStrategies();
        cachedStrategies = data.strategies || [];
      } catch (e) { console.error(e); }
    }

    const stratOptions = cachedStrategies.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const periodOptions = interval === '1d'
      ? `<option value="3mo">3 Meses</option><option value="6mo">6 Meses</option><option value="1y" selected>1 Ano</option><option value="2y">2 Anos</option>`
      : `<option value="3mo" selected>3 Meses</option><option value="6mo">6 Meses</option><option value="1y">1 Ano</option>`;

    container.innerHTML = `
      <div class="fade-in">

        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-sliders-h"></i> Configurações do Back-test</div>
          </div>
          <div class="card-body">
            <div class="filter-bar" style="margin-bottom:var(--space-md)">
              <div class="form-group">
                <label class="form-label">Estratégia</label>
                <select class="form-select" id="btStrategy" style="min-width:220px">
                  ${stratOptions}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Período</label>
                <select class="form-select" id="btPeriod" style="min-width:140px">
                  ${periodOptions}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Capital Inicial</label>
                <select class="form-select" id="btCapital" style="min-width:150px">
                  <option value="5000">R$ 5.000</option>
                  <option value="10000" selected>R$ 10.000</option>
                  <option value="25000">R$ 25.000</option>
                  <option value="50000">R$ 50.000</option>
                  <option value="100000">R$ 100.000</option>
                </select>
              </div>
            </div>

            <div class="tab-nav" id="btModeTabs">
              <button class="tab-btn active" data-tab="bulk" onclick="App._switchBtTab('bulk')">
                <i class="fas fa-layer-group"></i> Todos os Ativos
              </button>
              <button class="tab-btn" data-tab="single" onclick="App._switchBtTab('single')">
                <i class="fas fa-crosshairs"></i> Ativo Individual
              </button>
              <button class="tab-btn" data-tab="compare" onclick="App._switchBtTab('compare')">
                <i class="fas fa-columns"></i> Comparar Estratégias
              </button>
            </div>

            <div class="bt-tab-content" id="btTabBulk" style="padding-top:var(--space-md)">
              <button class="btn btn-primary btn-lg" id="btnRunBulk" onclick="App.runBulkBacktest('${market}', '${interval}')">
                <i class="fas fa-play"></i> Executar em Todos os Ativos
              </button>
            </div>

            <div class="bt-tab-content" id="btTabSingle" style="display:none;padding-top:var(--space-md)">
              <div class="filter-bar">
                <div class="form-group">
                  <label class="form-label">Ticker</label>
                  <input type="text" class="form-input" id="btSingleTicker" placeholder="Ex: PETR4" style="min-width:140px;text-transform:uppercase">
                </div>
                <div class="form-group">
                  <label class="form-label">&nbsp;</label>
                  <button class="btn btn-primary" onclick="App.runSingleBacktest('${market}', '${interval}')">
                    <i class="fas fa-search"></i> Analisar Ativo
                  </button>
                </div>
              </div>
            </div>

            <div class="bt-tab-content" id="btTabCompare" style="display:none;padding-top:var(--space-md)">
              <div class="filter-bar">
                <div class="form-group">
                  <label class="form-label">Ticker para Comparação</label>
                  <input type="text" class="form-input" id="btCompareTicker" placeholder="Ex: VALE3" style="min-width:140px;text-transform:uppercase">
                </div>
                <div class="form-group">
                  <label class="form-label">&nbsp;</label>
                  <button class="btn btn-primary" onclick="App.compareStrategies()">
                    <i class="fas fa-balance-scale"></i> Comparar Estratégias
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-grid" id="btStats">
          ${renderStatCardSkeleton(4)}
        </div>

        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-chart-bar"></i> Ranking de Performance</div>
            <div class="card-actions">
              <span class="badge badge-green" id="btResultCount">-</span>
              <button class="btn btn-sm btn-ghost" onclick="App.exportTableCSV('btResultTable', 'backtest_${market}')">
                <i class="fas fa-download"></i> CSV
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height:400px"><canvas id="chartPerformance"></canvas></div>
          </div>
        </div>

        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-table"></i> Resultados Detalhados</div>
            <div class="card-actions">
              <input type="text" class="form-input" placeholder="Filtrar ativo..." id="btFilterInput" style="width:160px">
            </div>
          </div>
          <div class="card-body no-padding">
            <div class="table-container" style="max-height:500px;overflow-y:auto">
              <table class="data-table" id="btResultTable">
                <thead>
                  <tr>
                    <th data-sort="ticker">Ativo</th>
                    <th data-sort="total_return_pct">Retorno %</th>
                    <th data-sort="win_rate">Win Rate</th>
                    <th data-sort="total_trades">Trades</th>
                    <th data-sort="profit_factor">Profit Factor</th>
                    <th data-sort="max_drawdown_pct">Max DD %</th>
                    <th data-sort="sharpe_ratio">Sharpe</th>
                    <th data-sort="buy_hold_return_pct">Buy&Hold %</th>
                    <th data-sort="best_trade">Melhor Op.</th>
                    <th data-sort="worst_trade">Pior Op.</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody id="btResultBody">
                  <tr><td colspan="11"><div class="empty-state"><i class="fas fa-rocket"></i><p>Selecione uma estratégia e clique em "Executar" para iniciar</p></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div id="btDetailSection" style="display:none">
          <div class="grid-2 section-gap">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-chart-area"></i> Curva de Equity — <span id="detailTicker" style="color:var(--green-primary)">-</span></div>
              </div>
              <div class="card-body">
                <div class="chart-container"><canvas id="chartEquity"></canvas></div>
              </div>
            </div>
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-bullseye"></i> Win Rate</div>
              </div>
              <div class="card-body">
                <div class="chart-container" style="height:260px"><canvas id="chartWinRate"></canvas></div>
              </div>
            </div>
          </div>

          <div class="grid-2 section-gap">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-list-ol"></i> Métricas Completas</div>
              </div>
              <div class="card-body" id="detailMetrics" style="max-height:450px;overflow-y:auto"></div>
            </div>
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-history"></i> Histórico de Operações</div>
              </div>
              <div class="card-body no-padding">
                <div class="trade-list" id="detailTrades" style="max-height:450px;overflow-y:auto"></div>
              </div>
            </div>
          </div>

          <div class="card section-gap">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-dot-circle"></i> Distribuição de P&L por Trade</div>
            </div>
            <div class="card-body">
              <div class="chart-container"><canvas id="chartTrades"></canvas></div>
            </div>
          </div>
        </div>

        <div id="btCompareSection" style="display:none">
          <div class="card section-gap">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-balance-scale"></i> Comparação de Estratégias</div>
            </div>
            <div class="card-body">
              <div class="chart-container" style="height:380px"><canvas id="chartCompare"></canvas></div>
            </div>
          </div>
          <div class="card section-gap">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-sort-amount-down"></i> Ranking de Estratégias</div>
            </div>
            <div class="card-body no-padding">
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Estratégia</th>
                      <th>Retorno %</th>
                      <th>Win Rate</th>
                      <th>Profit Factor</th>
                      <th>Max DD %</th>
                      <th>Sharpe</th>
                      <th>Trades</th>
                    </tr>
                  </thead>
                  <tbody id="compareTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    setupTableFilter('btFilterInput', 'btResultBody');
    setupTableSort('btResultTable');
  }

  // ============================================================
  // BULK BACKTEST
  // ============================================================
  async function runBulkBacktest(market, interval) {
    const strategy = document.getElementById('btStrategy')?.value;
    const period = document.getElementById('btPeriod')?.value;
    const capital = document.getElementById('btCapital')?.value;
    const btn = document.getElementById('btnRunBulk');

    if (!strategy) {
      Utils.showToast('Selecione uma estratégia', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner-sm"></div> Processando...';
    }

    Utils.showLoading(true);

    try {
      const data = await API.runBulkBacktest(market, strategy, {
        period,
        interval,
        capital: parseFloat(capital),
      });

      Utils.showLoading(false);
      Utils.showToast(`Back-test concluído! ${data.total_assets} ativos em ${data.execution_time}s`, 'success');
      renderBulkResults(data);
    } catch (error) {
      Utils.showLoading(false);
      Utils.showToast(`Erro: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Executar em Todos os Ativos';
      }
    }
  }

  function renderBulkResults(data) {
    const results = data.results || [];

    const statsEl = document.getElementById('btStats');
    if (statsEl && results.length > 0) {
      const avgReturn = results.reduce((s, r) => s + r.total_return_pct, 0) / results.length;
      const avgWinRate = results.reduce((s, r) => s + r.win_rate, 0) / results.length;
      const profitable = results.filter(r => r.total_return_pct > 0).length;
      const totalTrades = results.reduce((s, r) => s + r.total_trades, 0);

      statsEl.innerHTML = `
        ${renderStatCard('Retorno Médio', Utils.formatPercent(avgReturn), 'fas fa-percentage', avgReturn >= 0 ? 'green' : 'red', results.length + ' ativos')}
        ${renderStatCard('Win Rate Médio', avgWinRate.toFixed(1) + '%', 'fas fa-bullseye', 'blue', 'Média geral')}
        ${renderStatCard('Ativos Lucrativos', profitable + '/' + results.length, 'fas fa-trophy', 'green', ((profitable / results.length) * 100).toFixed(0) + '% positivos')}
        ${renderStatCard('Total de Trades', totalTrades, 'fas fa-retweet', 'yellow', data.execution_time + 's execução')}
      `;
    }

    const countEl = document.getElementById('btResultCount');
    if (countEl) countEl.textContent = results.length + ' ativos';
    Charts.performanceBar('chartPerformance', results);

    const tbody = document.getElementById('btResultBody');
    if (tbody) {
      tbody.innerHTML = results.map(r => `
        <tr>
          <td class="ticker-cell">${r.ticker}</td>
          <td class="${Utils.getColorClass(r.total_return_pct)}"><strong>${Utils.formatPercent(r.total_return_pct)}</strong></td>
          <td><span class="badge ${r.win_rate >= 50 ? 'badge-green' : 'badge-red'}">${r.win_rate.toFixed(1)}%</span></td>
          <td>${r.total_trades}</td>
          <td class="${r.profit_factor >= 1 ? 'positive' : 'negative'}">${r.profit_factor.toFixed(2)}</td>
          <td class="negative">-${r.max_drawdown_pct.toFixed(2)}%</td>
          <td class="${r.sharpe_ratio >= 0 ? 'positive' : 'negative'}">${r.sharpe_ratio.toFixed(2)}</td>
          <td class="${Utils.getColorClass(r.buy_hold_return_pct)}">${Utils.formatPercent(r.buy_hold_return_pct)}</td>
          <td class="positive">${Utils.formatCurrency(r.best_trade)}</td>
          <td class="negative">${Utils.formatCurrency(r.worst_trade)}</td>
          <td><button class="btn btn-sm btn-ghost" onclick="App.viewDetail('${r.ticker}')"><i class="fas fa-eye"></i></button></td>
        </tr>
      `).join('');
    }
  }

  // ============================================================
  // VIEW DETAIL
  // ============================================================
  async function viewDetail(ticker) {
    const strategy = document.getElementById('btStrategy')?.value;
    const period = document.getElementById('btPeriod')?.value;
    const capital = document.getElementById('btCapital')?.value;
    const interval = currentPage === 'b3-daily' ? '1d' : '1h';

    Utils.showLoading(true);

    try {
      const data = await API.runBacktest(ticker, strategy, {
        period,
        interval,
        capital: parseFloat(capital),
      });

      Utils.showLoading(false);

      const section = document.getElementById('btDetailSection');
      if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const tickerEl = document.getElementById('detailTicker');
      if (tickerEl) tickerEl.textContent = ticker;

      if (data.equity_curve) {
        Charts.equityCurve('chartEquity', data.equity_curve, data.config.initial_capital);
      }

      Charts.winRateDonut('chartWinRate', data.metrics.winning_trades, data.metrics.losing_trades);

      if (data.trades) {
        Charts.tradesScatter('chartTrades', data.trades);
      }

      const metricsEl = document.getElementById('detailMetrics');
      if (metricsEl) {
        metricsEl.innerHTML = buildMetricsHTML(data.metrics);
      }

      const tradesEl = document.getElementById('detailTrades');
      if (tradesEl && data.trades) {
        tradesEl.innerHTML = buildTradesHTML(data.trades);
      }

    } catch (error) {
      Utils.showLoading(false);
      Utils.showToast(`Erro ao carregar detalhe: ${error.message}`, 'error');
    }
  }

  // ============================================================
  // SINGLE BACKTEST
  // ============================================================
  async function runSingleBacktest(market, interval) {
    const strategy = document.getElementById('btStrategy')?.value;
    const period = document.getElementById('btPeriod')?.value;
    const capital = document.getElementById('btCapital')?.value;
    const ticker = document.getElementById('btSingleTicker')?.value?.toUpperCase();

    if (!strategy) {
      Utils.showToast('Selecione uma estratégia', 'warning');
      return;
    }
    if (!ticker) {
      Utils.showToast('Digite um ticker válido', 'warning');
      return;
    }

    Utils.showLoading(true);

    try {
      const data = await API.runBacktest(ticker, strategy, {
        period,
        interval,
        capital: parseFloat(capital),
      });

      Utils.showLoading(false);
      Utils.showToast(`Back-test de ${ticker} concluído!`, 'success');

      const section = document.getElementById('btDetailSection');
      if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const tickerEl = document.getElementById('detailTicker');
      if (tickerEl) tickerEl.textContent = ticker;

      if (data.equity_curve) {
        Charts.equityCurve('chartEquity', data.equity_curve, data.config.initial_capital);
      }

      Charts.winRateDonut('chartWinRate', data.metrics.winning_trades, data.metrics.losing_trades);

      if (data.trades) {
        Charts.tradesScatter('chartTrades', data.trades);
      }

      const metricsEl = document.getElementById('detailMetrics');
      if (metricsEl) {
        metricsEl.innerHTML = buildMetricsHTML(data.metrics);
      }

      const tradesEl = document.getElementById('detailTrades');
      if (tradesEl && data.trades) {
        tradesEl.innerHTML = buildTradesHTML(data.trades);
      }
    } catch (error) {
      Utils.showLoading(false);
      Utils.showToast(`Erro: ${error.message}`, 'error');
    }
  }

  // ============================================================
  // COMPARE STRATEGIES
  // ============================================================
  async function compareStrategies() {
    const ticker = document.getElementById('btCompareTicker')?.value?.toUpperCase();
    if (!ticker) {
      Utils.showToast('Digite um ticker para comparar', 'warning');
      return;
    }

    const period = document.getElementById('btPeriod')?.value || '1y';
    const capital = document.getElementById('btCapital')?.value || 10000;
    const interval = currentPage === 'b3-daily' ? '1d' : '1h';

    Utils.showLoading(true);

    const results = [];
    const strategiesToTest = cachedStrategies.slice(0, 8);

    for (const strat of strategiesToTest) {
      try {
        const data = await API.runBacktest(ticker, strat.id, {
          period, interval, capital: parseFloat(capital),
        });
        if (data && data.metrics) {
          results.push({
            strategy: strat.name,
            strategyId: strat.id,
            return_pct: data.metrics.total_return_pct,
            win_rate: data.metrics.win_rate,
            profit_factor: data.metrics.profit_factor,
            max_dd: data.metrics.max_drawdown_pct,
            sharpe: data.metrics.sharpe_ratio,
            trades: data.metrics.total_trades,
            equity_curve: data.equity_curve,
          });
        }
      } catch (e) {
        console.warn(`Erro ${strat.id} para ${ticker}:`, e.message);
      }
    }

    Utils.showLoading(false);

    if (results.length === 0) {
      Utils.showToast('Nenhum resultado para comparar', 'warning');
      return;
    }

    Utils.showToast(`Comparação: ${results.length} estratégias em ${ticker}`, 'success');

    const section = document.getElementById('btCompareSection');
    if (section) {
      section.style.display = 'block';
      section.scrollIntoView({ behavior: 'smooth' });
    }

    const tbody = document.getElementById('compareTableBody');
    if (tbody) {
      const sorted = [...results].sort((a, b) => b.return_pct - a.return_pct);
      tbody.innerHTML = sorted.map((r, i) => `
        <tr>
          <td style="color:var(--yellow-primary);font-weight:700">#${i + 1}</td>
          <td style="font-family:var(--font-main);font-weight:600">${r.strategy}</td>
          <td class="${Utils.getColorClass(r.return_pct)}"><strong>${Utils.formatPercent(r.return_pct)}</strong></td>
          <td><span class="badge ${r.win_rate >= 50 ? 'badge-green' : 'badge-red'}">${r.win_rate.toFixed(1)}%</span></td>
          <td class="${r.profit_factor >= 1 ? 'positive' : 'negative'}">${r.profit_factor.toFixed(2)}</td>
          <td class="negative">-${r.max_dd.toFixed(2)}%</td>
          <td class="${r.sharpe >= 0 ? 'positive' : 'negative'}">${r.sharpe.toFixed(2)}</td>
          <td>${r.trades}</td>
        </tr>
      `).join('');
    }

    const datasets = results
      .filter(r => r.equity_curve && r.equity_curve.length > 0)
      .slice(0, 5)
      .map(r => ({
        label: r.strategy,
        data: r.equity_curve.map(d => d.equity),
        labels: r.equity_curve.map(d => {
          const dt = new Date(d.date);
          return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }),
      }));

    if (datasets.length > 0) {
      Charts.multiLine('chartCompare', datasets);
    }
  }

  // ============================================================
  // HELPERS - BUILD HTML
  // ============================================================
  function buildMetricsHTML(m) {
    const rows = [
      ['Retorno Total', Utils.formatPercent(m.total_return_pct), Utils.getColorClass(m.total_return_pct)],
      ['Equity Final', Utils.formatCurrency(m.final_equity), ''],
      ['Total de Trades', m.total_trades, ''],
      ['Trades Vencedores', m.winning_trades, 'positive'],
      ['Trades Perdedores', m.losing_trades, 'negative'],
      ['Win Rate', m.win_rate + '%', m.win_rate >= 50 ? 'positive' : 'negative'],
      ['Lucro Médio', Utils.formatCurrency(m.avg_profit), 'positive'],
      ['Prejuízo Médio', Utils.formatCurrency(m.avg_loss), 'negative'],
      ['Profit Factor', m.profit_factor, m.profit_factor >= 1 ? 'positive' : 'negative'],
      ['Max Drawdown', '-' + m.max_drawdown_pct + '%', 'negative'],
      ['Sharpe Ratio', m.sharpe_ratio, m.sharpe_ratio >= 0 ? 'positive' : 'negative'],
      ['Sortino Ratio', m.sortino_ratio, m.sortino_ratio >= 0 ? 'positive' : 'negative'],
      ['Expectancy', Utils.formatCurrency(m.expectancy), Utils.getColorClass(m.expectancy)],
      ['Melhor Trade', Utils.formatCurrency(m.best_trade), 'positive'],
      ['Pior Trade', Utils.formatCurrency(m.worst_trade), 'negative'],
      ['P&L Médio/Trade', Utils.formatCurrency(m.avg_trade_pnl), Utils.getColorClass(m.avg_trade_pnl)],
      ['Vitórias Consecutivas', m.max_consecutive_wins, 'positive'],
      ['Derrotas Consecutivas', m.max_consecutive_losses, 'negative'],
      ['Buy & Hold', Utils.formatPercent(m.buy_hold_return_pct), Utils.getColorClass(m.buy_hold_return_pct)],
    ];

    return rows.map(([label, value, cls]) =>
      `<div class="metric-row">
        <span class="metric-label">${label}</span>
        <span class="metric-value ${cls}">${value}</span>
      </div>`
    ).join('');
  }

  function buildTradesHTML(trades) {
    return trades.slice().reverse().map(t => `
      <div class="trade-row">
        <div class="trade-info">
          <span class="trade-type ${t.type.toLowerCase()}">${t.type}</span>
          <span style="color:var(--text-muted);font-size:11px">${Utils.formatDate(t.entry_date)} → ${Utils.formatDate(t.exit_date)}</span>
          <span class="badge ${t.exit_reason === 'STOP_LOSS' ? 'badge-red' : t.exit_reason === 'TAKE_PROFIT' ? 'badge-green' : 'badge-blue'}" style="font-size:9px">${t.exit_reason}</span>
        </div>
        <div>
          <span style="color:var(--text-muted);margin-right:8px;font-size:11px">R$${t.entry_price} → R$${t.exit_price}</span>
          <strong class="${Utils.getColorClass(t.pnl)}" style="font-family:var(--font-mono)">${Utils.formatCurrency(t.pnl)}</strong>
          <span class="badge ${Utils.getBadgeClass(t.pnl_pct)}" style="margin-left:6px">${Utils.formatPercent(t.pnl_pct)}</span>
        </div>
      </div>
    `).join('');
  }

  // ============================================================
  // EXPORT CSV
  // ============================================================
  function exportTableCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    let csv = '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowData = [];
      cells.forEach(cell => {
        let text = cell.textContent.trim().replace(/"/g, '""');
        rowData.push('"' + text + '"');
      });
      csv += rowData.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);

    Utils.showToast('Arquivo ' + link.download + ' exportado!', 'success');
  }

  // ============================================================
  // HELPERS - GENERAL
  // ============================================================
  function renderStatCard(label, value, icon, color, subtitle) {
    return `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">${label}</span>
          <div class="stat-icon ${color}"><i class="${icon}"></i></div>
        </div>
        <div class="stat-value">${value}</div>
        <div class="stat-change neutral">${subtitle || ''}</div>
      </div>
    `;
  }

  function renderStatCardSkeleton(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<div class="stat-card" style="min-height:120px"><div class="loading-inline"><div class="spinner-sm"></div></div></div>';
    }
    return html;
  }

  function setupTableFilter(inputId, tbodyId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', Utils.debounce((e) => {
      const filter = e.target.value.toUpperCase();
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.querySelectorAll('tr').forEach(row => {
        const ticker = row.querySelector('.ticker-cell');
        if (ticker) {
          row.style.display = ticker.textContent.toUpperCase().includes(filter) ? '' : 'none';
        }
      });
    }, 200));
  }

  function setupTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        const isDesc = th.classList.contains('sorted-desc');
        table.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(isDesc ? 'sorted-asc' : 'sorted-desc');
        sortTableByColumn(tableId, key, isDesc ? 'asc' : 'desc');
      });
    });
  }

  function sortTableByColumn(tableId, key, direction) {
    const tbody = document.querySelector('#' + tableId + ' tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const headers = Array.from(document.querySelectorAll('#' + tableId + ' th'));
    const colIndex = headers.findIndex(th => th.getAttribute('data-sort') === key);
    if (colIndex === -1) return;

    rows.sort((a, b) => {
      const aText = a.cells[colIndex]?.textContent.replace(/[^0-9.\-]/g, '') || '0';
      const bText = b.cells[colIndex]?.textContent.replace(/[^0-9.\-]/g, '') || '0';
      const aVal = parseFloat(aText) || 0;
      const bVal = parseFloat(bText) || 0;
      return direction === 'desc' ? bVal - aVal : aVal - bVal;
    });

    rows.forEach(row => tbody.appendChild(row));
  }

  // ============================================================
  // TAB SWITCH
  // ============================================================
  function _switchBtTab(tab) {
    document.querySelectorAll('.bt-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#btModeTabs .tab-btn').forEach(el => el.classList.remove('active'));

    const tabEl = document.getElementById('btTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    const btnEl = document.querySelector('#btModeTabs .tab-btn[data-tab="' + tab + '"]');

    if (tabEl) tabEl.style.display = 'block';
    if (btnEl) btnEl.classList.add('active');
  }

  // ============================================================
  // MOBILE
  // ============================================================
  function setupMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('sidebarOverlay');
    if (toggle) toggle.addEventListener('click', toggleMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);
  }

  function toggleMobileMenu() {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('active');
  }

  function closeMobileMenu() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }

  function updateMarketStatus() {
    const dot = document.getElementById('marketStatusDot');
    const text = document.getElementById('marketStatusText');
    const open = Utils.isMarketOpen();
    if (dot) dot.className = open ? 'status-dot' : 'status-dot closed';
    if (text) text.textContent = open ? 'Mercado Aberto' : 'Mercado Fechado';
  }

  function refreshDashboard() {
    loadDashboardData();
    loadIbovChart(document.getElementById('ibovPeriod')?.value || '6mo');
    loadDolarChart();
    Utils.showToast('Dashboard atualizado!', 'success');
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    init,
    navigateTo,
    runBulkBacktest,
    runSingleBacktest,
    viewDetail,
    refreshDashboard,
    exportTableCSV,
    compareStrategies,
    _switchBtTab,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
