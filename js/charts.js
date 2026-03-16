/**
 * Trade Halley - Charts v3.0
 * Nomes: Charts.equityCurve, Charts.priceLine, Charts.winRateDonut, etc.
 */
const Charts = (() => {
    const C = {
        green: '#00e676', greenBg: 'rgba(0,230,118,0.1)',
        red: '#ff1744', redBg: 'rgba(255,23,68,0.1)',
        blue: '#2979ff', blueBg: 'rgba(41,121,255,0.1)',
        yellow: '#ffc107',
        grid: 'rgba(28,42,58,0.5)', text: '#8899aa', white: '#e8edf4',
    };

    const BASE = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: C.text, font: { family: "'Inter',sans-serif", size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 } },
            tooltip: { backgroundColor: '#111a27', titleColor: C.white, bodyColor: C.text, borderColor: '#1c2a3a', borderWidth: 1, padding: 12, cornerRadius: 8 },
        },
        scales: {
            x: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text, font: { size: 10 }, maxRotation: 0 } },
            y: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text, font: { family: "'JetBrains Mono',monospace", size: 10 } } },
        },
    };

    let active = {};

    function destroy(id) { if (active[id]) { active[id].destroy(); delete active[id]; } }

    function ctx(el) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) return null;
        const id = el.id || Math.random().toString(36).slice(2);
        if (!el.id) el.id = id;
        destroy(id);
        return { c: el.getContext('2d'), id, el };
    }

    function equityCurve(canvas, data, initialCapital = 10000) {
        const r = ctx(canvas);
        if (!r) return;
        const labels = data.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); });
        const values = data.map(d => d.equity);
        const grad = r.c.createLinearGradient(0, 0, 0, 320);
        grad.addColorStop(0, 'rgba(0,230,118,0.25)');
        grad.addColorStop(1, 'rgba(0,230,118,0)');

        active[r.id] = new Chart(r.c, {
            type: 'line',
            data: { labels, datasets: [
                { label: 'Equity', data: values, borderColor: C.green, backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5 },
                { label: 'Capital Inicial', data: new Array(values.length).fill(initialCapital), borderColor: C.text, borderWidth: 1, borderDash: [5,5], fill: false, pointRadius: 0 },
            ]},
            options: { ...BASE, plugins: { ...BASE.plugins, legend: { ...BASE.plugins.legend, position: 'top' },
                tooltip: { ...BASE.plugins.tooltip, callbacks: { label: (t) => ` ${t.dataset.label}: R$ ${t.parsed.y.toLocaleString('pt-BR',{minimumFractionDigits:2})}` } } },
                scales: { ...BASE.scales, y: { ...BASE.scales.y, ticks: { ...BASE.scales.y.ticks, callback: v => `R$ ${v.toLocaleString('pt-BR')}` } } },
            },
        });
    }

    function winRateDonut(canvas, wins, losses) {
        const r = ctx(canvas);
        if (!r) return;
        active[r.id] = new Chart(r.c, {
            type: 'doughnut',
            data: { labels: ['Ganhos','Perdas'], datasets: [{ data: [wins, losses], backgroundColor: [C.green, C.red], borderWidth: 0, cutout: '75%', spacing: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: {
                legend: { position: 'bottom', labels: { color: C.text, font: { size: 11 }, padding: 16, usePointStyle: true } },
                tooltip: { ...BASE.plugins.tooltip, callbacks: { label: (t) => ` ${t.label}: ${t.parsed} trades` } },
            }},
        });
    }

    function priceLine(canvas, data, ticker) {
        const r = ctx(canvas);
        if (!r) return;
        const labels = data.map(d => new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        const prices = data.map(d => d.close);
        const grad = r.c.createLinearGradient(0, 0, 0, 320);
        grad.addColorStop(0, 'rgba(41,121,255,0.2)');
        grad.addColorStop(1, 'rgba(41,121,255,0)');

        active[r.id] = new Chart(r.c, {
            type: 'line',
            data: { labels, datasets: [{ label: ticker, data: prices, borderColor: C.blue, backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.2, pointRadius: 0, pointHoverRadius: 4 }] },
            options: { ...BASE, plugins: { ...BASE.plugins, legend: { display: false },
                tooltip: { ...BASE.plugins.tooltip, callbacks: { label: (t) => ` ${ticker}: R$ ${t.parsed.y.toFixed(2)}` } } },
                scales: { ...BASE.scales, y: { ...BASE.scales.y, ticks: { ...BASE.scales.y.ticks, callback: v => `R$ ${v.toFixed(2)}` } } },
            },
        });
    }

    function performanceBar(canvas, data) {
        const r = ctx(canvas);
        if (!r) return;
        const labels = data.map(d => d.ticker);
        const values = data.map(d => d.total_return_pct);
        const colors = values.map(v => v >= 0 ? C.green : C.red);
        active[r.id] = new Chart(r.c, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Retorno %', data: values, backgroundColor: colors, borderColor: colors, borderWidth: 1, borderRadius: 4, maxBarThickness: 40 }] },
            options: { ...BASE, indexAxis: data.length > 15 ? 'y' : 'x', plugins: { ...BASE.plugins, legend: { display: false } } },
        });
    }

    function destroyAll() { Object.keys(active).forEach(destroy); }

    return { equityCurve, winRateDonut, priceLine, performanceBar, destroy, destroyAll };
})();
