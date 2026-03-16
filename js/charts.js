/**
 * Trade Halley - Charts
 * Gráficos usando Chart.js
 */

const Charts = (() => {
  // Cores padrão
  const COLORS = {
    green: '#00e676',
    greenBg: 'rgba(0, 230, 118, 0.1)',
    greenBorder: 'rgba(0, 230, 118, 0.6)',
    red: '#ff1744',
    redBg: 'rgba(255, 23, 68, 0.1)',
    redBorder: 'rgba(255, 23, 68, 0.6)',
    blue: '#2979ff',
    blueBg: 'rgba(41, 121, 255, 0.1)',
    yellow: '#ffc107',
    yellowBg: 'rgba(255, 193, 7, 0.1)',
    grid: 'rgba(28, 42, 58, 0.5)',
    text: '#8899aa',
    white: '#e8edf4',
  };

  // Configuração global
  const DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: COLORS.text,
          font: { family: "'Inter', sans-serif", size: 11 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#111a27',
        titleColor: COLORS.white,
        bodyColor: COLORS.text,
        borderColor: '#1c2a3a',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { family: "'Inter', sans-serif", weight: '700', size: 12 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { color: COLORS.grid, drawBorder: false },
        ticks: { color: COLORS.text, font: { size: 10 }, maxRotation: 0 },
      },
      y: {
        grid: { color: COLORS.grid, drawBorder: false },
        ticks: {
          color: COLORS.text,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
      },
    },
  };

  let activeCharts = {};

  function destroy(id) {
    if (activeCharts[id]) {
      activeCharts[id].destroy();
      delete activeCharts[id];
    }
  }

  function getCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroy(canvasId);
    return canvas.getContext('2d');
  }

  // ----- EQUITY CURVE -----
  function equityCurve(canvasId, data, initialCapital = 10000) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    const labels = data.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const values = data.map(d => d.equity);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Equity',
            data: values,
            borderColor: COLORS.green,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: COLORS.green,
          },
          {
            label: 'Capital Inicial',
            data: new Array(values.length).fill(initialCapital),
            borderColor: COLORS.text,
            borderWidth: 1,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
      },
      options: {
        ...DEFAULTS,
        plugins: {
          ...DEFAULTS.plugins,
          legend: { ...DEFAULTS.plugins.legend, position: 'top' },
          tooltip: {
            ...DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                return ` ${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          ...DEFAULTS.scales,
          y: {
            ...DEFAULTS.scales.y,
            ticks: {
              ...DEFAULTS.scales.y.ticks,
              callback: (val) => `R$ ${val.toLocaleString('pt-BR')}`,
            },
          },
        },
      },
    });
  }

  // ----- BAR CHART (Performance por Ativo) -----
  function performanceBar(canvasId, data) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    const labels = data.map(d => d.ticker);
    const values = data.map(d => d.total_return_pct);
    const colors = values.map(v => (v >= 0 ? COLORS.green : COLORS.red));
    const bgColors = values.map(v => (v >= 0 ? COLORS.greenBg : COLORS.redBg));

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Retorno %',
            data: values,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        ...DEFAULTS,
        indexAxis: data.length > 15 ? 'y' : 'x',
        plugins: {
          ...DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            ...DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` Retorno: ${ctx.parsed.y >= 0 || ctx.parsed.x >= 0 ? '+' : ''}${(ctx.parsed.y || ctx.parsed.x).toFixed(2)}%`,
            },
          },
        },
        scales: {
          ...DEFAULTS.scales,
          y: {
            ...DEFAULTS.scales.y,
            ticks: {
              ...DEFAULTS.scales.y.ticks,
              callback: (val) => typeof val === 'number' ? `${val}%` : val,
            },
          },
        },
      },
    });
  }

  // ----- DOUGHNUT (Win Rate) -----
  function winRateDonut(canvasId, wins, losses) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Ganhos', 'Perdas'],
        datasets: [
          {
            data: [wins, losses],
            backgroundColor: [COLORS.green, COLORS.red],
            borderColor: ['transparent', 'transparent'],
            borderWidth: 0,
            cutout: '75%',
            spacing: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: COLORS.text,
              font: { size: 11 },
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            ...DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} trades`,
            },
          },
        },
      },
    });
  }

  // ----- LINE CHART (Preço do Ativo) -----
  function priceLine(canvasId, data, ticker) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    const labels = data.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const prices = data.map(d => d.close);

    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(41, 121, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(41, 121, 255, 0.0)');

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: ticker,
            data: prices,
            borderColor: COLORS.blue,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: COLORS.blue,
          },
        ],
      },
      options: {
        ...DEFAULTS,
        plugins: {
          ...DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            ...DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ticker}: R$ ${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          ...DEFAULTS.scales,
          y: {
            ...DEFAULTS.scales.y,
            ticks: {
              ...DEFAULTS.scales.y.ticks,
              callback: (val) => `R$ ${val.toFixed(2)}`,
            },
          },
        },
      },
    });
  }

  // ----- MULTI LINE (Comparação) -----
  function multiLine(canvasId, datasets) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    const palette = [COLORS.green, COLORS.blue, COLORS.yellow, COLORS.red, '#ab47bc', '#26c6da'];

    const chartDatasets = datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: palette[i % palette.length],
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
    }));

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datasets[0]?.labels || [],
        datasets: chartDatasets,
      },
      options: {
        ...DEFAULTS,
        plugins: {
          ...DEFAULTS.plugins,
          legend: { ...DEFAULTS.plugins.legend, position: 'top' },
        },
      },
    });
  }

  // ----- TRADES SCATTER -----
  function tradesScatter(canvasId, trades) {
    const ctx = getCtx(canvasId);
    if (!ctx) return;

    const wins = trades.filter(t => t.pnl > 0).map((t, i) => ({ x: i, y: t.pnl_pct }));
    const losses = trades.filter(t => t.pnl <= 0).map((t, i) => ({ x: i, y: t.pnl_pct }));

    activeCharts[canvasId] = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Ganhos',
            data: wins,
            backgroundColor: COLORS.green,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          {
            label: 'Perdas',
            data: losses,
            backgroundColor: COLORS.red,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        ...DEFAULTS,
        plugins: {
          ...DEFAULTS.plugins,
          tooltip: {
            ...DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          ...DEFAULTS.scales,
          x: {
            ...DEFAULTS.scales.x,
            title: { display: true, text: 'Trade #', color: COLORS.text },
          },
          y: {
            ...DEFAULTS.scales.y,
            title: { display: true, text: 'P&L %', color: COLORS.text },
            ticks: {
              ...DEFAULTS.scales.y.ticks,
              callback: (val) => `${val}%`,
            },
          },
        },
      },
    });
  }

  function destroyAll() {
    Object.keys(activeCharts).forEach(destroy);
  }

  return {
    equityCurve,
    performanceBar,
    winRateDonut,
    priceLine,
    multiLine,
    tradesScatter,
    destroy,
    destroyAll,
  };
})();
