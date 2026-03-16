/**
 * Utils — Trade Halley v2.1
 */
const Utils = (() => {
    function formatCurrency(value) {
        if (value == null || isNaN(value)) return 'R$ --';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    function formatNumber(value, decimals = 2) {
        if (value == null || isNaN(value)) return '--';
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
    }

    function formatPercent(value) {
        if (value == null || isNaN(value)) return '--';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }

    function formatVolume(value) {
        if (value == null || isNaN(value)) return '--';
        if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
        if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
        if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        return value.toString();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('pt-BR');
        } catch { return dateStr; }
    }

    function getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    function getDefaultStartDate() {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
    }

    function isMarketOpen() {
        const now = new Date();
        const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const day = brt.getDay();
        const hour = brt.getHours();
        const min = brt.getMinutes();
        const time = hour * 60 + min;
        return day >= 1 && day <= 5 && time >= 600 && time <= 1055;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity .3s';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function debounce(fn, ms = 300) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
    }

    return { formatCurrency, formatNumber, formatPercent, formatVolume, formatDate, getTodayDate, getDefaultStartDate, isMarketOpen, showToast, debounce };
})();
