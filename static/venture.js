(() => {
  const pageSize = 12;
  const state = { deals: [], page: 0, stage: '', sector: '', query: '', selected: null };
  const $ = (id) => document.getElementById(id);
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const dateText = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const initials = (name) => name.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const roundAmount = (deal) => Number(deal.amountUsd || 0);
  const displayAmount = (deal) => roundAmount(deal) ? usd.format(roundAmount(deal)) : 'Undisclosed';
  const formattedDate = (deal) => dateText.format(new Date(`${deal.date}T00:00:00Z`));
  const icon = (deal, className = 'deal-icon') => deal.iconPath ? `<img class="${className}" src="${safe(deal.iconPath)}" alt="" onerror="this.remove()">` : '';

  function filtered() {
    const needle = state.query.trim().toLowerCase();
    return state.deals.filter((deal) => {
      const haystack = [deal.company, deal.sector, deal.stage, ...(deal.investors || []), ...(deal.leadInvestors || [])].join(' ').toLowerCase();
      return (!state.stage || deal.stage === state.stage) && (!state.sector || deal.sector === state.sector) && (!needle || haystack.includes(needle));
    }).sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company));
  }

  function totalShownAmount(deals) { return deals.reduce((sum, deal) => sum + roundAmount(deal), 0); }

  function populateSelect(id, values) {
    const select = $(id);
    select.insertAdjacentHTML('beforeend', values.map((value) => `<option value="${safe(value)}">${safe(value)}</option>`).join(''));
  }

  function renderSummary(deals) {
    const dates = deals.map((deal) => deal.date).sort();
    $('summaryCount').textContent = `${deals.length} sourced funding records`;
    $('summaryRange').textContent = dates.length ? `· ${formattedDate({ date: dates[0] })} to ${formattedDate({ date: dates.at(-1) })}` : '';
    $('summaryAmount').textContent = `${usd.format(totalShownAmount(deals))} disclosed`;
  }

  function renderTabs() {
    const stages = [...new Set(state.deals.map((deal) => deal.stage))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    $('stageTabs').innerHTML = [`<button class="${state.stage ? '' : 'active'}" data-stage="">all</button>`, ...stages.map((stage) => `<button class="${state.stage === stage ? 'active' : ''}" data-stage="${safe(stage)}">${safe(stage)}</button>`)].join('');
    $('stageTabs').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      state.stage = button.dataset.stage;
      $('stage').value = state.stage;
      state.page = 0;
      render();
    }));
  }

  function renderDetail(deal) {
    if (!deal) { $('detail').innerHTML = '<p class="empty-detail">Select a marker to see the company, reported amount, investors, and source.</p>'; return; }
    const investors = [...new Set([...(deal.leadInvestors || []), ...(deal.investors || [])])];
    const coverage = (deal.articles || [{ url: deal.url, publisher: deal.source, title: deal.title }]).map((article) => `<li><a href="${safe(article.url)}" target="_blank" rel="noreferrer">${safe(article.publisher || 'Source')}</a>${article.title ? ` · ${safe(article.title)}` : ''}</li>`).join('');
    $('detail').innerHTML = `<div class="detail-head"><h2>${safe(deal.company)} <small>· ${safe(deal.stage)}</small></h2><strong>${safe(displayAmount(deal))}</strong></div><p class="detail-meta">${safe(formattedDate(deal))} · ${safe(deal.sector || 'Uncategorised')} · ${safe(deal.country || 'Location not reported')}</p><p class="detail-investors"><b>Investors:</b> ${safe(investors.length ? investors.join(', ') : 'Not reported')}</p><div class="detail-source"><b>Coverage (${deal.articles?.length || 1}):</b><ul>${coverage}</ul></div>`;
  }

  function renderChart(deals) {
    const pages = Math.max(1, Math.ceil(deals.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * pageSize;
    const windowDeals = deals.slice(start, start + pageSize);
    const disclosed = windowDeals.filter(roundAmount);
    const maxLog = Math.max(...disclosed.map((deal) => Math.log10(roundAmount(deal))), 1);
    $('chart').innerHTML = windowDeals.map((deal) => {
      const height = roundAmount(deal) ? Math.max(14, Math.round((Math.log10(roundAmount(deal)) / maxLog) * 225)) : 8;
      const selected = state.selected === deal.id ? ' selected' : '';
      return `<button class="deal-column${selected}" type="button" role="listitem" data-id="${safe(deal.id)}" title="${safe(deal.company)} · ${safe(displayAmount(deal))}"><span class="bar-wrap"><span class="deal-bar" style="height:${height}px"><span class="deal-initials${deal.iconPath ? ' has-icon' : ''}">${safe(initials(deal.company))}</span>${icon(deal)}</span></span><span class="deal-label"><time>${safe(formattedDate(deal))}</time><span>${safe(deal.company)}</span><span class="amount-label">${safe(displayAmount(deal))}</span></span></button>`;
    }).join('') || '<p class="empty-detail">No records match these filters.</p>';
    $('chart').querySelectorAll('.deal-column').forEach((button) => button.addEventListener('click', () => {
      state.selected = button.dataset.id;
      renderChart(deals);
      renderDetail(state.deals.find((deal) => deal.id === state.selected));
    }));
    $('pageStatus').textContent = deals.length ? `${start + 1}–${Math.min(start + pageSize, deals.length)} of ${deals.length}` : '0 records';
    $('newer').disabled = state.page === 0;
    $('older').disabled = state.page >= pages - 1;
    $('chartCaption').textContent = windowDeals.length ? `Latest at left, earlier rounds at right. This window contains ${windowDeals.length} rounds; page through it to keep labels readable.` : '';
  }

  function render() {
    const deals = filtered();
    renderTabs();
    renderChart(deals);
    renderDetail(state.deals.find((deal) => deal.id === state.selected));
  }

  function bind() {
    $('query').addEventListener('input', (event) => { state.query = event.target.value; state.page = 0; render(); });
    $('stage').addEventListener('change', (event) => { state.stage = event.target.value; state.page = 0; render(); });
    $('sector').addEventListener('change', (event) => { state.sector = event.target.value; state.page = 0; render(); });
    $('reset').addEventListener('click', () => { state.stage = ''; state.sector = ''; state.query = ''; state.page = 0; $('query').value = ''; $('stage').value = ''; $('sector').value = ''; render(); });
    $('newer').addEventListener('click', () => { state.page -= 1; render(); });
    $('older').addEventListener('click', () => { state.page += 1; render(); });
  }

  fetch('venture-data.json').then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))).then((deals) => {
    state.deals = deals;
    populateSelect('stage', [...new Set(deals.map((deal) => deal.stage))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    populateSelect('sector', [...new Set(deals.map((deal) => deal.sector).filter(Boolean))].sort());
    renderSummary(deals);
    bind();
    const requested = decodeURIComponent(location.hash.slice(1));
    const index = deals.sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company)).findIndex((deal) => deal.id === requested);
    if (index >= 0) { state.selected = requested; state.page = Math.floor(index / pageSize); }
    render();
  }).catch((error) => { $('chart').innerHTML = `<p class="empty-detail">Could not load the venture data: ${safe(error.message)}</p>`; });
})();
