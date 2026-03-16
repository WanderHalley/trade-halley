/**
 * Charts — Trade Halley v2.1
 * Chart.js wrappers
 */
const Charts = (() => {
    const instances = {};

    const COLORS = {
        green: '#00c896',
        red: '#e74c3c',
        blue: '#3498db',
        yellow: '#f1c40f',
        grid: 'rgba(255,255,255,.06)',
        text: '#8888aa',
    };

    function _destroy(id) {
        if (instances[id]) { instances[id].destroy(); delete instances[id]; }
    }

    function _defaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 10 }, maxTicksLimit: 12 } },
                y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 10 } } }
            }
        };
    }

    function priceLine(canvasId, labels, data, label = 'Preço') {
        _destroy(canvasId);
        const el = document.getElementById(canvasId);
        if (!el) return;
        el.style.height = '250px';
        const ctx = el.getContext('2d');
        instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label, data,
                    borderColor: COLORS.green, backgroundColor: 'rgba(0,200,150,.08)',
                    borderWidth: 2, pointRadius: 0, fill: true, tension: .3
                }]
            },
            options: _defaults()
        });
    }

    function equityCurve(canvasId, labels, data) {
        _destroy(canvasId);
        const el = document.getElementById(canvasId);
        if (!el) return;
        el.style.height = '250px';
        const ctx = el.getContext('2d');
        instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Patrimônio', data,
                    borderColor: COLORS.blue, backgroundColor: 'rgba(52,152,219,.1)',
                    borderWidth: 2, pointRadius: 0, fill: true, tension: .2
                }]
            },
            options: _defaults()
        });
    }

    function winRateDonut(canvasId, wins, losses) {
        _destroy(canvasId);
        const el = document.getElementById(canvasId);
        if (!el) return;
        el.style.height = '200px';
        const ctx = el.getContext('2d');
        instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses'],
                datasets: [{
                    data: [wins, losses],
                    backgroundColor: [COLORS.green, COLORS.red],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: COLORS.text, font: { size: 11 } } }
                },
                cutout: '65%'
            }
        });
    }

    function performanceBar(canvasId, labels, data) {
        _destroy(canvasId);
        const el = document.getElementById(canvasId);
        if (!el) return;
        el.style.height = '300px';
        const ctx = el.getContext('2d');
        const colors = data.map(v => v >= 0 ? COLORS.green : COLORS.red);
        instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Retorno %', data,
                    backgroundColor: colors, borderRadius: 4, maxBarThickness: 40
                }]
            },
            options: {
                ..._defaults(),
                indexAxis: 'y',
                scales: {
                    x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 10 } } },
                    y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10 } } }
                }
            }
        });
    }

    function destroy(id) { _destroy(id); }
    function destroyAll() { Object.keys(instances).forEach(_destroy); }

    return { priceLine, equityCurve, winRateDonut, performanceBar, destroy, destroyAll };
})();
