var API_KEY = '';
var REFRESH_TIMER = null;
var QUOTE_TIMER = null;
var CLOCK_TIMER = null;
var LAST_RESULTS = {};
var WS = null;
var WS_RECONNECT_TIMER = null;
var TICK_BUCKETS = {};
var VIEW_STATE = {};
var ANIMATED_PRICE = {};
var ANIMATION_FRAME = {};
var DRAG_STATE = {};
var CURRENT_INTERVAL = '5m';
var MIN_VISIBLE_BARS = 8;
var MAX_X_ZOOM = 90;
var TV_DEFAULT_VISIBLE_BARS = 38;

var STOCKS = [
  {sym:'NVDA', name:'NVIDIA Corporation', title:'NVIDIA Corporation', dot:'#76b900'},
  {sym:'AAPL', name:'Apple Inc.',          title:'Apple Inc', dot:'#b8beca'},
  {sym:'MSFT', name:'Microsoft Corp.',     title:'Microsoft Corp.', dot:'#f05a28'},
  {sym:'AMZN', name:'Amazon.com, Inc.',    title:'Amazon.com, Inc.', dot:'#ff9900'},
  {sym:'GOOGL',name:'Alphabet Inc (Google) Class A', title:'Alphabet Inc (Google) Class A', dot:'#4285f4'},
  {sym:'AMD',  name:'Advanced Micro Devices',  title:'Advanced Micro Devices', dot:'#ed1c24'},
  {sym:'META', name:'Meta Platforms Inc Class A', title:'Meta Platforms Inc Class A', dot:'#0082fb'},
  {sym:'TSLA', name:'Tesla, Inc.',         title:'Tesla, Inc.', dot:'#cc0000'},
];

