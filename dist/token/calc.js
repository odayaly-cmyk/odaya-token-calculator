(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TokenCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUFFIXES = { k: 1e3, m: 1e6, b: 1e9 };

  function parseTokenValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : NaN;
    if (value == null) return NaN;
    const normalized = String(value).trim().replace(/[,_\s]/g, '');
    const match = normalized.match(/^(\d*\.?\d+)([kKmMbB])?$/);
    if (!match) return NaN;
    const number = Number(match[1]);
    const multiplier = match[2] ? SUFFIXES[match[2].toLowerCase()] : 1;
    const result = number * multiplier;
    return Number.isFinite(result) && result >= 0 ? result : NaN;
  }

  function parsePrice(value) {
    const normalized = String(value ?? '').trim().replace(/[$,\s]/g, '');
    const number = Number(normalized);
    return normalized !== '' && Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function calculateRow(row) {
    const input = parseTokenValue(row.input);
    const output = parseTokenValue(row.output);
    const cached = parseTokenValue(row.cached);
    const inputPrice = parsePrice(row.inputPrice);
    const outputPrice = parsePrice(row.outputPrice);
    const cachePrice = parsePrice(row.cachePrice);
    const values = [input, output, cached, inputPrice, outputPrice, cachePrice];
    if (values.some(Number.isNaN)) return NaN;
    return (input / 1e6 * inputPrice) + (output / 1e6 * outputPrice) + (cached / 1e6 * cachePrice);
  }

  function calculateRows(rows) {
    return rows.reduce((sum, row) => {
      const cost = calculateRow(row);
      return Number.isNaN(cost) ? NaN : sum + cost;
    }, 0);
  }

  function percentagesValid(input, output, cached, tolerance = 0.01) {
    const values = [input, output, cached].map(Number);
    return values.every(v => Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(values.reduce((a, b) => a + b, 0) - 100) <= tolerance;
  }

  function simpleToRow(simple) {
    const total = parseTokenValue(simple.total);
    const pcts = [Number(simple.inputPct), Number(simple.outputPct), Number(simple.cachePct)];
    if (Number.isNaN(total) || !percentagesValid(...pcts)) return null;
    return {
      name: 'Simple blended estimate',
      input: total * pcts[0] / 100,
      output: total * pcts[1] / 100,
      cached: total * pcts[2] / 100,
      inputPrice: simple.inputPrice,
      outputPrice: simple.outputPrice,
      cachePrice: simple.cachePrice
    };
  }

  function utf8ToBase64(value) {
    if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
    const bytes = new TextEncoder().encode(value);
    let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  function base64ToUtf8(value) {
    if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf8');
    const binary = atob(value); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function serializeState(state) {
    return utf8ToBase64(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deserializeState(encoded) {
    try {
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      return JSON.parse(base64ToUtf8(padded));
    } catch (_) { return null; }
  }

  return { parseTokenValue, parsePrice, calculateRow, calculateRows, percentagesValid, simpleToRow, serializeState, deserializeState };
});
