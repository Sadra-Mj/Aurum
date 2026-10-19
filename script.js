/* Aurum Exchange — plain browser JavaScript. No build tools or API keys. */
(() => {
  'use strict';
  const API = 'https://api.frankfurter.dev/v2/rates';
  const CACHE_KEY = 'aurum-try-rates-v3';
  const currencies = {
    USD: { name: 'US Dollar', flag: 'us' },
    EUR: { name: 'Euro', flag: 'eu' },
    GBP: { name: 'British Pound', flag: 'gb' },
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = { rates: null, rows: [], history: [], cached: false, loading: false, historyLoading: false, days: 30, historyVersion: 0 };
  const dialog = $('#detail-dialog');
  const number = (value, decimals = 2) => new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  const dateLabel = (date, options = {}) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  function validRows(rows) {
    return Array.isArray(rows) && ['USD', 'EUR', 'GBP'].every((currency) => rows.some((row) =>
      row.base === currency && row.quote === 'TRY' && typeof row.rate === 'number' && Number.isFinite(row.rate) && row.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && !Number.isNaN(Date.parse(row.date))
    ));
  }
  function applyRows(rows, cached) {
    state.rows = ['USD', 'EUR', 'GBP'].map((currency) => rows.find((row) => row.base === currency));
    state.rates = Object.fromEntries(state.rows.map((row) => [row.base, row.rate]));
    state.cached = cached;
    $$('[data-rate]').forEach((element) => { element.textContent = number(state.rates[element.dataset.rate], 4); });
    const dates = [...new Set(state.rows.map((row) => row.date))].sort();
    const dateText = dates.length === 1 ? dateLabel(dates[0], { year: 'numeric' }) : `${dateLabel(dates[0])} – ${dateLabel(dates.at(-1), { year: 'numeric' })}`;
    $('#rate-status').textContent = `${cached ? 'Cached rates' : 'Reference rates'} · ${dateText}`;
    $('#market-date').textContent = `${cached ? 'Cached data' : 'Reference data'} as of ${dateText} · Values in TRY`;
    $('.rate-dot').classList.toggle('connected', !cached);
    renderChart();
  }
  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function loadRates() {
    if (state.loading) return;
    state.loading = true;
    const button = $('#refresh-rates');
    button.disabled = true;
    button.classList.add('loading');
    button.setAttribute('aria-label', 'Refreshing exchange rates');
    $('#rate-status').textContent = state.rates ? 'Checking for updated rates…' : 'Fetching latest rates…';
    try {
      const rows = (await Promise.all(Object.keys(currencies).map((currency) => fetchJSON(`${API}?base=${currency}&quotes=TRY`)))).flat();
      if (!validRows(rows)) throw new Error('Incomplete rate data');
      applyRows(rows, false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() })); } catch { /* Storage is optional. */ }
      loadHistory();
    } catch {
      if (state.rates) {
        applyRows(state.rows, true);
        $('#rate-status').textContent += ' · Connection unavailable';
      } else {
        $('#rate-status').textContent = 'Rates unavailable. Tap refresh to retry.';
        $('#chart-message').textContent = 'History unavailable. Refresh rates to try again.';
        $('#chart-area').setAttribute('aria-busy', 'false');
      }
    } finally {
      state.loading = false;
      button.disabled = false;
      button.classList.remove('loading');
      button.setAttribute('aria-label', 'Refresh exchange rates');
    }
  }
  async function loadHistory() {
    const version = ++state.historyVersion;
    const end = state.rows.map((row) => row.date).sort().at(-1);
    const startDate = new Date(`${end}T12:00:00Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 95);
    state.historyLoading = true;
    $('#chart-area').setAttribute('aria-busy', 'true');
    if (!state.history.length) {
      $('#chart-message').hidden = false;
      $('#chart-message').textContent = 'Loading historical rates…';
    }
    try {
      const rows = (await Promise.all(Object.keys(currencies).map((currency) => fetchJSON(`${API}?base=${currency}&quotes=TRY&from=${startDate.toISOString().slice(0, 10)}&to=${end}`)))).flat();
      if (!Array.isArray(rows)) throw new Error('Invalid historical rates');
      const clean = rows.filter((row) => ['USD', 'EUR', 'GBP'].includes(row.base) && row.quote === 'TRY' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.rate) && row.rate > 0).sort((a, b) => a.date.localeCompare(b.date));
      if (!clean.length) throw new Error('No historical rates');
      if (version !== state.historyVersion) return;
      state.history = clean;
      updateDailyChanges();
    } catch {
      if (version !== state.historyVersion) return;
      if (!state.history.length) $('#chart-message').textContent = 'History unavailable. Refresh rates to try again.';
    } finally {
      if (version === state.historyVersion) {
        state.historyLoading = false;
        $('#chart-area').setAttribute('aria-busy', 'false');
        renderChart();
      }
    }
  }
  function changeText(change) { return `${change >= 0 ? '+' : '−'}${number(Math.abs(change), 2)}%`; }
  function updateDailyChanges() {
    $$('[data-change]').forEach((element) => {
      const quote = element.dataset.change;
      const current = state.rows.find((row) => row.base === quote);
      const prior = state.history.filter((row) => row.base === quote && row.date < current.date).at(-1);
      if (!prior) { element.textContent = 'Change unavailable'; return; }
      const change = ((state.rates[quote] - prior.rate) / prior.rate) * 100;
      element.textContent = `${changeText(change)} last business day`;
      element.classList.toggle('positive', change >= 0);
      element.classList.toggle('negative', change < 0);
    });
  }
  function renderChart() {
    const currency = $('#chart-currency').value;
    $('#chart-title').textContent = `${currencies[currency].name} / Turkish Lira`;
    $('#chart-current').textContent = state.rates ? `${number(state.rates[currency], 4)} ₺` : '—';
    $('#chart-period').textContent = `Last ${state.days} days`;
    const latest = state.rows.find((row) => row.base === currency)?.date;
    const cutoff = latest ? new Date(`${latest}T12:00:00Z`) : new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - state.days);
    const rows = state.history.filter((row) => row.base === currency && row.date >= cutoff.toISOString().slice(0, 10) && (!latest || row.date <= latest));
    $$('[data-currency]').forEach((button) => {
      const selected = button.dataset.currency === currency;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const changeElement = $('#chart-change');
    changeElement.classList.remove('positive', 'negative');
    if (rows.length < 2) {
      $('#chart-message').hidden = false;
      if (state.history.length && !state.historyLoading) $('#chart-message').textContent = 'Not enough data for this period. Choose a longer range.';
      $('#chart-line').setAttribute('d', '');
      $('#chart-area-path').setAttribute('d', '');
      $('#chart-grid').replaceChildren();
      $('#chart-last').setAttribute('hidden', '');
      changeElement.textContent = 'Trend unavailable';
      $('#chart-accessible-title').textContent = `${currency} to TRY: historical data unavailable`;
      ['start', 'mid', 'end'].forEach((position) => { $(`#chart-${position}`).textContent = '—'; });
      return;
    }
    $('#chart-message').hidden = true;
    const values = rows.map((row) => row.rate);
    const low = Math.min(...values), high = Math.max(...values);
    const pad = (high - low) * 0.22 || high * 0.005;
    const min = low - pad, max = high + pad;
    const firstTime = Date.parse(rows[0].date), timeSpan = Date.parse(rows.at(-1).date) - firstTime || 1;
    const points = rows.map((row) => [12 + ((Date.parse(row.date) - firstTime) / timeSpan) * 562, 203 - ((row.rate - min) / (max - min)) * 186]);
    const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    $('#chart-line').setAttribute('d', path);
    $('#chart-area-path').setAttribute('d', `${path} L574,215 L12,215 Z`);
    const ns = 'http://www.w3.org/2000/svg';
    const grid = $('#chart-grid');
    grid.replaceChildren();
    for (let index = 0; index < 4; index++) {
      const y = 20 + index * 62;
      const line = document.createElementNS(ns, 'line');
      Object.entries({ x1: 12, x2: 582, y1: y, y2: y, stroke: '#303228', 'stroke-width': 1, 'stroke-dasharray': '3 5' }).forEach(([key, value]) => line.setAttribute(key, value));
      const text = document.createElementNS(ns, 'text');
      Object.entries({ x: 648, y: y + 4, fill: '#a5a69d', 'font-size': 11, 'text-anchor': 'end', 'font-family': 'DM Sans, sans-serif' }).forEach(([key, value]) => text.setAttribute(key, value));
      text.textContent = number(max - (index / 3) * (max - min), 2);
      grid.append(line, text);
    }
    const last = points.at(-1);
    $('#chart-last').removeAttribute('hidden');
    $('#chart-last').setAttribute('cx', last[0]);
    $('#chart-last').setAttribute('cy', last[1]);
    const change = ((values.at(-1) - values[0]) / values[0]) * 100;
    changeElement.textContent = `${changeText(change)} this period`;
    changeElement.classList.add(change >= 0 ? 'positive' : 'negative');
    $('#chart-start').textContent = dateLabel(rows[0].date);
    $('#chart-mid').textContent = dateLabel(rows[Math.floor(rows.length / 2)].date);
    $('#chart-end').textContent = dateLabel(rows.at(-1).date);
    $('#chart-accessible-title').textContent = `${currency} to TRY, ${dateLabel(rows[0].date)} to ${dateLabel(rows.at(-1).date)}. From ${number(values[0], 4)} to ${number(values.at(-1), 4)}, a change of ${changeText(change)}.`;
  }
  function openDialog(title, content, eyebrow = 'A CLEARER PICTURE') {
    $('#dialog-title').textContent = title;
    $('#dialog-eyebrow').textContent = eyebrow;
    $('#dialog-content').innerHTML = content;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  const information = {
    rates: ['Independent reference data', '<p>Rates are fetched from <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer">Frankfurter</a>, which aggregates central bank and official reference data. Values are mid-market estimates, updated by the source daily.</p><p>Quotes show the value of one USD, EUR, or GBP in Turkish lira, fetched directly for each currency pair. Historical charts show daily observations; changes compare the available reference observations, not intraday trading prices.</p><p>The page checks for new rates every five minutes while visible. The rate date may be earlier than today on weekends, holidays, or when the provider has not published a newer observation.</p>'],
    privacy: ['A considered approach to privacy', '<p>This website has no accounts, advertising trackers, or analytics. There are no account or amount fields. Only currency codes and dates are sent in requests to the exchange rate provider.</p><p>We store the last successfully fetched reference rates in your browser\'s local storage so the rate strip can remain useful when a connection fails. You can remove this data through your browser settings.</p><p>Rate requests connect directly to Frankfurter. Fonts are loaded from Google Fonts. These providers, and your hosting provider, receive the network information required to deliver their services. Their privacy policies apply to those requests.</p>'],
    terms: ['Simple, transparent terms', '<p>Aurum Exchange is a concept website for exploring currency information. It does not provide financial services, accept deposits, execute trades, or process transfers.</p><p>Rates are indicative, may be delayed, and exclude provider spreads, commissions, and fees. No displayed rate constitutes a binding exchange quote or financial advice.</p><p>Verify the final exchange rate and total cost with your chosen provider. Data availability depends on the third-party source and your internet connection.</p>']
  };
  $$('[data-info]').forEach((button) => button.addEventListener('click', () => {
    const [title, content] = information[button.dataset.info];
    openDialog(title, content, 'THE DETAILS MATTER');
  }));
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('#refresh-rates').addEventListener('click', loadRates);
  $('#chart-currency').addEventListener('change', renderChart);
  $$('[data-days]').forEach((button) => button.addEventListener('click', () => {
    state.days = Number(button.dataset.days);
    $$('[data-days]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    renderChart();
  }));
  $$('[data-currency]').forEach((button) => button.addEventListener('click', () => {
    $('#chart-currency').value = button.dataset.currency;
    renderChart();
  }));
  const menuButton = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  function closeMenu() { menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); mobileNav.hidden = true; }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileNav.hidden = !open;
  });
  $$('#mobile-nav a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); } });
  matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const revealTargets = $$('.section-heading, .chart-card, .watchlist, .principle, .how-intro, .steps li, .faq-section > div, .closing-banner');
  let revealObserver;
  function configureMotion() {
    revealObserver?.disconnect();
    revealTargets.forEach((element) => element.classList.remove('reveal-pending'));
    if (motionPreference.matches || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });
    revealTargets.forEach((element) => {
      element.classList.add('scroll-reveal');
      const siblingIndex = [...element.parentElement.children].filter((item) => item.matches('.principle, .steps li')).indexOf(element);
      element.style.setProperty('--reveal-delay', `${Math.max(0, siblingIndex) * 90}ms`);
      // Content already in view stays readable when preferences change.
      if (element.getBoundingClientRect().top > innerHeight - 24) element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  }
  configureMotion();
  motionPreference.addEventListener('change', configureMotion);
  let scrollScheduled = false;
  function updateScroll() {
    const distance = document.documentElement.scrollHeight - innerHeight;
    $('.scroll-progress').style.transform = `scaleX(${distance > 0 ? scrollY / distance : 0})`;
    $('.currency-ribbon').classList.toggle('is-scrolled', scrollY > 96);
    scrollScheduled = false;
  }
  addEventListener('scroll', () => {
    if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  addEventListener('resize', updateScroll);
  motionPreference.addEventListener('change', updateScroll);
  updateScroll();
  // A lightweight, locally drawn globe; no animation library or external assets.
  function initializeGlobe() {
    const canvas = $('#kinetic-globe');
    const scene = $('.kinetic-scene');
    const toggle = $('#motion-toggle');
    const context = canvas.getContext('2d');
    let rotation = 0.4;
    let frame = 0;
    let lastTime = 0;
    let userPaused = false;
    let inView = true;
    const points = Array.from({ length: 1100 }, (_, index) => {
      const y = 1 - (index / 1099) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    });
    function project(x, y, z) {
      const px = x * Math.cos(rotation) + z * Math.sin(rotation);
      const pz = -x * Math.sin(rotation) + z * Math.cos(rotation);
      const py = y * Math.cos(-0.23) - pz * Math.sin(-0.23);
      const depth = y * Math.sin(-0.23) + pz * Math.cos(-0.23);
      return { x: 220 + px * 146, y: 220 + py * 146, depth };
    }
    function draw() {
      if (!context) return;
      context.setTransform(2, 0, 0, 2, 0, 0);
      context.clearRect(0, 0, 440, 440);
      const fill = context.createRadialGradient(170, 155, 15, 220, 220, 147);
      fill.addColorStop(0, '#c2a05a14');
      fill.addColorStop(0.6, '#9c793809');
      fill.addColorStop(1, '#0c0d0c00');
      context.beginPath(); context.arc(220, 220, 146, 0, Math.PI * 2);
      context.fillStyle = fill; context.fill();
      context.strokeStyle = '#d6b97950'; context.lineWidth = 0.7; context.stroke();
      function trace(samples) {
        let active = false;
        context.beginPath();
        samples.forEach(([x, y, z]) => {
          const p = project(x, y, z);
          if (p.depth < 0) { active = false; return; }
          if (!active) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
          active = true;
        });
        context.strokeStyle = '#d6b97930'; context.lineWidth = 0.55; context.stroke();
      }
      for (let latitude = -60; latitude <= 60; latitude += 30) {
        const lat = latitude * Math.PI / 180;
        trace(Array.from({ length: 121 }, (_, i) => {
          const angle = (i / 120) * Math.PI * 2;
          return [Math.cos(angle) * Math.cos(lat), Math.sin(lat), Math.sin(angle) * Math.cos(lat)];
        }));
      }
      for (let longitude = 0; longitude < 180; longitude += 30) {
        const lng = longitude * Math.PI / 180;
        trace(Array.from({ length: 121 }, (_, i) => {
          const angle = (i / 120) * Math.PI * 2;
          return [Math.cos(angle) * Math.cos(lng), Math.sin(angle), Math.cos(angle) * Math.sin(lng)];
        }));
      }
      points.forEach(([x, y, z]) => {
        const p = project(x, y, z);
        if (p.depth < 0) return;
        context.beginPath(); context.arc(p.x, p.y, 0.55 + p.depth * 0.6, 0, Math.PI * 2);
        context.fillStyle = `rgba(214,185,121,${0.12 + p.depth * 0.48})`; context.fill();
      });
    }
    function animate(time) {
      rotation += Math.min(lastTime ? time - lastTime : 16, 48) * 0.00011;
      lastTime = time;
      draw();
      frame = requestAnimationFrame(animate);
    }
    function synchronizeMotion() {
      const reduced = motionPreference.matches;
      const paused = userPaused || reduced || !inView || document.hidden;
      scene.classList.toggle('motion-paused', paused);
      scene.dataset.motion = reduced ? 'reduced' : paused ? 'paused' : 'running';
      toggle.disabled = reduced;
      toggle.setAttribute('aria-pressed', String(userPaused || reduced));
      toggle.setAttribute('aria-label', reduced ? 'Globe motion disabled by reduced motion preference' : userPaused ? 'Play globe animation' : 'Pause globe animation');
      $('.motion-control-label').textContent = reduced ? 'Motion off' : userPaused ? 'Play motion' : 'Pause motion';
      $('.motion-control-icon').textContent = userPaused || reduced ? '▷' : 'Ⅱ';
      if (paused) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else if (!frame) frame = requestAnimationFrame(animate);
      draw();
    }
    toggle.addEventListener('click', () => { userPaused = !userPaused; synchronizeMotion(); });
    motionPreference.addEventListener('change', synchronizeMotion);
    document.addEventListener('visibilitychange', synchronizeMotion);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; synchronizeMotion(); }, { threshold: 0 }).observe(scene);
    }
    synchronizeMotion();
  }
  initializeGlobe();
  $('#year').textContent = new Date().getFullYear();
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cache && validRows(cache.rows)) applyRows(cache.rows, true);
  } catch { /* Disabled storage or invalid cache does not prevent live loading. */ }
  loadRates();
  setInterval(() => { if (!document.hidden) loadRates(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRates(); });
  window.addEventListener('online', loadRates);
})();
