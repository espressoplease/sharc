(() => {
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const initials = (name) => name.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const clean = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const amount = (deal) => deal.amountUsd ? currency.format(deal.amountUsd) : 'Undisclosed';
  const root = document.getElementById('venture-strip');
  if (!root) return;

  const render = (deals) => {
    const latest = [...deals].sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company)).slice(0, 6);
    document.getElementById('venture-strip-summary').textContent = `${deals.length} sourced records · ${currency.format(deals.reduce((sum, deal) => sum + Number(deal.amountUsd || 0), 0))} disclosed`;
    document.getElementById('venture-strip-deals').innerHTML = latest.map((deal) => `<a class="venture-strip-deal" href="venture.html#${encodeURIComponent(deal.id)}" title="${clean(deal.company)} · ${clean(deal.stage)} · ${clean(amount(deal))}"><span class="venture-strip-icon">${deal.iconPath ? `<img src="${clean(deal.iconPath)}" alt="" onerror="this.remove()">` : ''}<span class="venture-strip-fallback">${clean(initials(deal.company))}</span></span><span><span class="venture-strip-company">${clean(deal.company)}</span><span class="venture-strip-amount">${clean(deal.stage)} · ${clean(amount(deal))}</span></span></a>`).join('');
  };

  const toggle = document.getElementById('venture-strip-toggle');
  toggle.addEventListener('click', () => { root.classList.toggle('is-collapsed'); toggle.textContent = root.classList.contains('is-collapsed') ? 'expand' : 'collapse'; });
  fetch('venture-data.json').then((response) => response.ok ? response.json() : Promise.reject()).then(render).catch(() => { document.getElementById('venture-strip-summary').textContent = 'venture data is temporarily unavailable'; });
})();
