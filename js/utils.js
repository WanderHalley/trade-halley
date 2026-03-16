/**
 * Trade Halley - Utilitários
 */

const Utils = (() => {
  function formatCurrency(value, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  }

  function formatNumber(value, decimals = 2) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
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
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getColorClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  function getBadgeClass(value) {
    if (value > 0) return 'badge-green';
    if (value < 0) return 'badge-red';
    return 'badge-yellow';
  }

  function isMarketOpen() {
    const now = new Date();
    const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const day = brTime.getDay();
    const hours = brTime.getHours();
    const minutes = brTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    // B3: seg-sex 10:00 - 17:00
    return day >= 1 && day <= 5 && totalMinutes >= 600 && totalMinutes <= 1020;
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function sortArray(arr, key, direction = 'desc') {
    return [...arr].sort((a, b) => {
      const valA = a[key] ?? 0;
      const valB = b[key] ?? 0;
      return direction === 'desc' ? valB - valA : valA - valB;
    });
  }

  function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      if (show) overlay.classList.add('active');
      else overlay.classList.remove('active');
    }
  }

  function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="${icons[type] || icons.success}" style="color: var(--${type === 'success' ? 'green' : type === 'error' ? 'red' : 'yellow'}-primary)"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'className') el.className = val;
      else if (key === 'innerHTML') el.innerHTML = val;
      else if (key === 'textContent') el.textContent = val;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
      else el.setAttribute(key, val);
    });
    children.forEach(child => {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    });
    return el;
  }

  return {
    formatCurrency,
    formatNumber,
    formatPercent,
    formatVolume,
    formatDate,
    formatDateTime,
    getColorClass,
    getBadgeClass,
    isMarketOpen,
    debounce,
    sortArray,
    showLoading,
    showToast,
    createEl,
  };
})();