function loadSavedKey() {
  try { return localStorage.getItem('finnhub_key') || ''; } catch(e){ return ''; }
}
function saveKey(k) {
  try { localStorage.setItem('finnhub_key', k); } catch(e){}
}
function resetKey() {
  try { localStorage.removeItem('finnhub_key'); } catch(e){}
  closeSocket();
  document.getElementById('api-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

async function checkAndSaveKey() {
  var k = document.getElementById('api-input').value.trim();
  if (!k) return;
  var btn = document.getElementById('api-btn');
  var err = document.getElementById('api-err');
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  err.style.display = 'none';
  try {
    var j = await apiGet('https://finnhub.io/api/v1/quote?symbol=AAPL&token=' + encodeURIComponent(k));
    if (!j || Number(j.c) <= 0) throw new Error('La API key no devolvio precio para AAPL.');
    saveKey(k);
    API_KEY = k;
    startDashboard();
  } catch(e) {
    err.textContent = e && e.message ? e.message : 'API key invalida o sin conexion. Verifica e intenta de nuevo.';
    err.style.display = 'block';
    btn.textContent = 'Conectar';
    btn.disabled = false;
  }
}

async function apiGet(url) {
  var r = await fetch(url, {cache:'no-store'});
  var text = await r.text();
  var data = {};
  try { data = text ? JSON.parse(text) : {}; } catch(e) {
    throw new Error('Respuesta inesperada del servidor.');
  }
  if (!r.ok) {
    throw new Error(data.error || data.msg || ('HTTP ' + r.status + '.'));
  }
  return data;
}

function getMarketSession() {
  var now = new Date();
  var nyDate = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'}));
  var h = nyDate.getHours(), m = nyDate.getMinutes(), dow = nyDate.getDay();
  var mins = h*60+m;
  var isWeekday = dow >= 1 && dow <= 5;
  if (!isWeekday) return {label:'MARKET CLOSED', cls:'closed'};
  if (mins >= 240 && mins < 570) return {label:'PRE MARKET', cls:'pre'};
  if (mins >= 570 && mins < 960) return {label:'MARKET OPEN', cls:'open'};
  if (mins >= 960 && mins < 1200) return {label:'POST MARKET', cls:'post'};
  return {label:'OVERNIGHT', cls:'closed'};
}

function updateClock() {
  var now = new Date();
  var nyStr = now.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  document.getElementById('clock').textContent = 'NY ' + nyStr;
  var el = document.getElementById('mkt-status');
  var session = getMarketSession();
  el.textContent = session.label;
  el.className = 'mkt-status ' + session.cls;
  updateCountdownBadges();
}

function candleCountdownText(ms) {
  var intervalMap = { '1m': 60*1000, '5m': 5*60*1000, '15m': 15*60*1000, '30m': 30*60*1000 };
  var interval = intervalMap[CURRENT_INTERVAL] || 5*60*1000;
  var left = interval - (ms % interval);
  if (left === interval) left = 0;
  var totalSeconds = Math.max(0, Math.ceil(left / 1000));
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function updateCountdownBadges() {
  var text = candleCountdownText(Date.now());
  var nodes = document.querySelectorAll('.pbadge .cd');
  for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
}

function switchInterval(newInterval) {
  CURRENT_INTERVAL = newInterval;
  var labels = { '1m': '1 min', '5m': '5 min', '15m': '15 min', '30m': '30 min' };
  var shortLabels = { '1m': '1', '5m': '5', '15m': '15', '30m': '30' };
  document.getElementById('intervalLabel').textContent = labels[newInterval] || newInterval;
  var btns = document.querySelectorAll('.interval-btn');
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    if (b.getAttribute('data-interval') === newInterval) {
      b.style.background = '#FF8C42'; b.style.color = '#fff';
    } else {
      b.style.background = '#252630'; b.style.color = '#8a8a95';
    }
  }
  var tfShort = shortLabels[newInterval] || '5';
  for (var i = 0; i < STOCKS.length; i++) {
    var wm = document.getElementById('wm-' + STOCKS[i].sym);
    if (wm) wm.textContent = STOCKS[i].sym + ', ' + tfShort;
    var tf = document.getElementById('tf-' + STOCKS[i].sym);
    if (tf) tf.innerHTML = '&middot; ' + tfShort + ' &middot; NASDAQ';
  }
  loadAll();
}

async function fetchCandles(sym) {
  var url = '/api/chart?symbol=' + encodeURIComponent(sym) + '&interval=' + encodeURIComponent(CURRENT_INTERVAL);
  var j = await apiGet(url);
  var result = j && j.chart && j.chart.result && j.chart.result[0];
  var quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
  var times = result && result.timestamp;
  if (!result || !quote || !times || !times.length) {
    var err = j && j.chart && j.chart.error && j.chart.error.description;
    if (err) throw new Error(err);
    return [];
  }
  var pts = [];
  for (var i = 0; i < times.length; i++) {
    var close = Number(quote.close && quote.close[i]);
    if (!isFinite(close) || close <= 0) continue;
    pts.push({
      t: times[i]*1000, c: close,
      o: Number(quote.open && quote.open[i]) || close,
      h: Number(quote.high && quote.high[i]) || close,
      l: Number(quote.low && quote.low[i]) || close
    });
  }
  return normalizeCandles(pts).slice(-1200);
}

function normalizeCandles(pts) {
  return (pts || []).map(function(p, i) {
    var neighbors = [];
    for (var n = Math.max(0, i - 3); n <= Math.min(pts.length - 1, i + 3); n++) {
      if (n !== i && Number(pts[n].c) > 0) neighbors.push(Number(pts[n].c));
    }
    neighbors.sort(function(a,b){ return a-b; });
    var ref = neighbors.length ? neighbors[Math.floor(neighbors.length / 2)] : Number(p.c);
    var hardHi = ref * 1.055;
    var hardLo = ref * 0.945;
    var o = clamp(Number(p.o) || Number(p.c), hardLo, hardHi);
    var c = clamp(Number(p.c), hardLo, hardHi);
    var bodyHi = Math.max(o, c);
    var bodyLo = Math.min(o, c);
    var maxWick = Math.max(ref * 0.035, Math.abs(bodyHi - bodyLo) * 2.5, 0.2);
    return {
      t: p.t, o: o, h: Math.min(clamp(Number(p.h) || bodyHi, hardLo, hardHi), bodyHi + maxWick),
      l: Math.max(clamp(Number(p.l) || bodyLo, hardLo, hardHi), bodyLo - maxWick), c: c
    };
  });
}

async function fetchQuote(sym) {
  return await apiGet('/api/quote?symbol=' + encodeURIComponent(sym));
}

async function fetchRealtime(sym) {
  return await apiGet('/api/realtime?symbol=' + encodeURIComponent(sym));
}

function closeSocket() {
  if (WS_RECONNECT_TIMER) clearTimeout(WS_RECONNECT_TIMER);
  WS_RECONNECT_TIMER = null;
  if (WS) { try { WS.close(); } catch(e){} WS = null; }
}

function connectSocket() {
  closeSocket();
  if (!API_KEY || !window.WebSocket) return;
  try {
    WS = new WebSocket('wss://ws.finnhub.io?token=' + encodeURIComponent(API_KEY));
    WS.onopen = function() {
      STOCKS.forEach(function(s){ WS.send(JSON.stringify({type:'subscribe', symbol:s.sym})); });
    };
    WS.onmessage = function(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch(e){ return; }
      if (!msg || msg.type !== 'trade' || !msg.data) return;
      msg.data.forEach(function(t) {
        if (t && t.s && Number(t.p) > 0) addTradeTick(t.s, Number(t.p), Number(t.t) || Date.now());
      });
    };
    WS.onclose = function() {
      if (!API_KEY) return;
      WS_RECONNECT_TIMER = setTimeout(connectSocket, 10000);
    };
  } catch(e) {}
}

function addTradeTick(sym, price, ts, smooth) {
  if (!TICK_BUCKETS[sym]) TICK_BUCKETS[sym] = {};
  var bucketTs = Math.floor(ts / (5*60*1000)) * 5*60*1000;
  var b = TICK_BUCKETS[sym][bucketTs];
  if (!b) b = TICK_BUCKETS[sym][bucketTs] = {t:bucketTs, o:price, h:price, l:price, c:price};
  b.h = Math.max(b.h, price); b.l = Math.min(b.l, price); b.c = price;
  if (smooth) animateLiveTip(sym, price);
  else redrawWithLiveTicks(sym, price);
}

function animateLiveTip(sym, targetPrice) {
  if (!window.requestAnimationFrame) { redrawWithLiveTicks(sym, targetPrice); return; }
  if (ANIMATION_FRAME[sym]) cancelAnimationFrame(ANIMATION_FRAME[sym]);
  var r = LAST_RESULTS[sym];
  var pts = r && r.pts ? r.pts : [];
  var lastPoint = pts.length ? pts[pts.length - 1].c : targetPrice;
  var from = Number(ANIMATED_PRICE[sym]) || Number(lastPoint) || targetPrice;
  var start = performance.now();
  var duration = 520;
  function step(now) {
    var t = Math.min(1, (now - start) / duration);
    var eased = 1 - Math.pow(1 - t, 3);
    ANIMATED_PRICE[sym] = from + (targetPrice - from) * eased;
    redrawWithLiveTicks(sym, targetPrice);
    if (t < 1) ANIMATION_FRAME[sym] = requestAnimationFrame(step);
    else { ANIMATED_PRICE[sym] = targetPrice; ANIMATION_FRAME[sym] = null; }
  }
  ANIMATION_FRAME[sym] = requestAnimationFrame(step);
}

function mergeTickCandles(sym, pts) {
  var live = TICK_BUCKETS[sym];
  if (!live) return normalizeCandles(pts || []);
  var byTime = {};
  (pts || []).forEach(function(p){ byTime[p.t] = p; });
  Object.keys(live).forEach(function(k){ byTime[Number(k)] = live[k]; });
  return normalizeCandles(Object.keys(byTime).map(Number).sort(function(a,b){return a-b;}).map(function(k){return byTime[k];})).slice(-1200);
}

function getViewState(sym) {
  if (!VIEW_STATE[sym]) VIEW_STATE[sym] = {xZoom:1, yZoom:1, targetXZoom:1, targetYZoom:1, xOffset:0, zoomFrame:null, fitted:false};
  return VIEW_STATE[sym];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fitCanvas(canvas, width, height) {
  var dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawSmoothPriceLine(ctx, points) {
  if (!points.length) return;
  if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 1, 0, Math.PI * 2); ctx.stroke(); return; }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function proportionalPriceScale(pts, last, minP, maxP, yZoom) {
  var rawRange = maxP - minP || Math.max(Math.abs(last) * 0.01, 1);
  var topPad = rawRange * 0.07;
  var bottomPad = rawRange * 0.07;
  var lo = minP - bottomPad;
  var hi = maxP + topPad;
  var center = (lo + hi) / 2;
  var range = (hi - lo) / Math.max(0.35, yZoom);
  if (range < rawRange * 1.08) range = rawRange * 1.08;
  lo = center - range / 2;
  hi = center + range / 2;
  return {lo: lo, hi: hi, range: hi - lo};
}

function removeTrailingFlatTail(pts) {
  if (!pts || pts.length < 3) return pts;
  var prices = pts.map(function(p){ return Number(p.c); }).filter(function(v){ return Number.isFinite(v); });
  var minP = Math.min.apply(null, prices);
  var maxP = Math.max.apply(null, prices);
  var eps = Math.max((maxP - minP) * 0.002, Math.abs(pts[pts.length - 1].c) * 0.00002, 0.0001);
  var end = pts.length - 1;
  while (end > 1 && Math.abs(Number(pts[end].c) - Number(pts[end - 1].c)) <= eps) end--;
  return end < pts.length - 1 ? pts.slice(0, end + 1) : pts;
}

function targetVisibleBarsForWidth(width) {
  return clamp(Math.round(width / 10.5), 28, TV_DEFAULT_VISIBLE_BARS);
}

function ensureTradingViewWindow(view, totalBars, chartWidth) {
  if (view.fitted || totalBars <= 0) return;
  var targetBars = Math.min(totalBars, targetVisibleBarsForWidth(chartWidth || 420));
  var zoom = totalBars / Math.max(MIN_VISIBLE_BARS, targetBars);
  view.xZoom = view.targetXZoom = clamp(zoom, 1, MAX_X_ZOOM);
  view.xOffset = 0;
  view.fitted = true;
}

function getVisibleCount(view, totalBars) {
  if (!totalBars) return 0;
  return Math.min(totalBars, Math.max(MIN_VISIBLE_BARS, Math.floor(totalBars / Math.max(1, view.xZoom))));
}

function redrawSymbol(sym) {
  var r = LAST_RESULTS[sym];
  var s = STOCKS.filter(function(x){ return x.sym === sym; })[0];
  if (r && s && r.pts && r.pts.length >= 2) drawPanel(s, r.pts, r.quote && r.quote.c);
}

function redrawAllSymbols() {
  STOCKS.forEach(function(s){ redrawSymbol(s.sym); });
}

function clampOffset(view, totalBars) {
  if (!totalBars) { view.xOffset = 0; return; }
  var visibleCount = getVisibleCount(view, totalBars);
  var maxOffset = Math.max(0, totalBars - visibleCount);
  view.xOffset = clamp(view.xOffset || 0, 0, maxOffset);
}

function animateViewZoom(sym) {
  var view = getViewState(sym);
  if (view.zoomFrame) return;
  function step() {
    view.xZoom += (view.targetXZoom - view.xZoom) * 0.22;
    view.yZoom += (view.targetYZoom - view.yZoom) * 0.22;
    if (Math.abs(view.targetXZoom - view.xZoom) < 0.003) view.xZoom = view.targetXZoom;
    if (Math.abs(view.targetYZoom - view.yZoom) < 0.003) view.yZoom = view.targetYZoom;
    redrawSymbol(sym);
    if (view.xZoom !== view.targetXZoom || view.yZoom !== view.targetYZoom) {
      view.zoomFrame = requestAnimationFrame(step);
    } else { view.zoomFrame = null; }
  }
  view.zoomFrame = requestAnimationFrame(step);
}

function wirePanelInteractions(s, panel) {
  var ca = panel.querySelector('.ca');
  ca.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect = ca.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var view = getViewState(s.sym);
    var r = LAST_RESULTS[s.sym];
    var totalBars = r && r.pts ? r.pts.length : 0;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      var panDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      view.xOffset = (view.xOffset || 0) + panDelta / 42;
      view.yZoom = 1; view.targetYZoom = 1;
      clampOffset(view, totalBars);
      redrawSymbol(s.sym);
      return;
    }
    var factor = Math.exp((-e.deltaY / 2400));
    factor = clamp(factor, 0.92, 1.09);
    if (x >= rect.width - 74) {
      view.targetYZoom = clamp(view.targetYZoom * factor, 0.55, 8);
    } else {
      view.targetXZoom = clamp(view.targetXZoom * factor, 1, MAX_X_ZOOM);
      if (e.deltaY > 0) view.targetYZoom = 1;
      view.xOffset = Math.round((view.xOffset || 0) * factor);
    }
    clampOffset(view, totalBars);
    animateViewZoom(s.sym);
  }, {passive:false});

  ca.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    var r = LAST_RESULTS[s.sym];
    if (!r || !r.pts || r.pts.length < 2) return;
    DRAG_STATE[s.sym] = {
      x: e.clientX, offset: getViewState(s.sym).xOffset || 0,
      total: r.pts.length, width: Math.max(1, ca.clientWidth - 98)
    };
  });

  window.addEventListener('mousemove', function(e) {
    var drag = DRAG_STATE[s.sym];
    if (!drag) return;
    var view = getViewState(s.sym);
    var visibleCount = getVisibleCount(view, drag.total);
    var barsPerPx = visibleCount / drag.width;
    view.xOffset = drag.offset + (e.clientX - drag.x) * barsPerPx;
    view.yZoom = 1; view.targetYZoom = 1;
    clampOffset(view, drag.total);
    redrawSymbol(s.sym);
  });

  window.addEventListener('mouseup', function() { DRAG_STATE[s.sym] = null; });

  ca.addEventListener('dblclick', function() {
    var view = getViewState(s.sym);
    view.fitted = false; view.targetXZoom = 1; view.targetYZoom = 1; view.xOffset = 0;
    animateViewZoom(s.sym);
  });
}

