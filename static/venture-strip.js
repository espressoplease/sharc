(() => {
  const pageSize = 12;
  const state = { deals: [], page: 0, stage: '', sector: '', query: '', selected: null };
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const dates = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const clean = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const initials = (name) => name.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const amount = (deal) => deal.amountUsd ? money.format(deal.amountUsd) : 'Undisclosed';
  const date = (deal) => dates.format(new Date(`${deal.date}T00:00:00Z`));
  const host = document.getElementById('venture-dashboard');
  const strip = document.getElementById('venture-strip');
  if (!host || !strip) return;

  const ordered = () => state.deals.filter((deal) => {
    const terms = [deal.company, deal.sector, deal.stage, ...(deal.investors || []), ...(deal.leadInvestors || [])].join(' ').toLowerCase();
    return (!state.stage || deal.stage === state.stage) && (!state.sector || deal.sector === state.sector) && (!state.query || terms.includes(state.query));
  }).sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company));

  function drawDetail(deal) {
    const target = document.getElementById('venture-detail');
    if (!deal) { target.textContent = 'Select a deal marker for investors and source.'; return; }
    const investors = [...new Set([...(deal.leadInvestors || []), ...(deal.investors || [])])];
    target.innerHTML = `<strong>${clean(deal.company)} · ${clean(deal.stage)} · ${clean(amount(deal))}</strong> · ${clean(deal.sector || 'Uncategorised')}<br>Investors: ${clean(investors.join(', ') || 'Not reported')} · <a href="${clean(deal.url)}" target="_blank" rel="noreferrer">${clean(deal.source || 'source')}</a>`;
  }

  function draw() {
    const stages = [...new Set(state.deals.map((deal) => deal.stage))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const sectors = [...new Set(state.deals.map((deal) => deal.sector).filter(Boolean))].sort();
    host.innerHTML = `<div class="venture-inline-tools"><label>Find company or fund<input id="venture-query" type="search" placeholder="Mistral, Accel"></label><label>Stage<select id="venture-stage"><option value="">All stages</option>${stages.map((v) => `<option value="${clean(v)}">${clean(v)}</option>`).join('')}</select></label><label>Sector<select id="venture-sector"><option value="">All sectors</option>${sectors.map((v) => `<option value="${clean(v)}">${clean(v)}</option>`).join('')}</select></label><button id="venture-reset" type="button">reset</button></div><div id="venture-tabs" class="venture-inline-tabs"></div><div class="venture-inline-pager"><button id="venture-newer" type="button">‹ newer</button><strong id="venture-page"></strong><button id="venture-older" type="button">older ›</button></div><div id="venture-chart" class="venture-inline-chart" role="list" aria-label="Venture funding rounds"></div><p id="venture-caption" class="venture-inline-caption"></p><div id="venture-detail" class="venture-inline-detail"></div>`;
    document.getElementById('venture-query').value = state.query;
    document.getElementById('venture-stage').value = state.stage;
    document.getElementById('venture-sector').value = state.sector;
    document.getElementById('venture-query').addEventListener('input', (e) => { state.query = e.target.value.toLowerCase(); state.page = 0; draw(); });
    document.getElementById('venture-stage').addEventListener('change', (e) => { state.stage = e.target.value; state.page = 0; draw(); });
    document.getElementById('venture-sector').addEventListener('change', (e) => { state.sector = e.target.value; state.page = 0; draw(); });
    document.getElementById('venture-reset').addEventListener('click', () => { state.query = ''; state.stage = ''; state.sector = ''; state.page = 0; draw(); });
    document.getElementById('venture-newer').addEventListener('click', () => { state.page -= 1; draw(); });
    document.getElementById('venture-older').addEventListener('click', () => { state.page += 1; draw(); });
    const tabs = document.getElementById('venture-tabs');
    tabs.innerHTML = [`<button class="${state.stage ? '' : 'active'}" data-stage="">all</button>`, ...stages.map((v) => `<button class="${state.stage === v ? 'active' : ''}" data-stage="${clean(v)}">${clean(v)}</button>`)].join('');
    tabs.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { state.stage = button.dataset.stage; state.page = 0; draw(); }));
    const deals = ordered(), pages = Math.max(1, Math.ceil(deals.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * pageSize, visible = deals.slice(start, start + pageSize);
    const maxLog = Math.max(...visible.filter((deal) => deal.amountUsd).map((deal) => Math.log10(deal.amountUsd)), 1);
    document.getElementById('venture-chart').innerHTML = visible.map((deal) => {
      const height = deal.amountUsd ? Math.max(12, Math.round(Math.log10(deal.amountUsd) / maxLog * 165)) : 6;
      const icon = deal.iconPath ? `<img src="${clean(deal.iconPath)}" alt="">` : '';
      return `<button class="venture-inline-deal${state.selected === deal.id ? ' selected' : ''}" type="button" data-id="${clean(deal.id)}" role="listitem"><span class="venture-inline-bar-wrap"><span class="venture-inline-bar" style="height:${height}px"><span class="venture-inline-icon">${icon}<span class="venture-inline-fallback">${clean(initials(deal.company))}</span></span></span></span><span class="venture-inline-label"><span class="venture-inline-date">${clean(date(deal))}</span><span>${clean(deal.company)}</span><span class="venture-inline-amount">${clean(amount(deal))}</span></span></button>`;
    }).join('') || '<p>No records match those filters.</p>';
    document.getElementById('venture-chart').querySelectorAll('.venture-inline-deal').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.id; draw(); }));
    document.getElementById('venture-page').textContent = deals.length ? `${start + 1}–${Math.min(start + pageSize, deals.length)} of ${deals.length}` : '0 records';
    document.getElementById('venture-newer').disabled = state.page === 0;
    document.getElementById('venture-older').disabled = state.page >= pages - 1;
    document.getElementById('venture-caption').textContent = visible.length ? 'Latest rounds at left. Log scale keeps seed and late-stage amounts visible.' : '';
    drawDetail(state.deals.find((deal) => deal.id === state.selected));
  }

  const toggle = document.getElementById('venture-strip-toggle');
  toggle.addEventListener('click', () => { strip.classList.toggle('is-collapsed'); toggle.textContent = strip.classList.contains('is-collapsed') ? 'expand' : 'collapse'; });
  fetch('venture-data.json').then((response) => response.ok ? response.json() : Promise.reject()).then((deals) => {
    state.deals = deals;
    document.getElementById('venture-strip-summary').textContent = `${deals.length} sourced records · ${money.format(deals.reduce((sum, deal) => sum + Number(deal.amountUsd || 0), 0))} disclosed`;
    draw();
  }).catch(() => { host.textContent = 'Venture data is temporarily unavailable.'; });
})();
