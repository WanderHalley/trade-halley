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

  function formatVolume(value)
