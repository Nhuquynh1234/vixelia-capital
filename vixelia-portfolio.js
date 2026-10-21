/* Vixelia add-on: trang "Khách hàng mẫu" (#/khach-hang-mau) và "Công cụ danh mục" (#/cong-cu-danh-muc).
 * Nạp SAU script chính và SAU optimizer.js. Dùng lại R, L, pages, head, route() của trang gốc. */
(function () {
  'use strict';
  const q = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';
  const vnd = n => Math.round(n).toLocaleString('vi-VN');
  const TICKER = /^[A-Z][A-Z0-9]{2,3}$/;
  const DEFAULT = { rf: 4.41, score: 21, wmin: 10, k: 4, capital: 320120000 };

  /* ---------- CSS ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .vx-grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start}
  .vx-card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:28px}
  .vx-card h3{margin:0 0 14px}
  .vx-t{width:100%;border-collapse:collapse;font-size:.92rem}
  .vx-t th,.vx-t td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
  .vx-t th:first-child,.vx-t td:first-child{text-align:left}.vx-t th{color:var(--mut);font-weight:500}
  .vx-t tr.best td{background:rgba(184,145,47,.14);font-weight:600}
  .vx-sc{overflow-x:auto}
  .vx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .vx-chip{display:inline-flex;gap:8px;align-items:center;padding:7px 12px;border-radius:999px;background:var(--navy);color:#fff;font-size:.88rem}
  .vx-chip button{background:none;border:0;color:#fff;cursor:pointer;font-size:1rem;line-height:1}
  .vx-bar{display:flex;height:34px;border-radius:4px;overflow:hidden;margin:14px 0}
  .vx-bar span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:.78rem;min-width:2px}
  .vx-warn{border-left:3px solid var(--gold);background:rgba(184,145,47,.1);padding:12px 16px;margin:14px 0;font-size:.9rem}
  .vx-err{border-left:3px solid #c0392b;background:rgba(192,57,43,.08);padding:12px 16px;margin:14px 0}
  .vx-note{color:var(--mut);font-size:.85rem;margin-top:14px}
  .vx-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:10px 0 18px}
  .vx-kpi div{border:1px solid var(--line);border-radius:6px;padding:12px}.vx-kpi b{display:block;font:600 1.3rem var(--serif);color:var(--goldt)}.vx-kpi small{color:var(--mut)}
  .vx-fm{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
  .vx-load{padding:30px;color:var(--mut)}`;
  document.head.appendChild(css);

  /* ---------- tính toán ---------- */
  const PAL = ['#0B2545', '#B8912F', '#5B7DB1', '#7F9C6A', '#A5524A', '#6B5B95', '#2A9D8F', '#E07A5F', '#8D99AE', '#BC6C25', '#264653', '#C9A24A'];
  function analyze(data, tickers, o) {
    const { mu, cov, n } = VX.stats(data.prices, tickers);
    const rf = o.rf / 100, wmin = o.wmin / 100;
    const k = Math.min(o.k, tickers.length);
    const sc = Math.min(40, Math.max(10, o.score));
    const A = o.A > 0 ? o.A : VX.scoreToA(sc).A;
    const subsets = VX.bestSubset(tickers, mu, cov, rf, k, wmin);
    return { tickers, mu, cov, n, rf, wmin, k, A, subsets, capital: o.capital, months: data.months || {} };
  }
  function finalize(a, subsets) {
    const best = subsets[0];
    const p = { e: best.e, sd: best.sd };
    return { best, C: VX.complete(p, a.rf, a.A) };
  }

  /* ---------- hiển thị ---------- */
  function scatter(a, best, C) {
    const W = 560, H = 330, m = { l: 48, r: 16, t: 14, b: 40 };
    const pts = a.tickers.map((t, i) => ({ t, x: Math.sqrt(a.cov[i][i]), y: a.mu[i] }));
    const xmax = Math.max(...pts.map(p => p.x), best.sd) * 1.15, ys = [...pts.map(p => p.y), best.e, a.rf, C.e];
    const ymin = Math.min(...ys, 0) - .01, ymax = Math.max(...ys) + .02;
    const X = v => m.l + v / xmax * (W - m.l - m.r), Y = v => H - m.b - (v - ymin) / (ymax - ymin) * (H - m.t - m.b);
    const sh = (best.e - a.rf) / best.sd;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ rủi ro và lợi nhuận" style="width:100%;max-width:${W}px;font:11px var(--sans)">`;
    for (let g = 0; g <= 4; g++) { const v = ymin + (ymax - ymin) * g / 4; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" fill="var(--mut)">${(v * 100).toFixed(0)}%</text>`; }
    for (let g = 0; g <= 4; g++) { const v = xmax * g / 4; s += `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle" fill="var(--mut)">${(v * 100).toFixed(0)}%</text>`; }
    s += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" fill="var(--mut)">Độ lệch chuẩn σ (năm)</text>`;
    s += `<line x1="${X(0)}" y1="${Y(a.rf)}" x2="${X(xmax)}" y2="${Y(a.rf + sh * xmax)}" stroke="#B8912F" stroke-width="2"/>`;
    pts.forEach(p => { s += `<rect x="${X(p.x) - 4}" y="${Y(p.y) - 4}" width="8" height="8" fill="none" stroke="var(--ink)"/><text x="${X(p.x) + 8}" y="${Y(p.y) + 4}" fill="var(--ink)">${esc(p.t)}</text>`; });
    s += `<polygon points="${X(best.sd)},${Y(best.e) - 8} ${X(best.sd) + 7},${Y(best.e) + 6} ${X(best.sd) - 7},${Y(best.e) + 6}" fill="#B8912F"/><text x="${X(best.sd) + 10}" y="${Y(best.e) - 6}" fill="var(--goldt)" font-weight="600">ORP</text>`;
    s += `<circle cx="${X(C.sd)}" cy="${Y(C.e)}" r="6" fill="#0B2545" stroke="#fff"/><text x="${X(C.sd) + 10}" y="${Y(C.e) + 16}" fill="var(--ink)" font-weight="600">OCP</text></svg>`;
    return s;
  }
  function view(a, opts = {}) {
    const { best, C } = finalize(a, a.subsets);
    const warn = [];
    a.tickers.forEach((t, i) => { if (a.mu[i] < a.rf) warn.push(`${t} có lợi suất lịch sử (${pct(a.mu[i])}) thấp hơn lãi suất phi rủi ro (${pct(a.rf)}), nên khó được chọn.`); });
    a.tickers.forEach(t => { if (a.months[t] && a.months[t] < 36) warn.push(`${t} chỉ có ${a.months[t]} tháng dữ liệu, kết quả kém tin cậy.`); });
    if (C.y >= 0.999) warn.push('Hệ số A thấp khiến toàn bộ vốn dồn vào danh mục cổ phiếu (y* = 100%).');
    if (C.y <= 0.001) warn.push('Danh mục rủi ro có lợi suất không vượt lãi suất phi rủi ro, nên khuyến nghị giữ toàn bộ ở tài sản phi rủi ro.');
    let h = '';
    h += `<div class="vx-card"><h3>1. Đánh giá từng cổ phiếu (${a.n} tháng)</h3><div class="vx-sc"><table class="vx-t"><tr><th>Mã</th><th>E(R)</th><th>σ</th><th>Sharpe</th></tr>${a.tickers.map((t, i) => { const sd = Math.sqrt(a.cov[i][i]); return `<tr><td>${esc(t)}</td><td>${pct(a.mu[i])}</td><td>${pct(sd)}</td><td>${((a.mu[i] - a.rf) / sd).toFixed(4)}</td></tr>`; }).join('')}</table></div><p class="vx-note">E(R) = trung bình lợi suất tháng × 12; σ = độ lệch chuẩn mẫu × √12; lãi suất phi rủi ro ${pct(a.rf)}.</p></div>`;
    h += `<div class="vx-card" style="grid-column:1/-1"><h3>2. Danh mục rủi ro tối ưu (ORP)</h3><p>Chọn ${a.k} trong ${a.tickers.length} mã, tỷ trọng mỗi mã ≥ ${(a.wmin * 100).toFixed(0)}%, không bán khống; chọn tổ hợp có Sharpe lớn nhất.</p><div class="vx-sc"><table class="vx-t"><tr><th>Tổ hợp</th><th>Tỷ trọng</th><th>E(Rp)</th><th>σp</th><th>Sharpe</th></tr>${a.subsets.slice(0, 5).map((r, i) => `<tr class="${i ? '' : 'best'}"><td>${r.tickers.map(esc).join(', ')}</td><td>${r.w.map(x => (x * 100).toFixed(2) + '%').join(' / ')}</td><td>${pct(r.e)}</td><td>${pct(r.sd)}</td><td>${r.sharpe.toFixed(4)}</td></tr>`).join('')}</table></div><p class="vx-note">Hiển thị tối đa 5 tổ hợp tốt nhất trong ${a.subsets.length} tổ hợp. Tỷ trọng theo thứ tự các mã ở cột Tổ hợp.</p></div>`;
    h += `<div class="vx-card" style="grid-column:1/-1"><h3>3. Danh mục hoàn thiện tối ưu (OCP), A = ${a.A.toFixed(2)}</h3><div class="vx-kpi"><div><b>${pct(C.y)}</b><small>vào danh mục rủi ro</small></div><div><b>${pct(C.rfWeight)}</b><small>vào tài sản phi rủi ro</small></div><div><b>${pct(C.e)}</b><small>lợi suất kỳ vọng</small></div><div><b>${pct(C.sd)}</b><small>độ lệch chuẩn</small></div><div><b>${pct(C.U)}</b><small>độ thỏa dụng U</small></div></div>`;
    const parts = [['Tài sản phi rủi ro', C.rfWeight], ...best.tickers.map((t, i) => [t, C.y * best.w[i]])];
    h += `<div class="vx-bar" role="img" aria-label="Cơ cấu danh mục">${parts.map((p, i) => `<span style="width:${p[1] * 100}%;background:${PAL[i % PAL.length]}" title="${esc(p[0])} ${pct(p[1])}">${p[1] > .06 ? esc(p[0]) : ''}</span>`).join('')}</div>`;
    h += `<div class="vx-sc"><table class="vx-t"><tr><th>Tài sản</th><th>% tổng vốn</th><th>% trong ORP</th><th>Số tiền (VND)</th></tr>${parts.map((p, i) => `<tr><td>${esc(p[0])}</td><td>${pct(p[1])}</td><td>${i ? pct(best.w[i - 1]) : ''}</td><td>${vnd(p[1] * a.capital)}</td></tr>`).join('')}<tr><td><b>Tổng</b></td><td>100%</td><td></td><td><b>${vnd(a.capital)}</b></td></tr></table></div>`;
    h += `<div style="margin-top:20px">${scatter(a, best, C)}</div></div>`;
    return (warn.length ? `<div class="vx-warn" style="grid-column:1/-1">${warn.map(esc).join('<br>')}</div>` : '') + h +
      `<div class="vx-note" style="grid-column:1/-1">Kết quả tính từ dữ liệu quá khứ (lợi suất và tương quan có thể thay đổi), chỉ nhằm mục đích học tập và minh họa, không phải lời khuyên đầu tư. Bỏ qua phí giao dịch và thuế.</div>`;
  }

  /* ---------- tối ưu (Web Worker, dự phòng luồng chính) ---------- */
  let workerSrc = null;
  async function optimize(a) {
    const run = () => VX.bestSubset(a.tickers, a.mu, a.cov, a.rf, a.k, a.wmin);
    if (typeof Worker === 'undefined') return run();
    try {
      workerSrc = workerSrc || await (await fetch('optimizer.js')).text();
      const url = URL.createObjectURL(new Blob([workerSrc + ';onmessage=e=>{const d=e.data;postMessage(VX.bestSubset(d.t,d.mu,d.cov,d.rf,d.k,d.wmin))}'], { type: 'text/javascript' }));
      return await new Promise((ok, no) => {
        const w = new Worker(url);
        w.onmessage = e => { w.terminate(); URL.revokeObjectURL(url); ok(e.data); };
        w.onerror = err => { w.terminate(); no(err); };
        w.postMessage({ t: a.tickers, mu: a.mu, cov: a.cov, rf: a.rf, k: a.k, wmin: a.wmin });
      });
    } catch { return run(); }
  }
  const nCk = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

  /* ---------- trang: khách hàng mẫu ---------- */
  const formHTML = (v, withA = true) => `<form class="fm vx-card" id="vx-form" style="grid-column:1/-1" novalidate><h3>Tham số</h3><div class="vx-fm">
    <label>Điểm khảo sát (10–40)<input name="score" type="number" min="10" max="40" step="1" value="${v.score}"></label>
    <label>Hoặc nhập trực tiếp A<input name="A" type="number" min="0.5" max="30" step="0.01" placeholder="để trống = tính từ điểm"></label>
    <label>Lãi suất phi rủi ro (%/năm)<input name="rf" type="number" min="0" max="20" step="0.01" value="${v.rf}"></label>
    <label>Tỷ trọng tối thiểu mỗi mã (%)<input name="wmin" type="number" min="0" max="25" step="1" value="${v.wmin}"></label>
    <label>Số cổ phiếu trong danh mục<input name="k" type="number" min="2" max="10" step="1" value="${v.k}"></label>
    <label>Vốn đầu tư (VND)<input name="capital" type="number" min="1000000" step="1000000" value="${v.capital}"></label></div>
    <p class="vx-note" id="vx-a"></p></form>`;
  function readForm(form) {
    const f = form.elements, num = n => parseFloat(f[n].value);
    const o = { score: num('score') || 21, A: num('A') || 0, rf: num('rf'), wmin: num('wmin'), k: Math.round(num('k')), capital: num('capital') };
    if (!(o.rf >= 0) || !(o.wmin >= 0) || !(o.k >= 2) || !(o.capital > 0)) return null;
    return o;
  }
  function showA(form, o) { const A = o.A > 0 ? o.A : VX.scoreToA(Math.min(40, Math.max(10, o.score))).A; q('#vx-a').textContent = `Hệ số ngại rủi ro A = ${A.toFixed(2)}` + (o.A > 0 ? ' (nhập tay)' : ' (nội suy theo Pan & Statman 2010; cách quy đổi điểm → X là quy ước của nhóm)'); }

  async function initCase() {
    const box = q('#vx-case'); if (!box) return;
    box.innerHTML = '<div class="vx-load">Đang tải dữ liệu…</div>';
    // window.VX_CASE comes from prices_case.js so the page also works when index.html is opened from disk
    let data; try { data = window.VX_CASE || await (await fetch('prices_case.json')).json(); } catch { box.innerHTML = '<div class="vx-err">Không tải được dữ liệu.</div>'; return; }
    const T = ['VEA', 'HPG', 'REE', 'VCB', 'FPT'];
    box.innerHTML = `<div class="vx-grid"><div class="vx-card" style="grid-column:1/-1"><h3>Hồ sơ khách hàng: gia đình anh Nam và chị Nữ</h3><p>Thu nhập 65 triệu/tháng, tài sản 1.4 tỷ, nợ 450 triệu, hai con nhỏ. Mục tiêu: mua xe 800 triệu (2028), mua nhà Quận 2 và Quận 9 cũ (2033), lo học phí cho con. Điểm khảo sát rủi ro 21/40 (mức trung bình) và vốn đầu tư ban đầu 320.12 triệu VND. Dữ liệu tháng 09/2021–09/2026 của 5 cổ phiếu VEA, HPG, REE, VCB, FPT.</p><p class="vx-note">Đây là tình huống mô phỏng của bài tập nhóm, không phải khách hàng thật.</p></div>${formHTML(DEFAULT)}<div id="vx-out" style="display:contents"></div></div>`;
    const form = q('#vx-form'), out = q('#vx-out');
    const go = () => { const o = readForm(form); if (!o) return; showA(form, o); const a = analyze(data, T, o); out.innerHTML = view(a); };
    form.addEventListener('input', go); form.addEventListener('submit', e => e.preventDefault()); go();
  }

  /* ---------- trang: công cụ chọn mã ---------- */
  async function initTool() {
    const box = q('#vx-tool'); if (!box) return;
    let symbols = []; try { symbols = await (await fetch('symbols.json')).json(); } catch { }
    const picked = new Set();
    box.innerHTML = `<div class="vx-grid"><div class="vx-card" style="grid-column:1/-1"><h3>Chọn cổ phiếu bạn quan tâm</h3>
      <div class="fm"><label>Tìm mã hoặc tên công ty (chọn từ gợi ý, hoặc gõ mã bất kỳ)<input id="vx-q" list="vx-dl" autocomplete="off" placeholder="Ví dụ: FPT, Vietcombank"></label></div>
      <datalist id="vx-dl">${symbols.map(s => `<option value="${esc(s[0])}">${esc(s[1])} · ${esc(s[2])}</option>`).join('')}</datalist>
      <div class="vx-chips" id="vx-chips"></div><button class="btn btn-navy" id="vx-add" type="button">Thêm mã</button>
      <p class="vx-note" id="vx-hint">Chọn từ 2 đến 12 mã (tối ưu hóa cần vài giây khi chọn nhiều mã).</p></div>${formHTML(DEFAULT)}
      <div class="vx-card" style="grid-column:1/-1"><button class="btn btn-gold" id="vx-run" type="button">Tạo danh mục tối ưu</button><div id="vx-status" class="vx-note"></div></div><div id="vx-out" style="display:contents"></div></div>`;
    const chips = q('#vx-chips'), status = q('#vx-status'), form = q('#vx-form');
    const draw = () => { chips.innerHTML = [...picked].map(t => `<span class="vx-chip">${esc(t)}<button type="button" data-t="${esc(t)}" aria-label="Bỏ ${esc(t)}">×</button></span>`).join(''); };
    const add = () => {
      const inp = q('#vx-q'), t = inp.value.trim().toUpperCase().split(/[\s·]/)[0];
      if (!TICKER.test(t)) { status.textContent = 'Mã không hợp lệ (3–4 ký tự chữ/số).'; return; }
      if (picked.size >= 12) { status.textContent = 'Tối đa 12 mã.'; return; }
      picked.add(t); inp.value = ''; status.textContent = ''; draw();
    };
    q('#vx-add').onclick = add; q('#vx-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    chips.addEventListener('click', e => { const t = e.target.dataset && e.target.dataset.t; if (t) { picked.delete(t); draw(); } });
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', () => { const o = readForm(form); if (o) showA(form, o); });
    { const o = readForm(form); showA(form, o); }
    q('#vx-run').onclick = async () => {
      const out = q('#vx-out'), o = readForm(form), tk = [...picked];
      if (!o) { status.textContent = 'Kiểm tra lại các tham số.'; return; }
      if (tk.length < 2) { status.textContent = 'Hãy chọn ít nhất 2 mã.'; return; }
      if (o.k > tk.length) o.k = tk.length;
      if (o.k * o.wmin > 100) { status.textContent = 'Tỷ trọng tối thiểu × số mã vượt 100%.'; return; }
      if (nCk(tk.length, o.k) > 1500) { status.textContent = 'Quá nhiều tổ hợp, hãy giảm số mã hoặc số cổ phiếu trong danh mục.'; return; }
      out.innerHTML = ''; status.textContent = 'Đang lấy dữ liệu giá…';
      const noServer = 'Công cụ cần máy chủ để lấy giá. Hãy bấm đúp file chay-web.bat (hoặc chạy "netlify dev") rồi mở http://localhost:8888/#/cong-cu-danh-muc.';
      let data;
      try {
        if (location.protocol === 'file:') throw new Error(noServer);
        const r = await fetch('api/prices?tickers=' + encodeURIComponent(tk.join(',')));
        try { data = await r.json(); } catch { throw new Error(r.status === 404 ? noServer : 'Lỗi dữ liệu (HTTP ' + r.status + ')'); }
        if (!r.ok) throw new Error(data.error || 'Lỗi dữ liệu');
      } catch (err) { const C = window.VX_CASE; if (C && tk.every(t => C.prices[t])) { data = { dates: C.dates, prices: Object.fromEntries(tk.map(t => [t, C.prices[t]])), source: 'dữ liệu bài nhóm (09/2021–09/2026)' }; } else { status.textContent = ''; out.innerHTML = `<div class="vx-err" style="grid-column:1/-1">${esc(err.message === 'Failed to fetch' ? noServer : err.message)}</div>`; return; } }
      status.textContent = 'Đang tối ưu…';
      const a = analyze(data, tk, o); a.subsets = await optimize(a);
      if (!a.subsets.length) { status.textContent = ''; out.innerHTML = '<div class="vx-err" style="grid-column:1/-1">Không có tổ hợp nào thỏa ràng buộc.</div>'; return; }
      status.textContent = `Dữ liệu ${data.dates[0]} đến ${data.dates[data.dates.length - 1]} (${data.dates.length} tháng), nguồn: ${data.source}.`;
      out.innerHTML = view(a);
    };
  }

  /* ---------- đăng ký trang ---------- */
  const sec = id => `<section><div class="wrap" id="${id}"></div></section>`;
  Object.assign(R, { 'khach-hang-mau': ['vxcase', 'Khách hàng mẫu'], 'cong-cu-danh-muc': ['vxtool', 'Công cụ danh mục'] });
  pages.vxcase = () => head('Khách hàng mẫu', 'Case study', 'Danh mục tối ưu cho gia đình anh Nam và chị Nữ', 'Từ khảo sát rủi ro đến danh mục rủi ro tối ưu (ORP) và danh mục hoàn thiện tối ưu (OCP), tính trực tiếp trên dữ liệu thật của bài nhóm.') + sec('vx-case');
  pages.vxtool = () => head('Công cụ danh mục', 'Công cụ', 'Tự chọn cổ phiếu, nhận danh mục tối ưu', 'Chọn các mã bạn quan tâm. Vixelia lấy dữ liệu giá lịch sử, tìm tổ hợp có Sharpe cao nhất và dựng danh mục hoàn thiện theo mức ngại rủi ro của bạn.') + sec('vx-tool');
  L.splice(5, 0, ['khach-hang-mau', 'Khách hàng mẫu'], ['cong-cu-danh-muc', 'Công cụ']);
  q('#lk').innerHTML = L.map(l => `<a href="#/${l[0]}" data-r="${l[0]}">${l[1]}</a>`).join('') + `<a class="btn btn-gold" href="#/lien-he">Đặt lịch tư vấn</a>`;
  const mount = () => { const h = location.hash.replace(/^#\/?/, '').replace(/\/$/, ''); if (h === 'khach-hang-mau') initCase(); if (h === 'cong-cu-danh-muc') initTool(); };
  addEventListener('hashchange', mount);
  route(); mount();
  window.__vx = { analyze, view, finalize };
})();
