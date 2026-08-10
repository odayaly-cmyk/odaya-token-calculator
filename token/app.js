(() => {
  'use strict';
  const C = window.TokenCalc;
  const STORAGE_KEY = 'hermes-token-cost:v1';
  const FX = { USD: 1, EUR: 0.92, GBP: 0.78, CAD: 1.37, AUD: 1.52 };
  const SYMBOL = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' };
  const PRESETS = {
    sol: { name: 'GPT-5.6 Sol (batch)', input: '15,156,170', output: '1,012,460', cached: '241,724,160', inputPrice: '2.00', outputPrice: '12.00', cachePrice: '0.20' },
    gpt55: { name: 'GPT-5.5', input: '16,508,597', output: '1,181,099', cached: '179,436,544', inputPrice: '4.00', outputPrice: '24.00', cachePrice: '0.40' },
    custom: { name: 'Custom model', input: '0', output: '0', cached: '0', inputPrice: '0', outputPrice: '0', cachePrice: '0' }
  };
  const MY_TOTAL = 455019030;
  const inputPct = 31664767 / MY_TOTAL * 100;
  const outputPct = 2193559 / MY_TOTAL * 100;
  const cachePct = 100 - inputPct - outputPct;

  const defaultState = () => ({
    version: 1, mode: 'my', period: 'monthly', currency: 'USD', theme: 'dark',
    rows: [structuredClone(PRESETS.sol), structuredClone(PRESETS.gpt55)],
    simple: { total: '455,019,030', inputPct: inputPct.toFixed(6), outputPct: outputPct.toFixed(6), cachePct: cachePct.toFixed(6), inputPrice: '2.00', outputPrice: '12.00', cachePrice: '0.20' }
  });

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let state = loadState();
  let toastTimer;

  function isValidState(candidate) {
    return candidate && Array.isArray(candidate.rows) && candidate.simple && ['my', 'detailed', 'simple'].includes(candidate.mode);
  }
  function mergeState(candidate) {
    const base = defaultState();
    return { ...base, ...candidate, rows: candidate.rows?.length ? candidate.rows : base.rows, simple: { ...base.simple, ...(candidate.simple || {}) } };
  }
  function loadState() {
    const hash = location.hash.match(/^#state=(.+)$/);
    if (hash) {
      const shared = C.deserializeState(hash[1]);
      if (isValidState(shared)) return mergeState(shared);
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (isValidState(saved)) return mergeState(saved);
    } catch (_) {}
    return defaultState();
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    $('#save-note').textContent = 'Saved locally · ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatNumber(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }
  function compactTokens(value) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6) return (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1e3) return (value / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return formatNumber(value);
  }
  function money(usd, maxDigits = 2) {
    if (!Number.isFinite(usd)) return '—';
    const converted = usd * FX[state.currency];
    return SYMBOL[state.currency] + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDigits }).format(converted);
  }
  function currentRows() {
    if (state.mode !== 'simple') return state.rows;
    const row = C.simpleToRow(state.simple);
    return row ? [row] : [];
  }
  function totals(rows) {
    return rows.reduce((sum, row) => {
      const input = C.parseTokenValue(row.input), output = C.parseTokenValue(row.output), cached = C.parseTokenValue(row.cached);
      if ([input, output, cached].some(Number.isNaN)) sum.valid = false;
      else { sum.input += input; sum.output += output; sum.cached += cached; }
      return sum;
    }, { input: 0, output: 0, cached: 0, valid: true });
  }
  function presetFor(row) {
    if (/5\.6 Sol/i.test(row.name)) return 'sol';
    if (/GPT-5\.5/i.test(row.name)) return 'gpt55';
    return 'custom';
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }

  function renderRows() {
    const body = $('#model-rows');
    body.innerHTML = state.rows.map((row, i) => {
      const preset = presetFor(row);
      const field = (key, label, cls = '') => `<td data-label="${label}"><input class="${cls}" data-key="${key}" value="${escapeHtml(row[key])}" inputmode="decimal" aria-label="${escapeHtml(row.name)} ${label}"></td>`;
      return `<tr data-index="${i}">
        <td data-label="Model"><select class="preset" aria-label="Model preset"><option value="sol" ${preset==='sol'?'selected':''}>GPT-5.6 Sol preset</option><option value="gpt55" ${preset==='gpt55'?'selected':''}>GPT-5.5 preset</option><option value="custom" ${preset==='custom'?'selected':''}>Custom model</option></select><input class="model-name" data-key="name" value="${escapeHtml(row.name)}" aria-label="Model name"></td>
        ${field('input','Uncached input tokens')} ${field('inputPrice','Input price / 1M')}
        ${field('output','Output tokens')} ${field('outputPrice','Output price / 1M')}
        ${field('cached','Cached tokens')} ${field('cachePrice','Cache price / 1M')}
        <td data-label="Subtotal" class="right subtotal" aria-live="polite">—</td>
        <td><button type="button" class="remove-row" aria-label="Remove ${escapeHtml(row.name)}" title="Remove row">×</button></td>
      </tr>`;
    }).join('');
    updateOutputs();
  }

  function renderSimpleInputs() {
    const map = { '#simple-total':'total', '#simple-input-pct':'inputPct', '#simple-output-pct':'outputPct', '#simple-cache-pct':'cachePct', '#simple-input-price':'inputPrice', '#simple-output-price':'outputPrice', '#simple-cache-price':'cachePrice' };
    Object.entries(map).forEach(([selector, key]) => { $(selector).value = state.simple[key]; });
  }

  function renderMode() {
    const simple = state.mode === 'simple';
    $('#simple-panel').hidden = !simple;
    $('#detailed-panel').hidden = simple;
    $('#scenario-label').textContent = state.mode === 'my' ? 'Actual Hermes usage · last 30 days' : state.mode === 'detailed' ? 'Custom detailed model scenario' : 'Simple blended token scenario';
    $$('.tabs [role="tab"]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.mode === state.mode)));
    updateOutputs();
  }

  function updateDetailedValidation() {
    let valid = true;
    $$('#model-rows tr').forEach((tr, i) => {
      tr.querySelectorAll('input[data-key]').forEach(input => {
        const key = input.dataset.key;
        const okay = key === 'name' ? input.value.trim().length > 0 : (key.toLowerCase().includes('price') ? !Number.isNaN(C.parsePrice(input.value)) : !Number.isNaN(C.parseTokenValue(input.value)));
        input.setAttribute('aria-invalid', String(!okay));
        if (!okay) valid = false;
      });
      const cost = C.calculateRow(state.rows[i]);
      tr.querySelector('.subtotal').textContent = money(cost);
    });
    return valid;
  }

  function updateSimpleValidation() {
    const s = state.simple;
    const validTotal = !Number.isNaN(C.parseTokenValue(s.total));
    const validPct = C.percentagesValid(s.inputPct, s.outputPct, s.cachePct);
    const pricesValid = [s.inputPrice, s.outputPrice, s.cachePrice].every(v => !Number.isNaN(C.parsePrice(v)));
    const sum = Number(s.inputPct) + Number(s.outputPct) + Number(s.cachePct);
    $('#percent-error').textContent = !validTotal ? 'Enter a valid non-negative token total.' : !validPct ? `Percentages must total 100%. Current total: ${Number.isFinite(sum) ? sum.toFixed(2) : 'invalid'}%.` : !pricesValid ? 'All prices must be valid non-negative numbers.' : '';
    ['input','output','cache'].forEach(kind => {
      const tokens = validTotal && Number.isFinite(Number(s[kind + 'Pct'])) ? C.parseTokenValue(s.total) * Number(s[kind + 'Pct']) / 100 : NaN;
      $(`#simple-${kind}-tokens`).textContent = compactTokens(tokens) + (Number.isFinite(tokens) ? ' tokens' : '');
    });
    return validTotal && validPct && pricesValid;
  }

  function updateOutputs() {
    const valid = state.mode === 'simple' ? updateSimpleValidation() : updateDetailedValidation();
    const rows = currentRows();
    const tokenTotals = totals(rows);
    const monthly = valid && tokenTotals.valid ? C.calculateRows(rows) : NaN;
    const total = tokenTotals.input + tokenTotals.output + tokenTotals.cached;
    const periodCost = state.period === 'daily' ? monthly / 30 : state.period === 'annual' ? monthly * 12 : monthly;
    const periodText = { monthly: '/ month', daily: '/ day', annual: '/ year' }[state.period];
    $('#primary-cost').textContent = money(periodCost);
    $('#primary-period').textContent = periodText;
    $('#period-label').textContent = state.period;
    $('#daily-cost').textContent = money(monthly / 30);
    $('#annual-cost').textContent = money(monthly * 12);
    $('#total-tokens').textContent = compactTokens(total);
    $('#token-detail').textContent = compactTokens(tokenTotals.input) + ' input · ' + compactTokens(tokenTotals.output) + ' output';
    $('#cache-ratio').textContent = total > 0 ? (tokenTotals.cached / total * 100).toFixed(2) + '%' : '0.00%';
    $('#cache-tokens').textContent = compactTokens(tokenTotals.cached) + ' tokens';
    $('#table-total').textContent = money(monthly);
    $('#global-error').hidden = valid;
    $('#global-error').textContent = valid ? '' : 'Fix the highlighted values before using this estimate.';
    $('#currency').value = state.currency;
    document.documentElement.dataset.theme = state.theme;
    $$('.segmented [data-period]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.period === state.period)));
    renderContribution(rows, monthly);
  }

  function renderContribution(rows, totalCost) {
    const container = $('#model-contribution');
    if (!rows.length || !Number.isFinite(totalCost)) { container.innerHTML = '<p class="field-hint">Enter a valid scenario to see model contribution.</p>'; return; }
    container.innerHTML = rows.map((row, i) => {
      const cost = C.calculateRow(row); const pct = totalCost > 0 ? cost / totalCost * 100 : 0;
      const color = i % 2 ? '#6fae92' : '#e8a84c';
      return `<div class="bar-row"><div class="bar-head"><strong>${escapeHtml(row.name || 'Unnamed model')}</strong><strong>${money(cost)} · ${pct.toFixed(1)}%</strong></div><div class="bar-track"><div class="bar-fill" style="--width:${Math.min(100,pct)}%;--color:${color}"></div></div></div>`;
    }).join('');
  }

  function updateRowState(event) {
    const tr = event.target.closest('tr[data-index]'); if (!tr) return;
    const row = state.rows[Number(tr.dataset.index)];
    if (event.target.matches('[data-key]')) row[event.target.dataset.key] = event.target.value;
    updateOutputs(); persist();
  }
  function applyPreset(select) {
    const tr = select.closest('tr'); const index = Number(tr.dataset.index);
    state.rows[index] = structuredClone(PRESETS[select.value]);
    renderRows(); persist();
  }
  function syncSimple(event) {
    const map = { 'simple-total':'total', 'simple-input-pct':'inputPct', 'simple-output-pct':'outputPct', 'simple-cache-pct':'cachePct', 'simple-input-price':'inputPrice', 'simple-output-price':'outputPrice', 'simple-cache-price':'cachePrice' };
    if (map[event.target.id]) { state.simple[map[event.target.id]] = event.target.value; updateOutputs(); persist(); }
  }
  async function copyText(text, success) {
    try { await navigator.clipboard.writeText(text); toast(success); }
    catch (_) {
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
      const copied = document.execCommand('copy'); area.remove(); toast(copied ? success : 'Copy failed — select and copy manually.');
    }
  }
  function summaryText() {
    const rows = currentRows(); const t = totals(rows); const monthly = C.calculateRows(rows);
    const detail = rows.map(r => `• ${r.name}: ${money(C.calculateRow(r))}/month (${compactTokens(C.parseTokenValue(r.input))} input, ${compactTokens(C.parseTokenValue(r.output))} output, ${compactTokens(C.parseTokenValue(r.cached))} cached)`).join('\n');
    return `Hermes Token Cost estimate\n${detail}\nTotal: ${money(monthly)}/month · ${money(monthly/30)}/day · ${money(monthly*12)}/year\nTokens: ${formatNumber(t.input+t.output+t.cached)} total\nPricing: Nous Portal input/output defaults checked Aug 9, 2026. Cache-read rates are editable assumptions. This estimate is not an invoice.`;
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function bindEvents() {
    $('.tabs').addEventListener('click', event => { const button = event.target.closest('[data-mode]'); if (!button) return; state.mode = button.dataset.mode; renderMode(); persist(); });
    $('.tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      const tabs = $$('.tabs [role="tab"]'); const index = tabs.indexOf(document.activeElement); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click();
    });
    $('#model-rows').addEventListener('input', updateRowState);
    $('#model-rows').addEventListener('change', event => { if (event.target.matches('.preset')) applyPreset(event.target); });
    $('#model-rows').addEventListener('click', event => { const button = event.target.closest('.remove-row'); if (!button) return; const index = Number(button.closest('tr').dataset.index); state.rows.splice(index, 1); if (!state.rows.length) state.rows.push(structuredClone(PRESETS.custom)); renderRows(); persist(); });
    $('#simple-panel').addEventListener('input', syncSimple);
    $('#add-row').addEventListener('click', () => { state.rows.push(structuredClone(PRESETS.custom)); renderRows(); persist(); setTimeout(() => $$('#model-rows .model-name').at(-1)?.focus(), 0); });
    $('.segmented').addEventListener('click', event => { const button = event.target.closest('[data-period]'); if (!button) return; state.period = button.dataset.period; updateOutputs(); persist(); });
    $('#currency').addEventListener('change', event => { state.currency = event.target.value; updateOutputs(); persist(); });
    $('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; updateOutputs(); persist(); });
    $('#reset').addEventListener('click', () => { const theme = state.theme; state = defaultState(); state.theme = theme; history.replaceState(null, '', location.pathname + location.search); renderRows(); renderSimpleInputs(); renderMode(); persist(); toast('Reset to My Hermes usage.'); });
    $('#clear').addEventListener('click', () => { state.rows = [structuredClone(PRESETS.custom)]; state.simple = { total:'0', inputPct:'0', outputPct:'0', cachePct:'100', inputPrice:'0', outputPrice:'0', cachePrice:'0' }; renderRows(); renderSimpleInputs(); updateOutputs(); persist(); toast('Calculator cleared.'); });
    $('#copy-summary').addEventListener('click', () => copyText(summaryText(), 'Summary copied.'));
    $('#share-state').addEventListener('click', () => { const encoded = C.serializeState(state); const url = `${location.origin}${location.pathname}#state=${encoded}`; history.replaceState(null, '', `#state=${encoded}`); copyText(url, 'Shareable URL copied.'); });
  }

  renderRows(); renderSimpleInputs(); bindEvents(); renderMode();
})();