function redrawWithLiveTicks(sym, price) {
  var r = LAST_RESULTS[sym];
  var s = STOCKS.filter(function(x){ return x.sym === sym; })[0];
  if (!s) return;
  var pts = mergeTickCandles(sym, r && r.pts ? r.pts : []);
  var quote = r && r.quote ? r.quote : {c:price};
  quote.c = price;
  LAST_RESULTS[sym] = {s:s, pts:pts, quote:quote};
  if (pts.length >= 2) drawPanel(s, pts, price);
  else showPanelMessage(s, 'Esperando trades extendidos...', quote);
}

function applyLiveQuote(sym, quote) {
  var price = quote && Number(quote.c) > 0 ? Number(quote.c) : 0;
  if (!price) return;
  var r = LAST_RESULTS[sym];
  var s = STOCKS.filter(function(x){ return x.sym === sym; })[0];
  if (!s) return;
  if (r && r.quote) { r.quote.c = price; if (quote.pc) r.quote.pc = quote.pc; }
  addTradeTick(sym, price, Date.now(), true);
}

async function updateLiveQuotes() {
  if (!Object.keys(LAST_RESULTS).length) return;
  await Promise.all(STOCKS.map(function(s) {
    return fetchRealtime(s.sym).then(function(q){ applyLiveQuote(s.sym, q); }).catch(function(){ stopRealtimePolling(); });
  }));
}

