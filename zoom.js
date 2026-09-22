/* Display preference only; never changes budget data. */
(() => {
  const control = document.querySelector('#page-zoom');
  const content = document.querySelector('#main');
  const levels = [100, 90, 80, 75, 67, 50];
  const key = 'allocate-studio-page-zoom-v4';
  function apply(value) {
    const percent = levels.includes(Number(value)) ? Number(value) : 100;
    control.value = String(percent);
    content.style.zoom = String(percent / 100);
    content.dataset.reducedZoom = String(percent < 100);
    if (typeof fitBudgetCharts === 'function') fitBudgetCharts();
    return percent;
  }
  let saved = 100;
  try { saved = localStorage.getItem(key) || 100; } catch (_) {}
  apply(saved);
  control.addEventListener('change', () => {
    const percent = apply(control.value);
    try { localStorage.setItem(key, String(percent)); } catch (_) {}
  });
})();

/* Size overview cards to the first viewport; keep details in normal flow. */
(() => {
  const main = document.querySelector('#main');
  let pending = false;
  function fitOverview() {
    pending = false;
    const zoom = parseFloat(getComputedStyle(main).zoom) || 1;
    const calendar = main.querySelector('.calendar-grid');
    if (calendar) {
      calendar.style.height = '';
      if (zoom === 1 && window.innerWidth >= 1100 && window.innerWidth <= 1700) {
        const top = calendar.getBoundingClientRect().top + window.scrollY;
        calendar.style.height = Math.max(320, (window.innerHeight - top - 18) / zoom) + 'px';
      }
    }
    const row = main.querySelector('.annual-charts + .summary-grid, .monthly-spending-row');
    if (!row) return;
    row.style.minHeight = '';
    const upper = main.querySelector('.monthly-summary-grid');
    if (upper) upper.style.minHeight = '';
    // At reduced zoom, keep natural card heights instead of cancelling the scale.
    if (zoom !== 1 || window.innerWidth <= 1700) return;
    if (upper) {
      const upperBounds = upper.getBoundingClientRect();
      const lowerBounds = row.getBoundingClientRect();
      const gap = lowerBounds.top - upperBounds.bottom;
      const available = window.innerHeight - 16 - (upperBounds.top + window.scrollY) - gap;
      const height = Math.max(upperBounds.height, lowerBounds.height, available / 2) / zoom;
      upper.style.minHeight = height + 'px';
      row.style.minHeight = height + 'px';
      return;
    }
    const bounds = row.getBoundingClientRect();
    const extra = window.innerHeight - 16 - (bounds.bottom + window.scrollY);
    if (extra > 0) row.style.minHeight = (bounds.height + extra) / zoom + 'px';
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(fitOverview); }
  }
  new MutationObserver(schedule).observe(main, { childList: true });
  window.addEventListener('resize', schedule);
  document.querySelector('#page-zoom')?.addEventListener('change', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
})();
