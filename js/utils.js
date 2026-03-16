/**
 * Trade Halley - Utilitários v3.0
 */
const Utils = (() => {
    function formatCurrency(value, currency = 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency', currency, minimumFractionDigits: 2,
        }).format(value);
    }

    function formatNumber(value, decimals = 2) {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        }).format(value);
    }

    function formatPercent(value) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${formatNumber(value)}%`;
    }

    function formatVolume(value) {
        if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return value.toString();
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    }

    function formatDateTime(dateStr) {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    function getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    function getDefaultStartDate() {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 2);
        return d.toISOString().split('T')[0];
    }

    function isMarketOpen() {
        const now = new Date();
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const day = brTime.getDay();
        const totalMin = brTime.getHours() * 60 + brTime.getMinutes();
        return day >= 1 && day <= 5 && totalMin >= 600 && totalMin <= 1020;
    }

    function debounce(fn, delay = 300) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    }

    function showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle',
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${icons[type] || icons.success}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return {
        formatCurrency, formatNumber, formatPercent, formatVolume,
        formatDate, formatDateTime, getTodayDate, getDefaultStartDate,
        isMarketOpen, debounce, showToast,
    };
})();