function stopRealtimePolling() {
  if (QUOTE_TIMER) clearInterval(QUOTE_TIMER);
  QUOTE_TIMER = null;
}

function fmtT(ms) {
  return new Date(ms).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/New_York'});
}
function fmtX(ms, spanMs) {
  var d = new Date(ms);
  if (spanMs > 36 * 60 * 60 * 1000) {
    return d.toLocaleString('en-US', {timeZone:'America/New_York', day:'2-digit'});
  }
  return fmtT(ms);
}
function fmtP(v, dec) {
  if (v == null || isNaN(v)) return '--';
  dec = dec === undefined ? 2 : dec;
  return v.toLocaleString('es-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}

function updateHeader(s, last, prev) {
  document.getElementById('cp-' + s.sym).textContent = Number(last) > 0 ? fmtP(last) : '--';
  var chEl = document.getElementById('ch-' + s.sym);
  if (!prev || !last) { chEl.textContent = ''; chEl.className = 'ch'; return true; }
  var chg = last - prev;
  var pct = (chg / prev) * 100;
  var isUp = chg >= 0;
  chEl.textContent = (isUp ? '+' : '') + fmtP(chg) + ' (' + (isUp ? '+' : '') + pct.toFixed(2).replace('.', ',') + '%)';
  chEl.className = 'ch ' + (isUp ? 'up' : 'dn');
  return isUp;
}

function showPanelMessage(s, msg, quote) {
  var ld = document.getElementById('ld-' + s.sym);
  var last = quote && Number(quote.c) > 0 ? Number(quote.c) : 0;
  var prev = quote && Number(quote.pc) > 0 ? Number(quote.pc) : 0;
  var isUp = updateHeader(s, last, prev);
  var pb = document.getElementById('pb-' + s.sym);
  var hl = document.getElementById('hl-' + s.sym);
  if (pb) pb.style.display = 'none';
  if (hl) hl.style.display = 'none';
  if (ld) {
    ld.innerHTML = '<span>' + msg + '</span>' + (last ? '<span style="color:' + (isUp ? '#26a69a' : '#ef5350') + '">' + fmtP(last) + '</span>' : '');
    ld.style.display = 'flex';
  }
}

function buildPanel(s) {
  var d = document.createElement('div');
  d.className = 'panel';
  d.id = 'panel-' + s.sym;
  d.innerHTML =
    '<div class="ph">' +
      '<span class="dot" style="background:' + s.dot + '"></span>' +
      '<span class="sym">' + s.title + '</span>' +
      '<span class="tf" id="tf-' + s.sym + '">&middot; 5 &middot; NASDAQ</span>' +
    '</div>' +
    '<div class="usd">USD</div>' +
    '<div class="pline">' +
      '<span class="cp" id="cp-' + s.sym + '">--</span>' +
      '<span class="ch" id="ch-' + s.sym + '"></span>' +
    '</div>' +
    '<div class="ca" id="ca-' + s.sym + '">' +
      '<div class="wm"><div class="wm-s" id="wm-' + s.sym + '">' + s.sym + ', 5</div><div class="wm-n">' + s.name + '</div></div>' +
      '<div class="loading-p" id="ld-' + s.sym + '"><div class="sp"></div><span>Cargando...</span></div>' +
      '<canvas class="mc" id="cv-' + s.sym + '"></canvas>' +
      '<div class="yax"><canvas id="ya-' + s.sym + '"></canvas></div>' +
      '<div class="xax"><canvas id="xa-' + s.sym + '"></canvas></div>' +
      '<div class="hline" id="hl-' + s.sym + '"></div>' +
      '<div class="pbadge" id="pb-' + s.sym + '"></div>' +
    '</div>';
  wirePanelInteractions(s, d);
  return d;
}

function drawPanel(s, pts, livePrice) {
  var view = getViewState(s.sym);
  var atLatest = true;
  if (pts && pts.length > 2) {
    var fullPts = pts;
    var caForFit = document.getElementById('ca-' + s.sym);
    ensureTradingViewWindow(view, fullPts.length, caForFit ? caForFit.offsetWidth - 68 : 420);
    var visibleCount = getVisibleCount(view, fullPts.length);
    visibleCount = Math.min(fullPts.length, visibleCount);
    clampOffset(view, fullPts.length);
    atLatest = !view.xOffset || view.xOffset < 0.5;
    var end = fullPts.length - Math.round(view.xOffset || 0);
    end = clamp(end, visibleCount, fullPts.length);
    var start = Math.max(0, end - visibleCount);
    pts = fullPts.slice(start, end);
    if (atLatest) pts = removeTrailingFlatTail(pts);
  }

  var ld = document.getElementById('ld-' + s.sym);
  if (!pts || pts.length < 2) { showPanelMessage(s, 'Sin velas disponibles', {c:livePrice}); return; }
  if (ld) ld.style.display = 'none';

  var ca  = document.getElementById('ca-'  + s.sym);
  var cv  = document.getElementById('cv-'  + s.sym);
  var yaC = document.getElementById('ya-'  + s.sym);
  var xaC = document.getElementById('xa-'  + s.sym);
  var hl  = document.getElementById('hl-'  + s.sym);
  var pb  = document.getElementById('pb-'  + s.sym);

  var YAXW = 68, XAXH = 28;
  var totalW = ca.offsetWidth, totalH = ca.offsetHeight;
  var cW = totalW - YAXW, cH = totalH - XAXH;
  if (cW <= 0 || cH <= 0) return;
  var RIGHT_GAP = (cW / 5) * 1.5;

  var prices = [];
  pts.forEach(function(p){ prices.push(Number(p.c)); });
  var minP = Math.min.apply(null, prices);
  var maxP = Math.max.apply(null, prices);

  var chartLast = pts[pts.length - 1].c;
  var last = chartLast;
  var first = pts[0].c;
  var isUp = updateHeader(s, last, first);

  var scale = proportionalPriceScale(pts, last, minP, maxP, view.yZoom);
  var lo = scale.lo;
  var hi = scale.hi;
  var range = scale.range;

  var ctx = fitCanvas(cv, cW, cH);
  ctx.clearRect(0,0,cW,cH);

  ctx.strokeStyle = 'rgba(58,63,84,0.78)';
  ctx.lineWidth = 1;
  for (var i = 0; i <= 5; i++) {
    var gy = Math.round((cH/5)*i) + 0.5;
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(cW,gy); ctx.stroke();
  }
  for (var j = 0; j <= 5; j++) {
    var gx = Math.round((cW/5)*j) + 0.5;
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,cH); ctx.stroke();
  }

  var linePts = pts.slice();
  ctx.strokeStyle = '#eef1fb';
  ctx.lineWidth = 1.45;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  var lineCoords = [];
  for (var k = 0; k < linePts.length; k++) {
    var p = linePts[k];
    var px = (k / (linePts.length-1)) * Math.max(1, cW - RIGHT_GAP);
    var yc = cH - ((p.c - lo) / range) * cH;
    lineCoords.push({x:px, y:yc});
  }
  drawSmoothPriceLine(ctx, lineCoords);

  var lastY = cH - ((last - lo) / range) * cH;
  lastY = Math.max(1, Math.min(cH-1, lastY));
  var lastX = lineCoords.length ? lineCoords[lineCoords.length - 1].x : Math.max(1, cW - RIGHT_GAP);

  ctx.fillStyle = '#eef1fb';
  ctx.strokeStyle = '#030722';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  hl.style.display = 'block';
  hl.style.top = Math.round(lastY) + 'px';

  pb.style.display = 'block';
  pb.innerHTML = '<span>' + fmtP(last) + '</span><span class="cd">' + candleCountdownText(Date.now()) + '</span>';
  pb.style.top = Math.round(lastY) + 'px';
  pb.style.background = '#f2f4fa';

  var yCtx = fitCanvas(yaC, YAXW, cH);
  yCtx.clearRect(0,0,YAXW,cH);
  yCtx.fillStyle = '#030722';
  yCtx.fillRect(0,0,YAXW,cH);
  yCtx.fillStyle = '#787b86';
  yCtx.font = '11px Arial,Helvetica,sans-serif';
  yCtx.textAlign = 'right';
  var ySteps = 6;
  for (var yi = 0; yi <= ySteps; yi++) {
    if (yi === 0) continue;
    var yv  = hi - (range / ySteps) * yi;
    var ypy = Math.round((cH / ySteps) * yi);
    yCtx.fillStyle = '#303544';
    yCtx.fillRect(0, ypy, 5, 1);
    yCtx.fillStyle = '#e5e9f3';
    var labelY = Math.min(cH - 2, Math.max(9, ypy + 3));
    yCtx.fillText(fmtP(yv), YAXW - 10, labelY);
  }
  yCtx.fillStyle = '#555e72';
  yCtx.fillRect(0, Math.round(lastY), YAXW, 1);

  var xCtx = fitCanvas(xaC, cW, XAXH);
  xCtx.clearRect(0,0,cW,XAXH);
  xCtx.fillStyle = '#030722';
  xCtx.fillRect(0,0,cW,XAXH);
  xCtx.fillStyle = '#787b86';
  xCtx.font = '11px Arial,Helvetica,sans-serif';
  xCtx.textAlign = 'center';
  var spanMs = pts[pts.length - 1].t - pts[0].t;
  var xCount = spanMs > 36 * 60 * 60 * 1000 ? 6 : 5;
  var seen = {};
  for (var xi = 0; xi < xCount; xi++) {
    var xIdx = Math.round((xi / (xCount-1)) * (pts.length-1));
    var lbl = fmtX(pts[xIdx].t, spanMs);
    if (seen[lbl]) continue;
    seen[lbl] = true;
    var xpx = (xIdx / (pts.length-1)) * Math.max(1, cW - RIGHT_GAP);
    xCtx.fillText(lbl, Math.max(24, Math.min(cW-28, xpx)), 20);
  }
}

async function loadAll() {
  var btn = document.querySelector('.btn-ref');
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
  var fetches = STOCKS.map(function(s) {
    return Promise.all([fetchCandles(s.sym), fetchQuote(s.sym)])
      .then(function(res){ return {s:s, pts:res[0], quote:res[1]}; })
      .catch(async function(err){
        try { var q = await fetchQuote(s.sym); return {s:s, pts:[], quote:q, error:err}; }
        catch(e) { return {s:s, pts:[], quote:{}, error:err || e}; }
      });
  });
  var results = await Promise.all(fetches);
  results.forEach(function(r) {
    r.pts = mergeTickCandles(r.s.sym, r.pts);
    var livePrice = (r.quote && r.quote.c) ? r.quote.c : 0;
    LAST_RESULTS[r.s.sym] = r;
    if (r.pts && r.pts.length >= 2) drawPanel(r.s, r.pts, livePrice);
    else {
      var msg = r.error && r.error.message ? r.error.message : 'Sin velas disponibles';
      if (msg.length > 52) msg = msg.slice(0, 49) + '...';
      showPanelMessage(r.s, msg, r.quote);
    }
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Actualizar'; }
}

function startDashboard() {
  document.getElementById('api-screen').style.display = 'none';
  var dash = document.getElementById('dashboard');
  dash.style.display = 'flex';
  var grid = document.getElementById('grid');
  if (!grid.children.length) STOCKS.forEach(function(s){ grid.appendChild(buildPanel(s)); });
  if (CLOCK_TIMER) clearInterval(CLOCK_TIMER);
  CLOCK_TIMER = setInterval(updateClock, 1000);
  updateClock();
  connectSocket();
  setTimeout(function(){
    loadAll();
    if (REFRESH_TIMER) clearInterval(REFRESH_TIMER);
    REFRESH_TIMER = setInterval(loadAll, 60*1000);
    if (QUOTE_TIMER) clearInterval(QUOTE_TIMER);
    QUOTE_TIMER = setInterval(updateLiveQuotes, 2000);
  }, 80);
  window.addEventListener('resize', function(){
    setTimeout(function(){
      STOCKS.forEach(function(s){
        var r = LAST_RESULTS[s.sym];
        if (r && r.pts && r.pts.length >= 2) drawPanel(s, r.pts, r.quote && r.quote.c);
      });
    }, 100);
  });
}

(function init() {
  var saved = loadSavedKey();
  if (saved) { API_KEY = saved; }
  fetch('/api/config').then(function(r){ return r.json(); }).then(function(cfg){
    if (!saved && cfg.finnhubConfigured) {
      document.getElementById('api-input').placeholder = 'Key opcional — servidor ya configurado';
    }
  }).catch(function(){});
  startDashboard();
})();
