/* Tokenized Stock Observatory: renders the files in site/data/. No build step; Chart.js is vendored. */
"use strict";
(() => {
  const SESS = ["RTH", "PRE", "POST", "OVERNIGHT", "CLOSED"];
  const LABEL = { RTH: "Regular hours", PRE: "Pre-market", POST: "After-hours", OVERNIGHT: "Overnight", CLOSED: "Closed" };
  const HOURS = { RTH: "09:30 to 16:00", PRE: "04:00 to 09:30", POST: "16:00 to 20:00", OVERNIGHT: "20:00 to 04:00", CLOSED: "weekends and holidays" };
  const VAR = { RTH: "--rth", PRE: "--pre", POST: "--post", OVERNIGHT: "--ovn", CLOSED: "--closed" };
  const FAMILY = {
    xstocks: "xStocks", ondo: "Ondo Global Markets", bstocks: "bStocks", robinhood: "Robinhood",
    coinbase: "Coinbase stock tokens", dinari: "Dinari", backpack: "Backpack", other: "Other issuers",
  };
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const PALETTE = {
    light: ["#2F5F8F", "#3E8E7E", "#8F82C2", "#B5523B", "#7FA6C6", "#4C3D8C", "#6B7F2A", "#9C6B98", "#5B6B78", "#2E7D9A", "#A3A9B0"],
    dark: ["#5C8FC4", "#5FB3A1", "#ABA0DA", "#D9826C", "#9DBCD6", "#7A6CC4", "#9DB35A", "#C495C0", "#8D9DAB", "#5BAAC6", "#6F7A85"],
  };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const darkMode = () => {
    const forced = document.documentElement.dataset.theme;
    return forced ? forced === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  const sum = (arr) => arr.reduce((a, b) => a + (fin(b) ? b : 0), 0);

  function usd(v) {
    if (!fin(v)) return "n/a";
    const a = Math.abs(v);
    const f = (x, d) => x.toFixed(d).replace(/\.0+$/, "");
    if (a >= 1e12) return `$${f(v / 1e12, 2)}T`;
    if (a >= 1e9) return `$${f(v / 1e9, a >= 1e10 ? 1 : 2)}B`;
    if (a >= 1e6) return `$${f(v / 1e6, a >= 1e8 ? 0 : 1)}M`;
    if (a >= 1e3) return `$${f(v / 1e3, a >= 1e5 ? 0 : 1)}K`;
    return `$${v.toFixed(0)}`;
  }
  const pct = (v, d = 0) => (fin(v) ? `${(v * 100).toFixed(d)}%` : "n/a");
  const bp = (v) => (fin(v) ? `${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)} bp` : "n/a");
  const fix = (v, d = 2) => (fin(v) ? v.toFixed(d) : "n/a");
  const parts = (iso) => iso.split("-").map(Number);
  const shortDate = (iso) => { const [, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]}`; };
  const longDate = (iso) => { const [y, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const weekday = (iso) => WEEKDAY[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  const slotTime = (s) => `${String(Math.floor(s / 2) % 24).padStart(2, "0")}:${s % 2 ? "30" : "00"}`;
  function rgba(hex, a) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const D = {};
  const sampleFromUrl = new URLSearchParams(location.search).get("sample");
  const ui = { week: "token", daily: "usd", range: "all", venueRange: "all", tickerRange: "all", venue: "families", query: "", sort: { key: "token", dir: -1 }, ticker: null, tickerLimit: "10", sample: ["shared", "expanded"].includes(sampleFromUrl) ? sampleFromUrl : "all" };
  const charts = {};

  async function load(name) {
    const r = await fetch(`data/${name}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return r.json();
  }

  /* ---------- Chart.js ---------- */
  const markers = {
    id: "markers",
    afterDatasetsDraw(chart, _args, opts) {
      const items = (opts && opts.items) || [];
      const x = chart.scales.x;
      if (!items.length || !x) return;
      const { ctx, chartArea } = chart;
      const labels = chart.data.labels || [];
      ctx.save();
      for (const m of items) {
        const i = labels.indexOf(m.date);
        if (i < 0) continue;
        const step = labels.length > 1 ? x.getPixelForValue(1) - x.getPixelForValue(0) : 0;
        const px = x.getPixelForValue(i) - step / 2;
        ctx.strokeStyle = css("--ink");
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, chartArea.top);
        ctx.lineTo(px, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = css("--ink");
        ctx.font = `500 11px ${css("--font")}`;
        const fits = px + 6 + ctx.measureText(m.label).width < chartArea.right;
        ctx.textAlign = fits ? "left" : "right";
        ctx.fillText(m.label, fits ? px + 6 : px - 6, chartArea.top + 12);
      }
      ctx.restore();
    },
  };

  function chartDefaults() {
    Chart.defaults.font.family = css("--font");
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css("--muted");
    Chart.defaults.borderColor = css("--faint");
    // Controls rebuild charts in place. Animating that replacement can leave a queued
    // Chart.js frame pointing at the chart that was just destroyed, producing a blank
    // canvas on fast (or load-adjacent) clicks. Immediate redraws are clearer here.
    Chart.defaults.animation = false;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: css("--ink"), titleColor: css("--bg"), bodyColor: css("--bg"), footerColor: css("--bg"),
      padding: 10, cornerRadius: 4, boxPadding: 4,
    });
  }

  function make(id, config) {
    if (charts[id]) {
      charts[id].stop();
      charts[id].destroy();
    }
    charts[id] = new Chart($(`#${id}`), config);
  }

  const dateAxis = () => ({
    stacked: true,
    grid: { display: false },
    ticks: { autoSkip: true, maxTicksLimit: 9, maxRotation: 0, callback(v) { return shortDate(this.getLabelForValue(v)); } },
  });
  const dateTitle = (items) => `${weekday(items[0].label)} ${longDate(items[0].label)}`;
  const topDown = (a, b) => b.datasetIndex - a.datasetIndex;

  function pressed(group, value) {
    $$(`[data-${group}]`).forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute(`data-${group}`) === value)));
  }

  function rangeStart(dates, range) {
    if (range === "all") return 0;
    return Math.max(0, dates.length - Number(range));
  }

  function rangeLabel(dates, range) {
    if (!dates.length) return "No dates";
    const i = rangeStart(dates, range);
    return `${range === "all" ? "All history · " : ""}${longDate(dates[i])} to ${longDate(dates[dates.length - 1])}`;
  }

  /* ---------- Header, week grid, summary ---------- */
  function renderStamp() {
    const m = D.meta;
    $("#demo-banner").hidden = !m.demo;
    const t = new Date(m.generated_at);
    const two = (n) => String(n).padStart(2, "0");
    const when = `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${two(t.getUTCHours())}:${two(t.getUTCMinutes())} UTC`;
    const span = m.first_date ? `, covering ${longDate(m.first_date)} to ${longDate(m.last_date)}` : "";
    $("#stamp").textContent = m.demo ? `Synthetic demo data built ${when}${span}.` : `Dashboard built ${when}${span}.`;
  }

  function renderLegend() {
    $("#legend").innerHTML = SESS.map((s) =>
      `<li><span class="sw" style="background:var(${VAR[s]})"></span><b>${LABEL[s]}</b><span class="h">${HOURS[s]}</span></li>`).join("");
  }

  function renderOverview() {
    const m = D.meta;
    const k = m.kpis || {};
    const span = m.first_date && m.last_date
      ? `${Math.floor((new Date(`${m.last_date}T12:00:00Z`) - new Date(`${m.first_date}T12:00:00Z`)) / 86400000) + 1} days`
      : "No history";
    const items = [
      [span, "Historical span"],
      [usd(k.token_total || 0), "Recorded secondary-market volume"],
      [pct(k.outside_rth_share), "Volume outside regular US hours"],
      [String(D.tickers.rows.length), "Underlying securities with recorded token trades"],
    ];
    $("#kpi-grid").innerHTML = items.map(([value, label]) =>
      `<div class="kpi"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`).join("");
    const history = m.history || {};
    const tokenDates = history.token_dates || 0;
    const stockDates = history.stock_dates || 0;
    const latestStockDate = D.daily.dates.filter((_, i) =>
      SESS.some((session) => D.daily.stock[session][i] > 0)).pop();
    const source = (m.sources || []).find((s) => s.id === "stocks");
    const notes = [`Token trades appear on ${tokenDates} calendar dates.`];
    if (stockDates && latestStockDate) {
      notes.push(`The US stock feed recorded volume for ${source?.tickers?.length || 0} securities across ${stockDates} dates through ${longDate(latestStockDate)}. Of these, ${D.daily.offhours.tickers} also had token trades in the archive.`);
    } else {
      notes.push("The current dataset contains no recorded US stock volume.");
    }
    if (source?.ok === false) {
      notes.push(source.error?.includes("ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY not set")
        ? "The latest refresh skipped US stocks because the collection job lacked Alpaca credentials."
        : "The latest Alpaca refresh failed. See Sources for details.");
    }
    for (const feed of m.sources || []) {
      if (feed.id !== "stocks" && feed.ok === false && feed.last_date) {
        notes.push(`${feed.label} last recorded volume on ${longDate(feed.last_date)}. Its latest collection failed.`);
      }
    }
    $("#overview-note").textContent = notes.join(" ");
  }

  function renderWeek() {
    const w = D.week;
    if (!w) return;
    const stockAvailable = (D.meta.kpis || {}).stock_total > 0;
    const stockButton = $('[data-week="stock"]');
    stockButton.disabled = !stockAvailable;
    stockButton.title = stockAvailable ? "" : "Requires Alpaca stock data";
    if (!stockAvailable && ui.week === "stock") {
      ui.week = "token";
      pressed("week", ui.week);
    }
    const grid = w[ui.week] || [];
    const cell = 14, gap = 2, left = 34, top = 20, pitch = cell + gap;
    let max = 0;
    for (const row of grid) for (const v of row) if (v > max) max = v;
    const color = Object.fromEntries(SESS.map((s) => [s, css(VAR[s])]));
    const faint = css("--faint");
    const out = [];
    for (const s of [0, 8, 19, 32, 40]) out.push(`<text x="${left + s * pitch}" y="${top - 7}">${slotTime(s)}</text>`);
    for (let d = 0; d < 7; d++) {
      const y = top + d * pitch;
      out.push(`<text x="0" y="${y + cell - 3}">${DAYS[d]}</text>`);
      for (let s = 0; s < 48; s++) {
        const v = (grid[d] || [])[s] || 0;
        const sess = SESS[w.template[d][s]];
        const a = max > 0 && v > 0 ? 0.14 + 0.86 * Math.sqrt(v / max) : 0;
        const fill = a ? `fill="${color[sess]}" fill-opacity="${a.toFixed(3)}"` : `fill="${faint}"`;
        out.push(`<rect x="${left + s * pitch}" y="${y}" width="${cell}" height="${cell}" rx="2" ${fill}>` +
          `<title>${DAYS[d]} ${slotTime(s)} to ${slotTime(s + 1)} ET, ${LABEL[sess].toLowerCase()}: ${usd(v)} on average</title></rect>`);
      }
    }
    out.push(`<rect class="open-box" x="${left + 19 * pitch - 1.5}" y="${top - 1.5}" width="${13 * pitch + 1}" height="${5 * pitch + 1}" rx="3"/>`);
    const svg = $("#week-grid");
    svg.setAttribute("viewBox", `0 0 ${left + 48 * pitch} ${top + 7 * pitch}`);
    svg.innerHTML = out.join("");
    const market = ui.week === "token" ? "tokenized stocks" : `the ${D.meta.sources.find(s => s.id === "stocks")?.tickers?.length || 0} securities observed on the US consolidated tape`;
    $("#week-note").textContent = `Average recorded dollar volume for ${market} by New York half hour across all ${w.days} calendar days. Darker cells show more volume. Cells use local calendar dates. Colors and the regular-hours outline follow a typical non-holiday week.` +
      (ui.week === "stock" ? " Overnight coverage on the consolidated tape is incomplete in this dataset." : "");
  }

  function renderSummary() {
    const k = D.meta.kpis;
    if (!k || !fin(k.token_total) || k.token_total <= 0) {
      $("#summary").textContent = "No token volume recorded yet.";
      return;
    }
    const out = [`From ${longDate(k.start)} to ${longDate(k.end)}, tokens traded <strong>${usd(k.token_total)}</strong>. Of that volume, <strong>${pct(k.outside_rth_share)}</strong> traded outside regular hours and <strong>${pct(k.closed_share)}</strong> during scheduled US equity closures.`];
    if (fin(k.ratio_bp) && k.stock_total > 0) {
      const r = k.ratio_bp_by_session || {};
      out.push(`Token volume as a share of the same stocks' dollar volume: <strong>${bp(k.ratio_bp)}</strong> overall, ${bp(r.RTH)} regular hours, ${bp(r.PRE)} pre-market and ${bp(r.POST)} after-hours.`);
    } else {
      out.push("The archive has no comparable US stock volume.");
    }
    if (k.token_other > 0) out.push(`DEX pools pairing stock tokens with memecoins traded another ${usd(k.token_other)}, not counted above.`);
    $("#summary").innerHTML = out.join(" ");
  }

  /* ---------- Daily, mix, venues ---------- */
  function renderDaily() {
    const d = D.daily;
    const start = rangeStart(d.dates, ui.range);
    const dates = d.dates.slice(start);
    const share = ui.daily === "share";
    const totals = dates.map((_, j) => SESS.reduce((a, s) => a + (d.token[s][start + j] || 0), 0));
    const datasets = SESS.map((s) => ({
      label: LABEL[s], backgroundColor: css(VAR[s]), borderWidth: 0, barPercentage: 0.9, categoryPercentage: 0.94,
      data: d.token[s].slice(start).map((v, i) => (share ? (totals[i] ? (v / totals[i]) * 100 : 0) : v)),
    }));
    make("daily-chart", {
      type: "bar",
      data: { labels: dates, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: dateAxis(), y: { stacked: true, max: share ? 100 : undefined, ticks: { callback: (v) => (share ? `${v}%` : usd(v)) } } },
        plugins: {
          markers: { items: D.meta.events || [] },
          tooltip: {
            itemSort: topDown,
            callbacks: {
              title: dateTitle,
              label: (c) => ` ${c.dataset.label}: ${share ? `${c.parsed.y.toFixed(1)}%` : usd(c.parsed.y)}`,
              footer: (items) => (share ? "" : `Total ${usd(totals[items[0].dataIndex])}`),
            },
          },
        },
      },
    });
    $("#daily-note").textContent = `${rangeLabel(d.dates, ui.range)}. Overnight trading from 20:00 ET counts toward the next trading date; weekends and holidays retain their own dates.`;
  }

  function renderTrend() {
    const {dates, offhours, us_trading_day} = D.daily;
    const range = $("#trend-range").value;
    const stockKey = $("#trend-stock").value;
    const stockLabel = stockKey === "stock_off" ? "Off-hours US stock volume" : "All-session US stock volume";
    const start = rangeStart(dates, range);
    const trading = [];
    dates.forEach((date, index) => {
      if (!us_trading_day[index]) return;
      const token = offhours.token[index], stock = offhours[stockKey][index];
      trading.push({date, index, token, stock, comparable: token > 0 && stock > 0});
    });
    // Compute the trailing share before clipping so changing the visible range
    // preserves values on dates in common. Missing sessions interrupt the trend.
    const rolling = trading.map((_, i) => {
      if (i < 4) return null;
      const five = trading.slice(i - 4, i + 1);
      return five.every(day => day.comparable)
        ? 100 * sum(five.map(day => day.token)) / sum(five.map(day => day.stock)) : null;
    });
    const shown = trading.filter(day => day.index >= start);
    const comparable = shown.filter(day => day.comparable);
    const tokenSum = sum(comparable.map(day => day.token)), stockSum = sum(comparable.map(day => day.stock));
    const formatShare = value => pct(value / 100, 3);
    const series = (label, data, color, width, radius) => ({label, data,
      borderColor: color, backgroundColor: color, borderWidth: width, pointRadius: radius,
      pointHoverRadius: 4, spanGaps: false});
    const datasets = [
      series("5-trading-day share", rolling.slice(trading.length - shown.length), css("--ovn"), 3, 0),
      series("Daily share", shown.map(day => day.comparable ? 100 * day.token / day.stock : null), css("--muted"), 1, 2)
    ];
    make("trend-chart", {type: "line", data: {labels: shown.map(day => day.date), datasets}, options: {
      interaction: {mode: "index", intersect: false},
      scales: {x: {...dateAxis(), stacked: false}, y: {beginAtZero: true, ticks: {callback: formatShare}}},
      plugins: {legend: {display: true, position: "bottom"}, tooltip: {callbacks: {
        title: dateTitle, label: c => ` ${c.dataset.label}: ${formatShare(c.parsed.y)}`,
        afterBody: items => {
          const day = shown[items[0].dataIndex];
          return [`Token volume: ${usd(day.token)}`, `${stockLabel}: ${usd(day.stock)}`];
        }
      }}}
    }});
    $("#trend-summary").textContent = stockSum > 0
      ? `${rangeLabel(dates, range)}. Off-hours token volume was ${pct(tokenSum / stockSum, 3)} of ${stockLabel.toLowerCase()} across ${comparable.length} trading dates with volume in both feeds (${usd(tokenSum)} / ${usd(stockSum)}).`
      : "No trading dates with comparable volume in this range.";
  }

  function renderProtocol() {
    const rows = D.daily.ondo_protocol || [];
    const status = D.meta.protocol_status;
    if (!rows.length) {
      $("#protocol-note").textContent = "No verified protocol history has been collected.";
      $("#protocol-chart").parentElement.hidden = true;
      return;
    }
    const byDate = new Map(rows.map(r => [r.utc_date, r]));
    const last = rows[rows.length - 1].utc_date;
    const range = $("#protocol-range").value;
    const column = $("#protocol-chain").value;
    const dayMs = 86400000;
    const start = range === "all" ? Date.parse(rows[0].utc_date) :
        Math.max(Date.parse(rows[0].utc_date), Date.parse(last) - (Number(range) - 1) * dayMs);
    const dates = [], values = [];
    for (let t = start; t <= Date.parse(last); t += dayMs) {
      const day = new Date(t).toISOString().slice(0, 10);
      dates.push(day);
      values.push(byDate.get(day)?.[column] ?? null);
    }
    const observed = values.filter(n => n != null);
    const label = $("#protocol-chain").selectedOptions[0].textContent;
    const description = observed.length ? `${label} recorded ${usd(sum(observed))} across ${observed.length} reported days.` : `No daily observations for ${label} in this period.`;
    $("#protocol-note").textContent = `${longDate(dates[0])} to ${longDate(last)} UTC. ${description} Gaps indicate unavailable observations.` +
      (status?.ok === false ? " The latest refresh failed; this is the last verified series." : "");
    $("#protocol-download").innerHTML = ' · <a href="data/ondo_protocol.csv">Daily protocol volume (CSV)</a>';
    make("protocol-chart", {type:"line", data:{labels:dates, datasets:[{label, data:values, spanGaps:false,
      borderColor:css("--ovn"), borderWidth:2, pointRadius:0}]}, options:{scales:{
      x:{...dateAxis(), stacked:false}, y:{beginAtZero:true, ticks:{callback:v=>usd(v)}}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{title:dateTitle, label:c=>usd(c.parsed.y)}}}}});
  }

  function renderMix() {
    const k = D.meta.kpis || {};
    const st = k.share_token || {}, ss = k.share_stock || {}, rb = k.ratio_bp_by_session || {};
    const hasStock = k.stock_total > 0;
    const datasets = SESS.map((s) => ({
      label: LABEL[s], backgroundColor: css(VAR[s]), borderWidth: 0, barPercentage: 0.72,
      data: [(st[s] || 0) * 100].concat(hasStock ? [(ss[s] || 0) * 100] : []),
    }));
    make("mix-chart", {
      type: "bar",
      data: { labels: hasStock ? ["Tokens", "The stocks"] : ["Tokens"], datasets },
      options: {
        indexAxis: "y",
        scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true, grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } },
      },
    });
    const rows = SESS.map((s) => {
      const tok = (st[s] || 0) * (k.token_total || 0);
      const stk = (ss[s] || 0) * (k.stock_total || 0);
      const none = "no stock volume recorded";
      const ratio = s === "OVERNIGHT" ? "Partial stock coverage" : s === "CLOSED" ? "US market closed" : fin(rb[s]) ? bp(rb[s]) : hasStock && stk === 0 ? none : "n/a";
      return `<tr><td><span class="sw-inline" style="background:var(${VAR[s]})"></span>${LABEL[s]}</td><td>${usd(tok)}</td>` +
        `<td>${hasStock ? (stk > 0 ? usd(stk) : "none recorded") : "n/a"}</td><td>${ratio}</td></tr>`;
    });
    $("#mix-table").innerHTML = `<thead><tr><th>Session</th><th>Tokens</th><th>The stocks</th><th title="Token volume as basis points of the stocks' own dollar volume">Tokens as a share</th></tr></thead><tbody>${rows.join("")}</tbody>`;
    $("#mix-note").textContent = `All history · ${longDate(k.start)} to ${longDate(k.end)}. A basis point (bp) is a hundredth of a percent of the stocks' own dollar volume in that session, using the ${D.daily.offhours.tickers} securities observed in both feeds. The dollar columns show each feed’s full recorded volume, including US securities with no observed token trades.`;
  }

  function renderVenues() {
    const d = D.daily;
    const start = rangeStart(d.dates, ui.venueRange);
    const windowDates = d.dates.slice(start);
    const shared = ui.sample === "shared" || ui.sample === "expanded";
    const sample = d.venue_comparison;
    const byVenue = ui.venue === "venues";
    const names = D.meta.venue_labels || {};
    const firstDate = windowDates[0];
    const core = sample.matched.filter(row => row[0] >= firstDate);
    const expanded = sample.expanded.filter(row => row[0] >= firstDate);
    const matched = ui.sample === "expanded" ? expanded : core;
    const matchedDays = new Map();
    for (const [date, , , , , ticker] of matched) {
      if (!matchedDays.has(ticker)) matchedDays.set(ticker, new Set());
      matchedDays.get(ticker).add(date);
    }
    $('[data-sample="shared"]').textContent = `Four-source overlap (${new Set(core.map(r => r[5])).size} tickers)`;
    $('[data-sample="expanded"]').textContent = `Seven-source overlap (${new Set(expanded.map(r => r[5])).size} tickers)`;
    pressed("sample", ui.sample);
    let rows = shared ? matched : sample.all.filter(row => row[0] >= firstDate);
    const tickerMenu = $("#shared-ticker");
    $("#shared-ticker-label").hidden = !shared;
    if (shared) {
      const previous = tickerMenu.value;
      tickerMenu.replaceChildren(new Option("All shared tickers", ""), ...[...matchedDays.keys()].sort().map(ticker => {
        const n = matchedDays.get(ticker).size;
        return new Option(`${ticker} · ${n} matched ${n === 1 ? "date" : "dates"}`, ticker);
      }));
      if (matchedDays.has(previous)) tickerMenu.value = previous;
      if (tickerMenu.value) rows = rows.filter(r => r[5] === tickerMenu.value);
    }
    const dates = shared ? [...new Set(rows.map(r => r[0]))].sort() : windowDates;
    const positions = new Map(dates.map((date, i) => [date, i]));
    const grouped = new Map();
    for (const [date, source, family, cents, outside] of rows) {
      const product = FAMILY[family] || family;
      const name = names[source] || source;
      const venue = byVenue ? (source.startsWith("dex-") ? name : `${name} order book`) : "";
      const label = venue ? `${product} · ${venue}` : product;
      if (!grouped.has(label)) grouped.set(label, { product, venue, label, cents: Array(dates.length).fill(0), outside: 0 });
      const group = grouped.get(label);
      group.cents[positions.get(date)] += cents;
      group.outside += outside;
    }
    const entries = [...grouped.values()].map(g => ({
      ...g, data: g.cents.map(n => n / 100), total: sum(g.cents) / 100, off: g.outside / 100,
      observed: dates.filter((date, i) => g.cents[i] > 0),
    }));
    entries.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
    const pal = PALETTE[darkMode() ? "dark" : "light"];
    const datasets = entries.map((entry, i) => ({
      label: entry.label, data: entry.data, backgroundColor: pal[i % pal.length],
      borderWidth: 0, barPercentage: 0.9, categoryPercentage: 0.94,
    }));
    $("#venue-chart").setAttribute("aria-label", byVenue ? "Daily token volume by product and trading venue" : "Daily token volume by product across tracked venues");
    make("venue-chart", {
      type: "bar",
      data: { labels: dates, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: dateAxis(), y: { stacked: true, ticks: { callback: (v) => usd(v) } } },
        plugins: {
          legend: { display: true, position: "bottom", labels: { boxWidth: 10, boxHeight: 10, padding: 14 } },
          markers: { items: D.meta.events || [] },
          tooltip: { itemSort: topDown, filter: (c) => c.parsed.y > 0, callbacks: { title: dateTitle, label: (c) => ` ${c.dataset.label}: ${usd(c.parsed.y)}` } },
        },
      },
    });
    const other = sum(d.token_other.slice(start));
    const pairs = shared ? new Set(rows.map(r => r[0] + "|" + r[5])).size : 0;
    const count = shared ? new Set(rows.map(r => r[5])).size : 0;
    const explanation = shared
      ? `Each ticker had recorded trades on the same date across ${ui.sample === "expanded" ? "Binance, Kraken, Gate and tracked pools on Base, Ethereum, Solana and BNB Chain" : "the original four sources (Binance, Kraken, Coinbase pools on Base and Ondo pools on Ethereum)"}. This selection has ${count} securities, ${pairs} ticker-date matches and ${dates.length} market dates. A date qualifies on full-day volume, so venues can trade in different sessions. The off-hours share is weighted by dollars traded.`
      : "Recorded trades across all selected securities. Each product combines its covered sources. Coverage and collection start dates vary. Off-hours share is weighted by dollars traded.";
    $("#venue-note").textContent = `${rangeLabel(d.dates, ui.venueRange)}. ${explanation}` +
      (!shared && other > 0 ? ` Pools with other counterpart assets contributed a further ${usd(other)}, excluded here.` : "");
    const tableRows = entries.map(({ product, venue, total, off, observed }) =>
      `<tr><td>${esc(product)}</td>${byVenue ? `<td class="left">${esc(venue)}</td>` : ""}<td>${usd(total)}</td><td>${usd(off)}</td><td>${total ? pct(off / total, 1) : "—"}</td><td>${observed.length}</td><td>${observed.length ? longDate(observed[0]) : "—"}</td><td>${observed.length ? longDate(observed[observed.length - 1]) : "—"}</td></tr>`);
    $("#product-totals").innerHTML = `<thead><tr><th>Token product</th>${byVenue ? '<th class="left">Where it traded</th>' : ""}<th>Recorded volume</th><th>Off-hours volume</th><th>Off-hours share</th><th>Dates with volume</th><th>First in range</th><th>Latest in range</th></tr></thead><tbody>${tableRows.join("") || `<tr><td colspan="${byVenue ? 8 : 7}">No qualifying trades in this selection.</td></tr>`}</tbody>`;

  }

  /* ---------- Stocks table and detail ---------- */
  const offShare = (r) => (r.token ? 1 - r.rth / r.token : 0);
  const closedShare = (r) => (r.token ? r.closed / r.token : 0);
  function stockCell(ticker) {
    const profile = D.profiles.get(ticker);
    return `<td class="t">${esc(ticker)}${profile?.name ? `<span class="security-name">${esc(profile.name)}</span>` : ""}</td>`;
  }

  const COLS = [
    { key: "t", label: "Stock", get: (r) => r.t, cell: (r) => stockCell(r.t) },
    { key: "token", label: "Token volume", get: (r) => r.token, cell: (r) => `<td>${usd(r.token)}</td>` },
    { key: "off", label: "Outside regular hours", get: offShare, cell: (r) => `<td><span class="bar off" style="width:${(offShare(r) * 3).toFixed(2)}rem"></span>${pct(offShare(r))}</td>` },
    { key: "closed", label: "While closed", get: closedShare, cell: (r) => `<td><span class="bar" style="width:${(closedShare(r) * 3).toFixed(2)}rem"></span>${pct(closedShare(r))}</td>` },
    { key: "stock", label: "Stock volume", get: (r) => (fin(r.stock) ? r.stock : -1), cell: (r) => `<td>${fin(r.stock) ? usd(r.stock) : '<span class="sub">n/a</span>'}</td>` },
    { key: "ratio", label: "Tokens as a share", get: (r) => (fin(r.ratio_bp) ? r.ratio_bp : -1), cell: (r) => `<td>${fin(r.ratio_bp) ? bp(r.ratio_bp) : '<span class="sub">n/a</span>'}</td>` },
    { key: "venues", label: "Sources", get: (r) => r.venues.length, cell: (r) => `<td title="${esc(r.venues.map((v) => (D.meta.venue_labels || {})[v] || v).join(", "))}">${r.venues.length}</td>` },
  ];

  function rankingRows(window, product, venue) {
    const ranked = new Map();
    for (const [ticker, source, family, cents, regular, closed] of window.tokens) {
      if ((product && family !== product) || (venue && source !== venue)) continue;
      if (!ranked.has(ticker)) ranked.set(ticker, {t:ticker, name:D.profiles.get(ticker)?.name,
        description:D.profiles.get(ticker)?.description, token:0, rth:0, closed:0, sources:new Set()});
      const row = ranked.get(ticker);
      row.token += cents;
      row.rth += regular;
      row.closed += closed;
      row.sources.add(source);
    }
    return [...ranked.values()].map(row => {
      const stock = window.stock[row.t];
      return {...row, token:row.token / 100, rth:row.rth / 100, closed:row.closed / 100,
        venues:[...row.sources].sort(), stock: stock > 0 ? stock / 100 : null,
        ratio_bp: stock > 0 ? 10000 * row.token / stock : null};
    });
  }

  function renderTickers(focusKey) {
    const T = D.tickers;
    const period = $("#rank-period").value;
    const window = T.rankings?.[period];
    const allRows = window ? rankingRows(window, $("#rank-product").value, $("#rank-source").value) : (T.rows || []).slice();
    const q = ui.query.trim().toUpperCase();
    const rows = q ? allRows.filter((r) => [r.t, r.name, r.description].some(value => value?.toUpperCase().includes(q))) : allRows;
    const col = COLS.find((c) => c.key === ui.sort.key) || COLS[1];
    rows.sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * ui.sort.dir || a.t.localeCompare(b.t);
    });
    const limit = ui.tickerLimit === "all" ? rows.length : Number(ui.tickerLimit);
    const shown = rows.slice(0, limit);
    const head = COLS.map((c) => {
      const sort = c.key === ui.sort.key ? (ui.sort.dir < 0 ? "descending" : "ascending") : "none";
      return `<th scope="col" aria-sort="${sort}"><button type="button" data-sort="${c.key}">${c.label}</button></th>`;
    }).join("");
    const body = shown.map((r) => `<tr class="pick" tabindex="0" data-t="${esc(r.t)}" aria-selected="${r.t === ui.ticker}">${COLS.map((c) => c.cell(r)).join("")}</tr>`).join("");
    $("#ticker-table").innerHTML = rows.length
      ? `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`
      : "<tbody><tr><td>No recorded trades match these filters.</td></tr></tbody>";
    if (T.start) $("#stocks-note").textContent = `${longDate(window?.start || T.start)} to ${longDate(T.end)} · New York market dates, including weekends and holidays. Select a stock to see its full history.`;
    const scope = q ? `${rows.length} of ${allRows.length} stocks match “${ui.query.trim()}”` : `${allRows.length} stocks with observed trades in this selection`;
    const shownLabel = shown.length === rows.length ? `all ${rows.length} stocks` : `the top ${shown.length}`;
    $("#ticker-count").textContent = `${scope}. Showing ${shownLabel} by ${col.label.toLowerCase()}.`;
    if (focusKey) { const b = $(`[data-sort="${focusKey}"]`); if (b) b.focus(); }
  }

  async function selectTicker(t) {
    ui.ticker = t;
    $$("#ticker-table tr[data-t]").forEach((tr) => tr.setAttribute("aria-selected", String(tr.dataset.t === t)));
    const row = (D.tickers.rows || []).find((r) => r.t === t);
    const box = $("#ticker-detail");
    box.hidden = false;
    $("#ticker-h").textContent = row?.name ? `${t} · ${row.name}` : t;
    $("#ticker-profile").textContent = row?.description || "";
    if (charts["ticker-chart"]) { charts["ticker-chart"].destroy(); delete charts["ticker-chart"]; }
    D.series = null;
    $("#ticker-ranges").hidden = !row?.series;
    if (!row || !row.series) {
      $("#ticker-note").textContent = "No daily series is available for this stock.";
      return;
    }
    try {
      const series = await load(`t/${encodeURIComponent(t)}.json`);
      if (ui.ticker !== t) return;
      D.series = series;
    } catch (e) {
      if (ui.ticker !== t) return;
      $("#ticker-note").textContent = `Could not load the detail for ${t} (${e.message}).`;
      return;
    }
    renderTickerChart(row);
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }

  function renderTickerChart(row) {
    const s = D.series;
    if (!s || s.t !== row.t) return;
    const start = rangeStart(s.dates, ui.tickerRange);
    const dates = s.dates.slice(start);
    const datasets = SESS.map((k) => ({
      type: "bar", label: LABEL[k], data: s.token[k].slice(start), backgroundColor: css(VAR[k]), borderWidth: 0,
      stack: "tokens", yAxisID: "y", barPercentage: 0.9, categoryPercentage: 0.94,
    }));
    if (s.stock) {
      const stock = dates.map((_, j) => SESS.reduce((a, k) => a + (s.stock[k][start + j] || 0), 0));
      datasets.push({
        type: "line", label: "The stock's own dollar volume (right axis)", data: stock.map((v) => (v > 0 ? v : null)),
        borderColor: css("--ink"), backgroundColor: css("--ink"), borderWidth: 1.25, pointRadius: 0, spanGaps: false, yAxisID: "y2", order: -1,
      });
    }
    make("ticker-chart", {
      data: { labels: dates, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: {
          x: dateAxis(),
          y: { stacked: true, ticks: { callback: (v) => usd(v) } },
          y2: { display: Boolean(s.stock), position: "right", grid: { display: false }, ticks: { callback: (v) => usd(v) } },
        },
        plugins: {
          markers: { items: D.meta.events || [] },
          tooltip: { itemSort: topDown, filter: (c) => c.parsed.y > 0, callbacks: { title: dateTitle, label: (c) => ` ${c.dataset.label}: ${usd(c.parsed.y)}` } },
        },
      },
    });
    const n = row.venues.length;
    const out = [`Across all ${D.tickers.window_days} days, ${usd(row.token)} of ${row.t} tokens across ${n} source${n === 1 ? "" : "s"}, ${pct(offShare(row))} outside regular hours and ${pct(closedShare(row))} while closed. Chart: ${rangeLabel(s.dates, ui.tickerRange)}.`];
    if (fin(row.ratio_bp)) out.push(`That is ${bp(row.ratio_bp)} of ${row.t}'s own dollar volume.`);
    $("#ticker-note").textContent = out.join(" ");
  }

  /* ---------- Method ---------- */
  function renderMethod() {
    const m = D.meta;
    $("#session-table").innerHTML = `<thead><tr><th>Session</th><th class="left">Hours, New York time</th></tr></thead><tbody>${(m.sessions || []).map((s) =>
      `<tr><td><span class="sw-inline" style="background:var(${VAR[s.id]})"></span>${esc(s.label)}</td><td class="left">${esc(s.hours)}</td></tr>`).join("")}</tbody>`;
    const u = m.universe || {};
    const cov = m.coverage;
    const bits = [];
    if (u.tokens) {
      const mapping = u.tickers_checked ? "The refresh checked symbols against Alpaca’s listing directory." :
        "The refresh inferred symbols from token names and tickers without checking Alpaca’s listing directory.";
      bits.push(`The supplementary CoinGecko directory returned ${u.tokens} candidate tokens and assigned ${u.mapped} underlying symbols. ${mapping} The stock table contains ${D.tickers.rows.length} distinct symbols with observed token trading.`);
    }
    if (cov && cov.coingecko_24h > 0) {
      const stamp = iso => iso.slice(0, 16).replace("T", " ");
      bits.push(`Tracked venues recorded ${usd(cov.measured_24h)} during the 24 hours ending ${stamp(cov.window_end || cov.as_of)} UTC. CoinGecko’s discovery snapshot at ${stamp(cov.as_of)} UTC reported ${usd(cov.coingecko_24h)} across its broader list. Venue coverage and reporting windows differ.`);
    }
    $("#coverage").textContent = bits.join(" ") || "Coverage figures appear after the first full run.";
    const check = m.pool_volume_check;
    if (check?.networks) {
      const values = [["base", "Coinbase on Base"], ["eth", "Ondo on Ethereum"]].flatMap(([net, label]) => {
        const entry = check.networks[net];
        return entry?.reported_usd > 0
          ? [`Tracked pools for ${label} accounted for ${pct(entry.tracked_usd / entry.reported_usd, 1)} of ${usd(entry.reported_usd)} in reported volume for its own contracts`] : [];
      });
      if (values.length) {
        const note = $("#pool-volume-check");
        note.hidden = false;
        note.textContent = `On ${longDate(check.checked_at.slice(0, 10))}, DEX Screener reported the following 24-hour coverage for tracked pools. ${values.join(". ")}. Each pool counts once. This snapshot covers the two named chains and can differ from historical coverage.`;
      }
    }
    const extra = m.extra_pool_check;
    if (extra?.groups?.length) {
      const fractions = extra.groups.filter(g => g.reported_usd > 0).map(g =>
        `${FAMILY[g.family]} on ${g.network === "bsc" ? "BNB Chain" : "Solana"} ${pct(g.tracked_usd / g.reported_usd, 1)}`);
      $("#extra-volume-check").hidden = false;
      $("#extra-volume-check").textContent = `On ${longDate(extra.checked_at.slice(0, 10))}, the selected pools covered these shares of DEX Screener’s 24-hour dollars for the screened contracts: ${fractions.join(", ")}. These percentages apply to that scan only.`;
    }
    const src = m.sources || [];
    $("#source-table").innerHTML = src.length
      ? `<thead><tr><th>Product and data source</th><th>Latest collection scope</th><th>Distinct underlyings in archive</th><th class="left">Observed market dates</th><th class="left">Collector status</th><th>Last run</th></tr></thead><tbody>${src.map((s) => {
        const status = s.pending_pools ? `<span class="sub">History pending for ${s.pending_pools} pools</span>` : s.ok && (s.errors || s.discovery_errors) ? '<span class="sub">Partial</span>' : s.ok === true ? '<span class="status-ok">Working</span>'
          : s.ok === false ? '<span class="status-bad">Failing</span>' : '<span class="sub">No recorded run</span>';
        const detail = s.error ? ` <span class="sub">${esc(String(s.error).slice(0, 160))}</span>` : "";
        const errs = (s.errors ? ` <span class="sub">(${s.errors} market errors)</span>` : "") +
          (s.discovery_errors ? ` <span class="sub">(${s.discovery_errors} discovery issues)</span>` : "");
        const runAt = s.finished || s.started;
        const when = runAt ? `${esc(runAt.slice(0, 16).replace("T", " "))} UTC` : "n/a";
        const groups = s.pool_groups?.length ? s.pool_groups : [s];
        return groups.map((g, i) => {
          const pool = Boolean(g.network);
          const label = pool ? `${FAMILY[g.family] || g.family} · ${m.venue_labels[g.network] || g.network} (GeckoTerminal)` : s.label;
          const unit = pool || s.id === "dex" ? "pools" : s.id === "stocks" ? "symbols requested" : "trading pairs";
          const dates = g.first_date ? `${longDate(g.first_date)} to ${longDate(g.last_date)}` : "—";
          const tickers = g.tickers || [];
          const stockList = pool && tickers.length ? `<details><summary>Show tickers</summary>${esc(tickers.join(", "))}</details>` : "";
          const listing = g.listed != null ? `<br><small>${g.listed} screened · ${g.with_pool} with a tracked pool</small>` : "";
          const run = i ? "" : `<td rowspan="${groups.length}" class="left">${status}${errs}${detail}</td><td rowspan="${groups.length}">${when}</td>`;
          return `<tr><td>${esc(label)}</td><td>${g.markets ?? "—"} ${unit}${listing}</td><td>${g.tickers ? tickers.length : "—"}${stockList}</td><td class="left">${dates}</td>${run}</tr>`;
        }).join("");
      }).join("")}</tbody>`
      : "<tbody><tr><td>No runs recorded yet.</td></tr></tbody>";
    const links = ['<a href="data/token_daily.csv">Token volume by day, session, venue, issuer and stock</a>'];
    if (m.issuer_catalog_at) links.push(`<a href="data/issuer_coverage.csv">Screened issuer contracts, selection dates, pool coverage and recorded volume</a>`);
    if (m.history?.stock_dates > 0) links.push('<a href="data/stock_daily.csv">Stock volume by day and session</a>');
    $("#downloads").innerHTML = links.join(", ") + ".";
  }

  /* ---------- Boot ---------- */
  function showEmpty(err) {
    $("#stamp").textContent = "";
    const local = location.protocol === "file:";
    if (local) {
      $("#main").innerHTML = '<div class="empty"><h2>Open the dashboard online</h2><p>Your browser could not load the dashboard data from this local file. <a href="https://tianhaoyin1120.github.io/offhours/">View the published dashboard</a> or serve the site folder over HTTP.</p></div>';
      return;
    }
    $("#main").innerHTML = `<div class="empty"><h2>Dashboard could not load</h2><p>Reload the page to retry.</p>${err ? `<p class="sub">${esc(err.message)}</p>` : ""}</div>`;
  }

  function historicalComparison(history, start, end, mode) {
    const totals = new Map();
    for (const [day, records] of Object.entries(history)) {
      if (day < start || day > end) continue;
      const tickers = new Map();
      for (const [ticker, session, token, stock] of records) {
        if (mode !== "calendar" && mode !== "matched" && mode !== session) continue;
        if (!tickers.has(ticker)) tickers.set(ticker, [0, 0]);
        const pair = tickers.get(ticker);
        pair[0] += token;
        pair[1] += stock;
      }
      for (const [ticker, [token, stock]] of tickers) {
        const both = token > 0 && stock > 0;
        if (!both && mode !== "calendar") continue;
        if (!totals.has(ticker)) totals.set(ticker, { t: ticker, token: 0, stock: 0, days: 0, above: 0 });
        const row = totals.get(ticker);
        row.token += token;
        row.stock += stock;
        if (both) {
          row.days++;
          if (token > stock) row.above++;
        }
      }
    }
    return Array.from(totals.values()).filter(row => row.days).map(row => ({
      ...row, token: row.token / 100, stock: row.stock / 100
    }));
  }

  function renderSessionObservations(history, start, end, limit, mode) {
    const matched = [];
    for (const day of Object.keys(history).sort().reverse()) {
      if (day < start || day > end) continue;
      for (const [ticker, session, token, stock] of history[day]) {
        if (session === mode && token > 0 && stock > 0) matched.push({day, ticker, token, stock});
      }
    }
    const coverage = mode === "OVERNIGHT"
      ? "The stock feed covers only part of overnight trading (8 p.m. to 4 a.m. New York time)."
      : "The US market was closed. Occasional stock-tape prints in these periods do not provide a comparable trading session.";
    $("#volume-summary").textContent = `${longDate(start)} to ${longDate(end)}. ${coverage} Both feeds recorded volume on ${matched.length} stock–date pairs.`;
    const dollars = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"});
    const visible = limit === "all" ? matched : matched.slice(0, Number(limit));
    $("#volume-comparison").innerHTML = "<thead><tr><th>Market date</th><th>Stock</th><th>Recorded token dollars</th><th>Recorded stock dollars</th></tr></thead><tbody>" +
      visible.map(r => `<tr><td>${longDate(r.day)}</td>${stockCell(r.ticker)}<td>${dollars.format(r.token / 100)}</td><td>${dollars.format(r.stock / 100)}</td></tr>`).join("") +
      (matched.length ? "" : '<tr><td colspan="4">No observations in this session with volume in both feeds.</td></tr>') + "</tbody>";
  }

  function setComparisonRange() {
    const dates = D.daily.dates;
    const range = $("#volume-range").value;
    if (range !== "custom" && dates.length) {
      $("#volume-start").value = dates[range === "all" ? 0 : Math.max(0, dates.length - Number(range))];
      $("#volume-end").value = dates[dates.length - 1];
    }
    renderComparisons();
  }

  function renderComparisons() {
    const mode = $("#volume-mode").value;
    const limit = $("#volume-limit").value;
    const start = $("#volume-start").value, end = $("#volume-end").value;
    const dates = D.daily.dates;
    const message = (value) => {
      $("#volume-summary").textContent = value;
      $("#volume-comparison").replaceChildren();
    };
    if (!dates.length) return message("No recorded history is available yet.");
    if (!start || !end || start > end || start < dates[0] || end > dates[dates.length - 1]) {
      return message(`Choose a start date on or before the end date. Both dates must fall between ${longDate(dates[0])} and ${longDate(dates[dates.length - 1])}.`);
    }
    let rows;
    const observationsOnly = mode === "OVERNIGHT" || mode === "CLOSED";
    if (!observationsOnly && start === D.tickers.start && end === D.tickers.end) {
      rows = (D.tickers.comparisons?.[mode] || []).slice();
    } else if (D.volumeHistory) {
      if (observationsOnly) return renderSessionObservations(D.volumeHistory.days, start, end, limit, mode);
      rows = historicalComparison(D.volumeHistory.days, start, end, mode);
    } else {
      message("Loading historical volume…");
      if (!D.loadingVolume) {
        D.loadingVolume = load("volume_history.json").then(history => {
          D.volumeHistory = history;
          renderComparisons();
        }).catch(() => {
          if (["OVERNIGHT", "CLOSED"].includes($("#volume-mode").value) || $("#volume-start").value !== D.tickers.start || $("#volume-end").value !== D.tickers.end)
            message("Historical data could not load. Change the range to retry.");
        }).finally(() => { D.loadingVolume = null; });
      }
      return;
    }
    rows.sort((a,b) => b.token/b.stock - a.token/a.stock || a.t.localeCompare(b.t));
    const description = mode === "calendar" ? "Each total includes all recorded volume in the selected dates. A ticker needs at least one date with trading on both sides." :
      mode === "matched" ? "Only dates with positive volume in both feeds are included." : "Only dates with positive volume in both feeds during this session are included.";
    const result = rows.length
      ? `${rows.filter(r => r.token > r.stock).length} of ${rows.length} comparable tickers had higher recorded token dollars over the window.`
      : "No stock had positive volume in both feeds on a matching date.";
    $("#volume-summary").textContent = `${longDate(start)} to ${longDate(end)}. ${description} ${result}`;
    $("#volume-comparison").innerHTML = "<thead><tr><th>Stock</th><th>Token dollars</th><th>Stock dollars</th><th>Token / stock</th><th>Dates above 100% / matched dates</th></tr></thead><tbody>" +
      rows.slice(0, limit === "all" ? rows.length : Number(limit)).map(r =>
        `<tr>${stockCell(r.t)}<td>${usd(r.token)}</td><td>${usd(r.stock)}</td><td>${pct(r.token/r.stock,2)}</td><td>${r.above} / ${r.days}</td></tr>`).join("") +
      (rows.length ? "" : '<tr><td colspan="5">No comparable recorded volume.</td></tr>') + "</tbody>";
  }

  function renderLead() {
    const t = D.tickers;
    $("#lead-window").textContent = `This price comparison uses all ${t.window_days} calendar days in the archive, ${longDate(t.start)} to ${longDate(t.end)}.`;
    const select = $("#lead-symbol");
    const results = t.lead_lag?.[$("#lead-session").value] || {};
    const names = Object.keys(results).sort();
    const previous = select.value;
    select.replaceChildren(...names.map(ticker => new Option(D.profiles.get(ticker)?.name ? `${ticker} · ${D.profiles.get(ticker).name}` : ticker, ticker)));
    if (names.includes(previous)) select.value = previous;
    else if (names.includes("BNC")) select.value = "BNC";
    const r = results[select.value];
    $("#lead-result").textContent = r ? `${select.value}, ${longDate(t.start)} to ${longDate(t.end)}. Token first: ${fin(r.token_first) ? fix(r.token_first) : "n/a"}. Stock first: ${fin(r.stock_first) ? fix(r.stock_first) : "n/a"}. Based on ${r.n} consecutive half-hour pairs.` :
      "A stock needs 30 comparable half-hour pairs to appear here.";
  }

  function renderAll() {
    chartDefaults();
    renderStamp();
    renderOverview();
    renderLegend();
    renderWeek();
    renderSummary();
    renderDaily();
    renderTrend();
    renderMix();
    renderProtocol();
    renderVenues();
    renderTickers();
    renderComparisons();
    renderLead();
    renderMethod();
    const row = ui.ticker && (D.tickers.rows || []).find((r) => r.t === ui.ticker);
    if (row) renderTickerChart(row);
  }

  function bind() {
    D.profiles = new Map(D.tickers.rows.map(row => [row.t, row]));
    const selectedPeriod = new URLSearchParams(location.search).get("rank");
    if (["1", "7", "30", "all"].includes(selectedPeriod)) $("#rank-period").value = selectedPeriod;
    for (const family of Object.keys(D.daily.families)) $("#rank-product").add(new Option(FAMILY[family] || family, family));
    for (const source of Object.keys(D.daily.venues)) $("#rank-source").add(new Option(D.meta.venue_labels[source] || source, source));
    for (const id of ["rank-period", "rank-product", "rank-source"]) $("#"+id).addEventListener("change", () => {
      if (id === "rank-period" && location.protocol !== "file:") {
        const url = new URL(location.href);
        if ($("#rank-period").value === "all") url.searchParams.delete("rank");
        else url.searchParams.set("rank", $("#rank-period").value);
        history.replaceState(null, "", url);
      }
      ui.ticker = null;
      $("#ticker-detail").hidden = true;
      renderTickers();
    });
    for (const id of ["trend-range", "trend-stock"]) {
      $(`#${id}`).addEventListener("change", renderTrend);
    }
    for (const id of ["protocol-range", "protocol-chain"]) $("#"+id).addEventListener("change", renderProtocol);
    const dates = D.daily.dates;
    const dex = D.meta.sources?.find(source => source.id === "dex");
    if (dates.length) {
      $("#volume-archive").textContent = `Archive: ${longDate(dates[0])} to ${longDate(dates[dates.length - 1])}.` +
        (dex?.first_date ? ` On-chain pool records begin ${longDate(dex.first_date)}.` : "");
    }
    for (const input of [$("#volume-start"), $("#volume-end")]) {
      input.min = dates[0] || "";
      input.max = dates[dates.length - 1] || "";
      input.addEventListener("change", () => {
        $("#volume-range").value = "custom";
        renderComparisons();
      });
    }
    $("#volume-range").addEventListener("change", setComparisonRange);
    setComparisonRange();
    $("#volume-mode").addEventListener("change", renderComparisons);
    $("#volume-limit").addEventListener("change", renderComparisons);
    $("#lead-symbol").addEventListener("change", renderLead);
    $("#lead-session").addEventListener("change", renderLead);
    $$("[data-week]").forEach((b) => b.addEventListener("click", () => { ui.week = b.dataset.week; pressed("week", ui.week); renderWeek(); }));
    $$("[data-daily]").forEach((b) => b.addEventListener("click", () => { ui.daily = b.dataset.daily; pressed("daily", ui.daily); renderDaily(); }));
    function bindRange(group, property, render) {
      $$(`[data-${group}]`).forEach(button => button.addEventListener("click", () => {
        ui[property] = button.getAttribute(`data-${group}`);
        pressed(group, ui[property]);
        render();
      }));
    }
    bindRange("range", "range", renderDaily);
    const sharedCount = new Set(D.daily.venue_comparison.matched.map(row => row[5])).size;
    $("#overview-shared").textContent = `Compare the ${sharedCount} tickers traded on the original four sources on matching dates`;
    $("#product-options").open = ui.sample !== "all";
    bindRange("sample", "sample", () => {
      const url = new URL(location.href);
      if (ui.sample !== "all") url.searchParams.set("sample", ui.sample);
      else url.searchParams.delete("sample");
      if (location.protocol !== "file:") history.replaceState(null, "", url);
      renderVenues();
    });
    $("#shared-ticker").addEventListener("change", renderVenues);
    bindRange("venue-range", "venueRange", renderVenues);
    bindRange("ticker-range", "tickerRange", () => {
      const row = (D.tickers.rows || []).find(r => r.t === ui.ticker);
      if (row && D.series) renderTickerChart(row);
    });
    $$("[data-venue]").forEach((b) => b.addEventListener("click", () => { ui.venue = b.dataset.venue; pressed("venue", ui.venue); renderVenues(); }));
    $$("[data-limit]").forEach((b) => b.addEventListener("click", () => {
      ui.tickerLimit = b.dataset.limit;
      pressed("limit", ui.tickerLimit);
      renderTickers();
    }));
    const table = $("#ticker-table");
    table.addEventListener("click", (e) => {
      const sort = e.target.closest("[data-sort]");
      if (sort) {
        const key = sort.dataset.sort;
        ui.sort = { key, dir: ui.sort.key === key ? -ui.sort.dir : key === "t" ? 1 : -1 };
        renderTickers(key);
        return;
      }
      const tr = e.target.closest("tr[data-t]");
      if (tr) selectTicker(tr.dataset.t);
    });
    table.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-t]")) {
        e.preventDefault();
        selectTicker(e.target.dataset.t);
      }
    });
    $("#ticker-search").addEventListener("input", (e) => {
      ui.query = e.target.value;
      renderTickers();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  }

  async function init() {
    try {
      const [meta, daily, week, tickers] = await Promise.all(
        ["meta.json", "daily.json", "week.json", "tickers.json"].map(load));
      Object.assign(D, { meta, daily, week, tickers });
    } catch (e) {
      showEmpty(e);
      return;
    }
    if (typeof Chart === "undefined") {
      showEmpty(new Error("Chart.js did not load from site/vendor/chart.umd.js."));
      return;
    }
    Chart.register(markers);
    bind();
    renderAll();
  }

  init();
})();
