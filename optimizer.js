/* Vixelia optimizer – long-only, min-weight floor, max-Sharpe, CAL. No dependencies. */
const VX = (() => {
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  function returns(prices) { const r = []; for (let i = 1; i < prices.length; i++) r.push(prices[i] / prices[i - 1] - 1); return r; }
  function stats(priceMap, tickers) {            // annualised mu, sample cov (x12)
    const R = tickers.map(t => returns(priceMap[t])), n = R[0].length;
    const mu = R.map(r => mean(r) * 12);
    const cov = R.map((a, i) => R.map((b, j) => {
      const ma = mean(a), mb = mean(b); let s = 0;
      for (let k = 0; k < n; k++) s += (a[k] - ma) * (b[k] - mb);
      return s / (n - 1) * 12; }));
    return { mu, cov, n };
  }
  const port = (w, mu, cov) => {
    let e = 0, v = 0;
    for (let i = 0; i < w.length; i++) { e += w[i] * mu[i]; for (let j = 0; j < w.length; j++) v += w[i] * w[j] * cov[i][j]; }
    return { e, sd: Math.sqrt(v) };
  };
  function projSimplex(v, z = 1) {               // Euclidean projection onto {s>=0, sum=z}
    const u = [...v].sort((a, b) => b - a); let css = 0, rho = 0, th = 0;
    for (let i = 0; i < u.length; i++) { css += u[i]; const t = (css - z) / (i + 1); if (u[i] - t > 0) { rho = i; th = t; } }
    return v.map(x => Math.max(x - th, 0));
  }
  // w = wmin + (1 - n*wmin) * s ,  s on simplex
  function maxSharpe(mu, cov, rf, wmin = 0.10) {
    const n = mu.length, free = 1 - n * wmin;
    if (free < -1e-12) return null;
    const toW = s => s.map(x => wmin + free * x);
    const f = s => { const p = port(toW(s), mu, cov); return (p.e - rf) / p.sd; };
    let best = null;
    const starts = [Array(n).fill(1 / n), ...Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, i) => i === k ? 1 : 0))];
    for (const s0 of starts) {
      let s = s0.slice(), fs = f(s), step = 1;
      for (let it = 0; it < 2000 && step > 1e-12; it++) {
        const w = toW(s), p = port(w, mu, cov), g = [];
        for (let i = 0; i < n; i++) {
          let cv = 0; for (let j = 0; j < n; j++) cv += cov[i][j] * w[j];
          g.push(free * ((mu[i] - rf) / p.sd - (p.e - rf) * cv / (p.sd ** 3)));
        }
        let moved = false;
        for (let tries = 0; tries < 40; tries++) {
          const sn = projSimplex(s.map((x, i) => x + step * g[i])), fn = f(sn);
          if (fn > fs + 1e-15) { s = sn; fs = fn; step *= 1.5; moved = true; break; }
          step /= 2;
        }
        if (!moved) break;
      }
      if (!best || fs > best.sharpe) best = { s, sharpe: fs };
    }
    const w = toW(best.s), p = port(w, mu, cov);
    return { w, e: p.e, sd: p.sd, sharpe: best.sharpe };
  }
  function* combos(n, k, start = 0, cur = []) {
    if (cur.length === k) { yield cur.slice(); return; }
    for (let i = start; i < n; i++) { cur.push(i); yield* combos(n, k, i + 1, cur); cur.pop(); }
  }
  // best k of N tickers (every k-subset, each optimised) -> sorted by Sharpe
  function bestSubset(tickers, mu, cov, rf, k = 4, wmin = 0.10) {
    const out = [];
    for (const c of combos(tickers.length, k)) {
      const r = maxSharpe(c.map(i => mu[i]), c.map(i => c.map(j => cov[i][j])), rf, wmin);
      if (r) out.push({ tickers: c.map(i => tickers[i]), ...r });
    }
    return out.sort((a, b) => b.sharpe - a.sharpe);
  }
  function complete(p, rf, A) {                  // optimal complete portfolio on the CAL
    const y = Math.min(1, Math.max(0, (p.e - rf) / (A * p.sd * p.sd)));
    const e = rf + y * (p.e - rf), sd = y * p.sd;
    return { y, rfWeight: 1 - y, e, sd, U: e - 0.5 * A * sd * sd };
  }
  // survey score (10-40) -> A via the group's convention + Pan&Statman interpolation
  const PS = [[.03, 23.75], [.06, 12.11], [.09, 8.04], [.12, 5.86], [.15, 4.46], [.18, 3.47], [.21, 2.73], [.24, 2.16], [.27, 1.71], [.30, 1.34]];
  function scoreToA(score) {
    const X = .03 + (score - 10) / 30 * .27;
    for (let i = 0; i < PS.length - 1; i++) if (X >= PS[i][0] - 1e-12 && X <= PS[i + 1][0] + 1e-12)
      return { X, A: PS[i][1] + (X - PS[i][0]) / (PS[i + 1][0] - PS[i][0]) * (PS[i + 1][1] - PS[i][1]) };
  }
  return { stats, port, maxSharpe, bestSubset, complete, scoreToA };
})();
if (typeof module !== 'undefined') module.exports = VX;
