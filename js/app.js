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

    // Atualiza nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Atualiza título
    const titles = {
      dashboard: 'Dashboard',
      'b3-daily': 'Back-tests B3 Daily',
      'b3-intraday': 'Back-tests B3 Intraday',
      'bmf-intraday': 'Back-tests BMF Intraday',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

    // Fecha menu mobile
    closeMobileMenu();

    // Renderiza página
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
        <!-- Stats Cards -->
        <div class="stats-grid" id="dashStats">
          ${renderStatCardSkeleton(4)}
        </div>

        <!-- Charts Row -->
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
              <div class="chart-container"><canvas id="chartIbov"></canvas></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-dollar-sign"></i> USD/BRL</div>
            </div>
            <div class="card-body">
              <div class="chart-container"><canvas id="chartDolar"></canvas></div>
            </div>
          </div>
        </div>

        <!-- Market Overview -->
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
                  <tr><td colspan="5" class="loading-inline"><div class="spinner-sm"></div><span>Carregando dados...</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Strategies Grid -->
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

    // Carrega dados
    loadDashboardData();
    loadIbovChart('6mo');
    loadDolarChart();
    loadStrategies();

    // Event listener para período IBOV
    document.getElementById('ibovPeriod')?.addEventListener('change', (e) => {
      loadIbovChart(e.target.value);
    });
  }

  async function loadDashboardData() {
    try {
      const data = await API.getDashboardSummary();
      cachedDashboard = data;

      // Stats cards
      const statsEl = document.getElementById('dashStats');
      if (statsEl && data.market_overview) {
        const totalAssets = data.total_b3_assets + data.total_bmf_assets;
        const positiveAssets = data.market_overview.filter(a => a.change_pct > 0).length;
        const negativeAssets = data.market_overview.filter(a => a.change_pct < 0).length;

        statsEl.innerHTML = `
          ${renderStatCard('Ativos B3', data.total_b3_assets, 'fas fa-chart-bar', 'green', 'Ações mapeadas')}
          ${renderStatCard('Ativos BMF', data.total_bmf_assets, 'fas fa-exchange-alt', 'blue', 'Derivativos')}
          ${renderStatCard('Estratégias', data.total_strategies, 'fas fa-brain', 'yellow', 'Disponíveis')}
          ${renderStatCard('Total Ativos', totalAssets, 'fas fa-database', 'green', `${positiveAssets} em alta`)}
        `;
      }

      // Market table
      const tbody = document.getElementById('marketTableBody');
      if (tbody && data.market_overview) {
        tbody.innerHTML = data.market_overview.map(asset => `
          <tr>
            <td class="ticker-cell">${asset.ticker}</td>
            <td style="color: var(--text-secondary); font-family: var(--font-main)">${asset.name || '-'}</td>
            <td>${Utils.formatCurrency(asset.price)}</td>
            <td class="${Utils.getColorClass(asset.change_pct)}">
              <span class="badge ${Utils.getBadgeClass(asset.change_pct)}">${Utils.formatPercent(asset.change_pct)}</span>
            </td>
            <td style="color: var(--text-secondary)">${Utils.formatVolume(asset.volume)}</td>
          </tr>
        `).join('');
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      Utils.showToast('Erro ao carregar dados do dashboard. Verifique a conexão com a API.', 'error');

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
      Charts.priceLine('chartIbov', data.data, 'IBOVESPA');
    } catch (e) {
      console.error('Erro gráfico IBOV:', e);
    }
  }

  async function loadDolarChart() {
    try {
      const data = await API.getMarketData('DOLAR', '6mo', '1d');
      Charts.priceLine('chartDolar', data.data, 'USD/BRL');
    } catch (e) {
      console.error('Erro gráfico Dólar:', e);
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
    }
  }

  // ============================================================
  // BACKTEST PAGE (B3 Daily / B3 Intraday / BMF Intraday)
  // ============================================================
  async function renderBacktestPage(container, market, interval, pageLabel) {
    // Carrega estratégias se não tiver
    if (cachedStrategies.length === 0) {
      try {
        const data = await API.getStrategies();
        cachedStrategies = data.strategies || [];
      } catch (e) {
        console.error(e);
      }
    }

    const stratOptions = cachedStrategies.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const periodOptions = interval === '1d'
      ? `<option value="3mo">3 Meses</option><option value="6mo">6 Meses</option><option value="1y" selected>1 Ano</option><option value="2y">2 Anos</option>`
      : `<option value="3mo" selected>3 Meses</option><option value="6mo">6 Meses</option><option value="1y">1 Ano</option>`;

    container.innerHTML = `
      <div class="fade-in">
        <!-- Filtros -->
        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-filter"></i> Filtros do Back-test</div>
          </div>
          <div class="card-body">
            <div class="filter-bar">
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
                <select class="form-select" id="btCapital" style="min-width:140px">
                  <option value="5000">R$ 5.000</option>
                  <option value="10000" selected>R$ 10.000</option>
                  <option value="25000">R$ 25.000</option>
                  <option value="50000">R$ 50.000</option>
                  <option value="100000">R$ 100.000</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">&nbsp;</label>
                <button class="btn btn-primary" id="btnRunBulk" onclick="App.runBulkBacktest('${market}', '${interval}')">
                  <i class="fas fa-play"></i> Executar Back-test
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Resultados -->
        <div class="stats-grid" id="btStats">
          ${renderStatCardSkeleton(4)}
        </div>

        <!-- Gráfico de Performance -->
        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-chart-bar"></i> Ranking de Performance</div>
            <span class="badge badge-green" id="btResultCount">-</span>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height:400px"><canvas id="chartPerformance"></canvas></div>
          </div>
        </div>

        <!-- Tabela de Resultados -->
        <div class="card section-gap">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-table"></i> Resultados Detalhados</div>
            <div class="card-actions">
              <input type="text" class="form-input" placeholder="Filtrar ativo..." id="btFilterInput" style="width:160px">
            </div>
          </div>
          <div class="card-body no-padding">
            <div class="table-container">
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
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="btResultBody">
                  <tr><td colspan="11"><div class="empty-state"><i class="fas fa-rocket"></i><p>Selecione uma estratégia e clique em "Executar Back-test"</p></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Detalhe Individual -->
        <div id="btDetailSection" style="display:none">
          <div class="grid-2 section-gap">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-chart-area"></i> Curva de Equity — <span id="detailTicker">-</span></div>
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
                <div class="chart-container" style="height:250px"><canvas id="chartWinRate"></canvas></div>
              </div>
            </div>
          </div>

          <div class="grid-2 section-gap">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-list-ol"></i> Métricas Detalhadas</div>
              </div>
              <div class="card-body" id="detailMetrics"></div>
            </div>
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fas fa-history"></i> Últimas Operações</div>
              </div>
              <div class="card-body no-padding">
                <div class="trade-list" id="detailTrades"></div>
              </div>
            </div>
          </div>

          <div class="card section-gap">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-dot-circle"></i> Distribuição de Trades</div>
            </div>
            <div class="card-body">
              <div class="chart-container"><canvas id="chartTrades"></canvas></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Setup filtro da tabela
    setupTableFilter('btFilterInput', 'btResultBody');
    setupTableSort('btResultTable');
  }

  async function runBulkBacktest(market, interval) {
    const strategy = document.getElementById('btStrategy')?.value;
    const period = document.getElementById('btPeriod')?.value;
    const capital = document.getElementById('btCapital')?.value;
    const btn = document.getElementById('btnRunBulk');

    if (!strategy) {
      Utils.showToast('Selecione uma estratégia', 'warning');
      return;
    }

    // Loading state
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
      Utils.showToast(`Back-test concluído! ${data.total_assets} ativos analisados em ${data.execution_time}s`, 'success');

      renderBulkResults(data);
    } catch (error) {
      Utils.showLoading(false);
      Utils.showToast(`Erro: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Executar Back-test';
      }
    }
  }

  function renderBulkResults(data) {
    const results = data.results || [];

    // Stats
    const statsEl = document.getElementById('btStats');
    if (statsEl && results.length > 0) {
      const avgReturn = results.reduce((s, r) => s + r.total_return_pct, 0) / results.length;
      const avgWinRate = results.reduce((s, r) => s + r.win_rate, 0) / results.length;
      const profitable = results.filter(r => r.total_return_pct > 0).length;
      const totalTrades = results.reduce((s, r) => s + r.total_trades, 0);

      statsEl.innerHTML = `
        ${renderStatCard('Retorno Médio', Utils.formatPercent(avgReturn), 'fas fa-percentage', avgReturn >= 0 ? 'green' : 'red', `${results.length} ativos`)}
        ${renderStatCard('Win Rate Médio', `${avgWinRate.toFixed(1)}%`, 'fas fa-bullseye', 'blue', 'Média geral')}
        ${renderStatCard('Ativos Lucrativos', `${profitable}/${results.length}`, 'fas fa-trophy', 'green', `${((profitable / results.length) * 100).toFixed(0)}% positivos`)}
        ${renderStatCard('Total de Trades', totalTrades, 'fas fa-retweet', 'yellow', `${data.execution_time}s de execução`)}
      `;
    }

    // Gráfico
    const countEl = document.getElementById('btResultCount');
    if (countEl) countEl.textContent = `${results.length} ativos`;
    Charts.performanceBar('chartPerformance', results);

    // Tabela
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

      // Ticker label
      const tickerEl = document.getElementById('detailTicker');
      if (tickerEl) tickerEl.textContent = ticker;

      // Equity curve
      if (data.equity_curve) {
        Charts.equityCurve('chartEquity', data.equity_curve, data.config.initial_capital);
      }

      // Win rate donut
      Charts.winRateDonut('chartWinRate', data.metrics.winning_trades, data.metrics.losing_trades);

      // Trades scatter
      if (data.trades) {
        Charts.tradesScatter('chartTrades', data.trades);
      }

      // Metrics
      const metricsEl = document.getElementById('detailMetrics');
      if (metricsEl) {
        const m = data.metrics;
        metricsEl.innerHTML = `
          <div class="metric-row"><span class="metric-label">Retorno Total</span><span class="metric-value ${Utils.getColorClass(m.total_return_pct)}">${Utils.formatPercent(m.total_return_pct)}</span></div>
          <div class="metric-row"><span class="metric-label">Equity Final</span><span class="metric-value">${Utils.formatCurrency(m.final_equity)}</span></div>
          <div class="metric-row"><span class="metric-label">Total de Trades</span><span class="metric-value">${m.total_trades}</span></div>
          <div class="metric-row"><span class="metric-label">Win Rate</span><span class="metric-value">${m.win_rate}%</span></div>
          <div class="metric-row"><span class="metric-label">Profit Factor</span><span class="metric-value ${m.profit_factor >= 1 ? 'positive' : 'negative'}">${m.profit_factor}</span></div>
          <div class="metric-row"><span class="metric-label">Max Drawdown</span><span class="metric-value negative">-${m.max_drawdown_pct}%</span></div>
          <div class="metric-row"><span class="metric-label">Sharpe Ratio</span><span class="metric-value">${m.sharpe_ratio}</span></div>
          <div class="metric-row"><span class="metric-label">Sortino Ratio</span><span class="metric-value">${m.sortino_ratio}</span></div>
          <div class="metric-row"><span class="metric-label">Expectancy</span><span class="metric-value">${Utils.formatCurrency(m.expectancy)}</span></div>
          <div class="metric-row"><span class="metric-label">Melhor Trade</span><span class="metric-value positive">${Utils.formatCurrency(m.best_trade)}</span></div>
          <div class="metric-row"><span class="metric-label">Pior Trade</span><span class="metric-value negative">${Utils.formatCurrency(m.worst_trade)}</span></div>
          <div class="metric-row"><span class="metric-label">Vitórias Consecutivas</span><span class="metric-value">${m.max_consecutive_wins}</span></div>
          <div class="metric-row"><span class="metric-label">Derrotas Consecutivas</span><span class="metric-value">${m.max_consecutive_losses}</span></div>
          <div class="metric-row"><span class="metric-label">Buy & Hold</span><span class="metric-value ${Utils.getColorClass(m.buy_hold_return_pct)}">${Utils.formatPercent(m.buy_hold_return_pct)}</span></div>
        `;
      }

      // Trades list
      const tradesEl = document.getElementById('detailTrades');
      if (tradesEl && data.trades) {
        tradesEl.innerHTML = data.trades.slice().reverse().map(t => `
          <div class="trade-row">
            <div class="trade-info">
              <span class="trade-type ${t.type.toLowerCase()}">${t.type}</span>
              <span style="color:var(--text-secondary)">${Utils.formatDate(t.entry_date)} → ${Utils.formatDate(t.exit_date)}</span>
            </div>
            <div>
              <span style="color:var(--text-muted);margin-right:8px">R$${t.entry_price} → R$${t.exit_price}</span>
              <strong class="${Utils.getColorClass(t.pnl)}">${Utils.formatCurrency(t.pnl)}</strong>
              <span class="badge ${Utils.getBadgeClass(t.pnl_pct)}" style="margin-left:8px">${Utils.formatPercent(t.pnl_pct)}</span>
            </div>
          </div>
        `).join('');
      }

    } catch (error) {
      Utils.showLoading(false);
      Utils.showToast(`Erro ao carregar detalhe: ${error.message}`, 'error');
    }
  }

  // ============================================================
  // HELPERS
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
      html += `
        <div class="stat-card" style="min-height:120px">
          <div class="loading-inline"><div class="spinner-sm"></div></div>
        </div>
      `;
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
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
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
        const direction = isDesc ? 'asc' : 'desc';
        sortTableByColumn(tableId, key, direction);
      });
    });
  }

  function sortTableByColumn(tableId, key, direction) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const colIndex = Array.from(document.querySelectorAll(`#${tableId} th`)).findIndex(th => th.getAttribute('data-sort') === key);
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
    if (dot) {
      dot.className = open ? 'status-dot' : 'status-dot closed';
    }
    if (text) {
      text.textContent = open ? 'Mercado Aberto' : 'Mercado Fechado';
    }
  }

  function refreshDashboard() {
    loadDashboardData();
    loadIbovChart(document.getElementById('ibovPeriod')?.value || '6mo');
    loadDolarChart();
    Utils.showToast('Dashboard atualizado!', 'success');
  }

  return {
    init,
    navigateTo,
    runBulkBacktest,
    viewDetail,
    refreshDashboard,
  };
})();

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.init);
