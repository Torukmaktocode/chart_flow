// ══════════════════════════════════════════════════════════════
// TRADING WAR ROOM — Backend FREE EDITION v3.0
// 100% gratuito — sin API keys — solo RSS públicos + Yahoo Finance
// Fuentes: Reuters · AP · MarketWatch · CNBC · Yahoo · Truth Social · Fed
// Ejecutar: node server.js  |  Puerto: 3001
// ══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const Parser  = require('rss-parser');

const app    = express();
const parser = new Parser({
  timeout: 9000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept':     'application/rss+xml, application/xml, text/xml, */*',
  }
});

app.use(cors());
app.use(express.json());

// ── CACHE ─────────────────────────────────────────────────────
let newsCache     = [];
let mktCache      = {};
let lastNewsFetch = 0;
let lastMktFetch  = 0;
const NEWS_TTL    = 90 * 1000;
const MKT_TTL     = 20 * 1000;

// ── FEEDS RSS 100% GRATUITOS ──────────────────────────────────
const RSS_FEEDS = [
  // Reuters
  { url: 'https://feeds.reuters.com/reuters/businessNews',          src: 'REUTERS',       cls: 'sr' },
  { url: 'https://feeds.reuters.com/reuters/technologyNews',        src: 'REUTERS TECH',  cls: 'sr' },
  { url: 'https://feeds.reuters.com/reuters/topNews',               src: 'REUTERS TOP',   cls: 'sr' },
  // AP News
  { url: 'https://apnews.com/rss/business',                         src: 'AP NEWS',       cls: 'sa' },
  { url: 'https://apnews.com/rss/financial-markets',                src: 'AP MARKETS',    cls: 'sa' },
  { url: 'https://apnews.com/rss/technology',                       src: 'AP TECH',       cls: 'sa' },
  // MarketWatch
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',  src: 'MARKETWATCH',   cls: 'sb' },
  { url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/', src: 'MW PULSE',      cls: 'sb' },
  // CNBC
  { url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',  src: 'CNBC',          cls: 'sc' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',   src: 'CNBC TECH',     cls: 'sc' },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',   src: 'CNBC MARKETS',  cls: 'sc' },
  // Yahoo Finance
  { url: 'https://finance.yahoo.com/rss/topstories',               src: 'YAHOO FIN',     cls: 'sy' },
  { url: 'https://finance.yahoo.com/rss/2.0/headline?s=^NDX&region=US&lang=en-US',  src: 'YAHOO NAS',  cls: 'sy' },
  { url: 'https://finance.yahoo.com/rss/2.0/headline?s=NVDA&region=US&lang=en-US', src: 'YAHOO NVDA', cls: 'sy' },
  // Seeking Alpha (gratis sin login)
  { url: 'https://seekingalpha.com/market_currents.xml',            src: 'SEEKING ALPHA', cls: 'ss' },
  // Investing.com
  { url: 'https://www.investing.com/rss/news_301.rss',              src: 'INVESTING',     cls: 'si' },
  { url: 'https://www.investing.com/rss/news_285.rss',              src: 'INVEST FX',     cls: 'si' },
  // Bloomberg RSS (sin paywall en RSS)
  { url: 'https://feeds.bloomberg.com/markets/news.rss',            src: 'BLOOMBERG',     cls: 'sbl' },
  // Federal Reserve — comunicados y discursos oficiales
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml',      src: 'FED RESERVE',   cls: 'sf' },
  { url: 'https://www.federalreserve.gov/feeds/speeches.xml',       src: 'FED SPEECHES',  cls: 'sf' },
  // Trump / Truth Social — RSS oficial cuenta @realDonaldTrump
  // URL directa: https://truthsocial.com/@realDonaldTrump
  { url: 'https://truthsocial.com/@realDonaldTrump/feed.rss', src: 'TRUMP DIRECTO', cls: 'st-direct', trump: true, trumpDirect: true },
  // Barron's
  { url: 'https://www.barrons.com/rss/homepage',                    src: "BARRON'S",      cls: 'sbr' },
];

// ── NLP: IMPACTO ──────────────────────────────────────────────
function scoreImpact(text) {
  const t = (text || '').toLowerCase();
  if (/federal reserve|fomc|rate decision|rate cut|rate hike|powell.*said|cpi.*data|nfp data|nonfarm payroll|trump.*tariff|tariff.*china|china.*retali|market crash|circuit breaker/.test(t)) return 'c';
  if (/trump|nasdaq|s&p 500|dow jones|fed |inflation|gdp|unemployment|earnings beat|earnings miss|nvda|aapl|msft|googl|amzn|meta|tsla|rate|yield|vix|tariff|trade war|semiconductor/.test(t)) return 'h';
  if (/stock|market|dollar|oil|crude|gold|bitcoin|crypto|economic|quarterly|revenue|profit|guidance/.test(t)) return 'm';
  return 'l';
}

function categorize(text) {
  const t = (text || '').toLowerCase();
  if (/trump|truth social|white house|executive order|mar.a.lago|tariff.*announc/.test(t)) return 'trump';
  if (/federal reserve|fed |fomc|powell|inflation|cpi|pce|nfp|payroll|yield|rate cut|rate hike|treasury/.test(t)) return 'fed';
  if (/nvda|nvidia|apple|microsoft|google|amazon|meta|tesla|alphabet|semiconductor|ai chip|earnings|quarterly result/.test(t)) return 'tech';
  if (/nasdaq|s&p 500|dow jones|vix|wall street|futures|options|trading session|stock market/.test(t)) return 'markets';
  return 'general';
}

function extractTags(text) {
  const t = (text || '').toLowerCase();
  const map = [
    ['NAS100',    /nasdaq|nas100|ndx|qqq/],
    ['TRUMP',     /trump/],
    ['FED',       /\bfed\b|fomc|rate|powell|reserve/],
    ['CPI',       /cpi|inflation|pce|core price/],
    ['NFP',       /nfp|payroll|nonfarm|job/],
    ['ARANCELES', /tariff|trade war|sanction|import duty/],
    ['EARNINGS',  /earn|eps|quarterly|revenue|beat|miss/],
    ['RALLY',     /rally|surge|jump|soar|spike|gain/],
    ['CRASH',     /crash|plunge|slump|sink|\bfall\b|drop|decline/],
    ['VOL',       /vix|volatil/],
    ['AI',        /artificial intel|\bai\b|machine learn|chatgpt|openai/],
    ['CHINA',     /china|beijing|xi jinping/],
    ['YIELDS',    /yield|treasury|bond/],
  ];
  return map.filter(([, rx]) => rx.test(t)).map(([tag]) => tag).slice(0, 5);
}

// ── MOTOR NAS100 ──────────────────────────────────────────────
function mk(dir, key, mag, conf, es, en) { return { dir, key, mag, conf, es, en }; }

function analyzeNas(title, body, cat, tags) {
  const tx = ((title || '') + ' ' + (body || '')).toLowerCase();

  // Fed
  if (/rate cut|dovish|lower rate|pause hike|accommodat|cut rates/.test(tx))
    return mk('bull','fed_bull','high',91,'Fed dovish → tasas bajan → múltiplos tech se expanden → NAS100 sube','Dovish Fed → lower rates → tech multiples expand → NAS100 higher');
  if (/rate hike|hawkish|higher.*longer|tighten|not.*cut|too early to cut/.test(tx))
    return mk('bear','fed_bear','high',92,'Fed hawkish → tasas altas → compresión múltiplos → NAS100 cae','Hawkish Fed → higher rates → multiple compression → NAS100 lower');

  // CPI
  if (/cpi.*above|inflation.*above|hot.*cpi|above.*forecast|hotter.*expect/.test(tx))
    return mk('bear','cpi_bear','high',94,'CPI caliente → más alzas Fed → valuaciones tech bajo presión → NAS100 baja','Hot CPI → more Fed hikes → tech valuations under pressure → NAS100 lower');
  if (/cpi.*below|inflation.*cool|lower.*inflation|core.*fall|inflation.*ease/.test(tx))
    return mk('bull','cpi_bull','high',89,'CPI frío → Fed puede recortar → growth stocks suben → NAS100 al alza','Cool CPI → Fed can cut → growth stocks rally → NAS100 higher');

  // NFP
  if (/strong.*job|nfp.*above|payroll.*beat|job.*gain|unemployment.*fall/.test(tx))
    return mk('bear','nfp_bear','med',72,'NFP fuerte → presión inflacionaria → Fed hawkish → NAS100 cae','Strong NFP → inflation risk → hawkish Fed → NAS100 lower');
  if (/job.*weak|nfp.*below|payroll.*miss|unemploy.*rise|job.*cut|layoff/.test(tx))
    return mk('bull','nfp_bull','med',70,'NFP débil → menor presión Fed → growth stocks suben → NAS100 sube','Weak NFP → less Fed pressure → growth stocks rally → NAS100 higher');

  // Trump aranceles
  if (/tariff.*pause|pause.*tariff|trade.*deal|deal.*china|trade.*agreement|extend.*pause/.test(tx))
    return mk('bull','trump_deal','high',85,'Pausa/acuerdo aranceles → alivio cadenas suministro → tech rallya → NAS100 sube','Tariff pause/deal → supply chain relief → tech rallies → NAS100 higher');
  if (/new tariff|impose.*tariff|tariff.*china|ban.*chip|restrict.*export|trade war escalat/.test(tx))
    return mk('bear','trump_tariff','high',88,'Nuevos aranceles → costos tech suben → márgenes caen → NAS100 baja','New tariffs → higher tech costs → margins squeezed → NAS100 lower');
  if (/deregul|executive order.*ai|ai.*freedom|cut.*regulation/.test(tx))
    return mk('bull','trump_dereg','med',76,'Desregulación tech/AI → múltiplos se expanden → NAS100 sube','Tech/AI deregulation → multiple expansion → NAS100 higher');

  // Earnings
  if (/beat.*estimate|above.*expect|raise.*guidance|record.*revenue|blowout/.test(tx))
    return mk('bull','earn_bull','high',87,'Earnings tech positivos → sector AI al alza → NAS100 +1 a +2%','Positive tech earnings → AI sector rallies → NAS100 +1 to +2%');
  if (/miss.*estimate|below.*expect|lower.*guidance|disappoint|weak.*outlook/.test(tx))
    return mk('bear','earn_bear','high',85,'Decepción earnings → sector vende → NAS100 bajo presión','Earnings miss → sector sells off → NAS100 under pressure');

  // Yields
  if (/yield.*rise|10.year.*high|treasury.*sell|bond.*sell/.test(tx))
    return mk('bear','yield_bear','med',83,'Yields suben → mayor tasa descuento flujos tech → NAS100 cae','Yields rise → higher discount rate for tech → NAS100 lower');
  if (/yield.*fall|yield.*drop|treasury.*rally|bond.*rally/.test(tx))
    return mk('bull','yield_bull','med',80,'Yields bajan → growth stocks más atractivos → NAS100 sube','Yields fall → growth stocks more attractive → NAS100 higher');

  // VIX
  if (/vix.*spike|vix.*jump|vix.*surge|fear.*index.*rise/.test(tx))
    return mk('bear','vix_bear','high',90,'VIX spike → risk-off masivo → NAS100 vende como activo de riesgo','VIX spike → mass risk-off → NAS100 sells off as risk asset');

  // China supply chain
  if (/china.*ban|restrict.*chip|export.*control|rare earth|chip.*shortage/.test(tx))
    return mk('bear','china_bear','high',88,'Restricciones supply chain → riesgo producción tech → NAS100 presionado','Supply chain restrictions → tech production risk → NAS100 under pressure');

  // Tags catch-all
  if (tags.includes('RALLY') && (tags.includes('NAS100') || cat === 'tech'))
    return mk('bull','general_bull','med',62,'Movimiento alcista en tech/NAS100','Risk/tech rally → NAS100 higher');
  if (tags.includes('CRASH'))
    return mk('bear','general_bear','high',75,'Sell-off en activos de riesgo → NAS100 cae','Risk asset sell-off → NAS100 lower');

  return mk('neu', null, 'low', 40, 'Impacto directo en NAS100 no determinado', 'Direct NAS100 impact undetermined');
}

// ── FETCH UN FEED ─────────────────────────────────────────────
async function fetchOne(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).slice(0, 14).map(item => {
      const title = (item.title || '').trim();
      const body  = (item.contentSnippet || item.summary || item.content || '')
                      .replace(/<[^>]+>/g, '').trim().slice(0, 400);
      const full  = title + ' ' + body;
      const tags  = extractTags(full);
      const cat   = feed.trump ? 'trump' : categorize(full);
      const nas   = analyzeNas(title, body, cat, tags);
      return {
        id:          Buffer.from(title).toString('base64').slice(0, 18),
        src:         feed.src,
        cls:         feed.cls,
        imp:         scoreImpact(full),
        cat,
        ts:          item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        title,
        body,
        tags,
        trump:       !!feed.trump,
        trumpDirect: !!feed.trumpDirect,   // ← TRUE solo para @realDonaldTrump oficial
        url:         item.link || '',
        nasDir:      nas.dir,
        nasKey:      nas.key,
        nasMag:      nas.mag,
        conf:        nas.conf,
        nasEs:       nas.es,
        nasEn:       nas.en,
      };
    });
  } catch {
    return [];
  }
}

// ── MÓDULO SQUAWK X (@DeItaone @FirstSquawk @LiveSquawk) ─────
// ─────────────────────────────────────────────────────────────
// X (Twitter) no tiene RSS público. Estrategia en cascada:
//   1. Nitter (mirrors públicos de Twitter con RSS)
//   2. RSS bridge vía rss.app
//   3. LiveSquawk.com tiene su propio feed RSS (gratis)
//   4. Si todo falla → caché anterior + log de advertencia
// El servidor rota instancias de Nitter automáticamente.
// ─────────────────────────────────────────────────────────────

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.cz',
  'https://nitter.1d4.us',
  'https://twiiit.com',
  'https://nitter.unixfox.eu',
  'https://nitter.lunar.icu',
  'https://bird.trom.tf',
  'https://nitter.rawbit.ninja',
  'https://n.opnxng.com',
  'https://xcancel.com',
];

// Cuentas Squawk
const SQUAWK_ACCOUNTS = [
  {
    handle:  'DeItaone',
    src:     '@DeItaone',
    cls:     'sq-delta',
    color:   '#7c3aed',     // violeta
    label:   'DELTA ONE',
    bio:     'Breaking market news bot — ultra-rápido, sin editorial',
  },
  {
    handle:  'FirstSquawk',
    src:     '@FirstSquawk',
    cls:     'sq-first',
    color:   '#0ea5e9',     // azul cielo
    label:   'FIRST SQUAWK',
    bio:     'Noticias financieras breaking desde sala de trading',
  },
  {
    handle:  'LiveSquawk',
    src:     '@LiveSquawk',
    cls:     'sq-live',
    color:   '#10b981',     // verde
    label:   'LIVE SQUAWK',
    bio:     'Noticias de mercado en tiempo real — tono profesional',
  },
];

let workingNitter  = '';        // instancia que funcionó la última vez
let squawkCache    = [];        // cache propio para squawk
let lastSquawkFetch = 0;
const SQUAWK_TTL   = 60 * 1000; // refresca cada 60s (más rápido que el resto)

// Probar si una instancia de Nitter responde con RSS válido
async function probeNitter(base, handle) {
  const url = `${base}/${handle}/rss`;
  const res = await fetch(url, {
    timeout: 5000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'application/rss+xml, application/xml, text/xml, */*',
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('<rss') && !text.includes('<feed')) throw new Error('No RSS');
  if (!text.includes('<item') && !text.includes('<entry')) throw new Error('Sin items');
  return text;
}

// Encontrar instancia de Nitter que funcione
async function findWorkingNitter(handle) {
  // Primero intenta la que funcionó antes
  if (workingNitter) {
    try {
      const xml = await probeNitter(workingNitter, handle);
      return { base: workingNitter, xml };
    } catch { workingNitter = ''; }
  }
  // Rotar por todas las instancias
  for (const inst of NITTER_INSTANCES) {
    try {
      const xml = await probeNitter(inst, handle);
      workingNitter = inst;
      console.log(`[SQUAWK] Nitter OK: ${inst}`);
      return { base: inst, xml };
    } catch { /* siguiente */ }
  }
  throw new Error('Ninguna instancia de Nitter disponible');
}

// Parsear el XML de Nitter y convertir a formato estándar
function parseNitterXML(xml, account) {
  const items = [];
  // Soporta tanto Atom (<entry>) como RSS (<item>)
  const blockRx  = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  const titleRx   = /<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
  const linkRx    = /<(?:link|guid)[^>]*>([^<]+)/;
  const dateRx    = /<(?:pubDate|updated|dc:date)>([^<]+)/;
  const contentRx = /<(?:description|content(?::\w+)?)(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|content(?::\w+)?)>/;

  let match;
  while ((match = blockRx.exec(xml)) !== null) {
    const block   = match[1];
    const titleM  = block.match(titleRx);
    const linkM   = block.match(linkRx);
    const dateM   = block.match(dateRx);
    const bodyM   = block.match(contentRx);
    if (!titleM) continue;

    const rawTitle = titleM[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
    const rawBody  = bodyM ? bodyM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim().slice(0,400) : '';
    const url      = linkM ? linkM[1].trim() : '';
    const ts       = dateM ? new Date(dateM[1]).getTime() : Date.now();

    // Saltar retweets y respuestas si son vacíos
    if (!rawTitle || rawTitle.length < 5) continue;
    // El handle del tweet suele venir como "Account: texto" — limpiar
    const title    = rawTitle.replace(new RegExp(`^${account.handle}:\\s*`, 'i'), '').trim() || rawTitle;

    const full   = title + ' ' + rawBody;
    const tags   = extractTags(full);
    const cat    = 'squawk';
    const nas    = analyzeNas(title, rawBody, cat, tags);

    items.push({
      id:          Buffer.from(title).toString('base64').slice(0, 18),
      src:         account.src,
      cls:         account.cls,
      imp:         scoreImpact(full),
      cat:         'squawk',
      squawk:      true,
      squawkMeta:  { handle: account.handle, color: account.color, label: account.label },
      ts,
      title,
      body:        rawBody,
      tags,
      trump:       false,
      trumpDirect: false,
      url:         url.startsWith('http') ? url : `https://x.com/${account.handle}`,
      nasDir:      nas.dir,
      nasKey:      nas.key,
      nasMag:      nas.mag,
      conf:        nas.conf,
      nasEs:       nas.es,
      nasEn:       nas.en,
    });
  }
  return items;
}

// Fuente alternativa: LiveSquawk.com tiene su propio feed
async function fetchLiveSquawkDirect() {
  const urls = [
    'https://www.livesquawk.com/feed/',
    'https://www.livesquawk.com/rss.xml',
    'https://livesquawk.com/feed/',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        timeout: 7000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,*/*' }
      });
      if (!res.ok) continue;
      const parsed = await parser.parseURL(url);
      return (parsed.items || []).slice(0, 15).map(item => {
        const title = (item.title || '').trim();
        const body  = (item.contentSnippet || '').slice(0, 300);
        const full  = title + ' ' + body;
        const tags  = extractTags(full);
        const nas   = analyzeNas(title, body, 'squawk', tags);
        return {
          id: Buffer.from(title).toString('base64').slice(0,18),
          src: '@LiveSquawk', cls: 'sq-live',
          imp: scoreImpact(full), cat: 'squawk', squawk: true,
          squawkMeta: { handle:'LiveSquawk', color:'#10b981', label:'LIVE SQUAWK' },
          ts: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          title, body, tags, trump:false, trumpDirect:false,
          url: item.link || 'https://x.com/LiveSquawk',
          nasDir:nas.dir, nasKey:nas.key, nasMag:nas.mag, conf:nas.conf,
          nasEs:nas.es, nasEn:nas.en,
        };
      });
    } catch { continue; }
  }
  return [];
}

// Fetch principal de todas las cuentas Squawk
async function fetchAllSquawk() {
  const all = [];

  // Intentar LiveSquawk.com directo primero (sin Nitter)
  try {
    const ls = await fetchLiveSquawkDirect();
    if (ls.length) {
      all.push(...ls);
      console.log(`[SQUAWK] LiveSquawk.com directo: ${ls.length} posts`);
    }
  } catch {}

  // Fetch de cada cuenta via Nitter
  for (const account of SQUAWK_ACCOUNTS) {
    // LiveSquawk ya se obtuvo arriba si hubo feed directo
    if (account.handle === 'LiveSquawk' && all.some(n => n.src === '@LiveSquawk')) continue;
    try {
      const { xml } = await findWorkingNitter(account.handle);
      const items   = parseNitterXML(xml, account);
      all.push(...items);
      console.log(`[SQUAWK] ${account.src}: ${items.length} posts via Nitter`);
    } catch (e) {
      console.warn(`[SQUAWK] ${account.src} falló: ${e.message}`);
    }
  }

  if (all.length > 0) {
    // Deduplicar y ordenar
    const seen = new Set();
    const unique = all.filter(n => {
      const k = n.title.slice(0,40).toLowerCase().replace(/\s+/g,'');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    unique.sort((a,b) => b.ts - a.ts);
    squawkCache     = unique.slice(0, 60);
    lastSquawkFetch = Date.now();
    console.log(`[SQUAWK] Total: ${squawkCache.length} posts`);
  } else {
    console.warn('[SQUAWK] Sin datos de ninguna fuente — manteniendo caché');
  }
  return squawkCache;
}

// ── AGREGAR TODOS LOS FEEDS ───────────────────────────────────
async function fetchAllNews() {
  console.log(`[${new Date().toISOString().slice(11,19)}] Actualizando ${RSS_FEEDS.length} feeds RSS...`);
  const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchOne(f)));
  let all = [];
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });

  // Incluir squawk en el cache general también
  all.push(...squawkCache);

  // Deduplicar
  const seen = new Set();
  all = all.filter(n => {
    const key = n.title.slice(0, 50).toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  all.sort((a, b) => b.ts - a.ts);
  newsCache     = all.slice(0, 150);
  lastNewsFetch = Date.now();

  const srcs = [...new Set(newsCache.map(n => n.src))].length;
  console.log(`[OK] ${newsCache.length} artículos de ${srcs} fuentes activas`);
  return newsCache;
}

// ── ROUTE /api/squawk ─────────────────────────────────────────
// ── ROUTES ────────────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  if (Date.now() - lastNewsFetch > NEWS_TTL) await fetchAllNews();
  let items = [...newsCache];
  const { cat, imp, q } = req.query;
  if (cat && cat !== 'all') items = items.filter(n => n.cat === cat);
  if (imp)  items = items.filter(n => n.imp === imp);
  if (q)    items = items.filter(n =>
    n.title.toLowerCase().includes(q.toLowerCase()) ||
    (n.body || '').toLowerCase().includes(q.toLowerCase())
  );
  res.json({ ok: true, count: items.length, lastFetch: lastNewsFetch, items });
});

app.get('/api/squawk', async (req, res) => {
  if (Date.now() - lastSquawkFetch > SQUAWK_TTL) await fetchAllSquawk();
  res.json({
    ok:         true,
    count:      squawkCache.length,
    lastFetch:  lastSquawkFetch,
    nitter:     workingNitter || 'sin instancia activa',
    items:      squawkCache,
  });
});

app.get('/api/markets', async (req, res) => {
  if (Date.now() - lastMktFetch > MKT_TTL) await fetchPrices();
  res.json({ ok: true, lastFetch: lastMktFetch, prices: mktCache });
});

app.get('/api/trump', async (req, res) => {
  if (Date.now() - lastNewsFetch > NEWS_TTL) await fetchAllNews();
  const items = newsCache.filter(n => n.trump || n.cat === 'trump');
  res.json({ ok: true, count: items.length, items });
});

app.get('/api/impact', (req, res) => {
  const recent = newsCache.filter(n => Date.now() - n.ts < 7200000);
  let bull = 0, bear = 0;
  recent.forEach(n => {
    const w = n.imp === 'c' ? 3 : n.imp === 'h' ? 2 : 1;
    if (n.nasDir === 'bull') bull += w;
    else if (n.nasDir === 'bear') bear += w;
  });
  const bias = bull > bear + 3 ? 'bull' : bear > bull + 3 ? 'bear' : 'neu';
  res.json({
    ok: true, bias, bull, bear, score: bull - bear,
    topImpact: newsCache.filter(n => n.nasDir && n.nasDir !== 'neu').slice(0, 6),
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    ok:          true,
    articles:    newsCache.length,
    squawk:      squawkCache.length,
    sources:     [...new Set(newsCache.map(n => n.src))].length,
    feedCount:   RSS_FEEDS.length,
    nitter:      workingNitter || 'sin instancia activa',
    lastNews:    new Date(lastNewsFetch).toISOString(),
    lastSquawk:  lastSquawkFetch ? new Date(lastSquawkFetch).toISOString() : 'nunca',
    lastMarket:  new Date(lastMktFetch).toISOString(),
    cost:        '$0/mes — 100% gratuito',
  });
});

// ── ARRANCAR ──────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  TRADING WAR ROOM — FREE EDITION v4.0       ║');
  console.log('║  RSS · Squawk X · Nitter · Yahoo Finance     ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`  http://localhost:${PORT}/api/news`);
  console.log(`  http://localhost:${PORT}/api/squawk`);
  console.log(`  http://localhost:${PORT}/api/status\n`);

  // Fetch paralelo inicial
  await Promise.allSettled([
    fetchAllSquawk(),
    fetchAllNews(),
    fetchPrices(),
  ]);

  setInterval(fetchAllSquawk, SQUAWK_TTL);
  setInterval(fetchAllNews,   NEWS_TTL);
  setInterval(fetchPrices,    MKT_TTL);
});
// ── SÍMBOLOS ──────────────────────────────────────────────────
const SYMBOLS = {
  'NAS100': '^NDX',
  'SPX':    '^GSPC',
  'DOW':    '^DJI',
  'VIX':    '^VIX',
  'DXY':    'DX-Y.NYB',
  'US10Y':  '^TNX',
  'GOLD':   'GC=F',
  'CRUDE':  'CL=F',
  'NVDA':   'NVDA',
  'AAPL':   'AAPL',
  'MSFT':   'MSFT',
  'META':   'META',
  'GOOGL':  'GOOGL',
  'AMZN':   'AMZN',
  'TSLA':   'TSLA',
  'AMD':    'AMD',
  'BTC':    'BTC-USD',
};
const REV_MAP = Object.fromEntries(Object.entries(SYMBOLS).map(([k, v]) => [v, k]));

// Crumb/cookie de Yahoo (se renueva cuando expira)
let yfCrumb  = '';
let yfCookie = '';

async function refreshYahooCrumb() {
  // Obtener cookie de consent
  const r1 = await fetch('https://fc.yahoo.com', {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const raw = r1.headers.get('set-cookie') || '';
  // Extraer solo la cookie A1 que necesita Yahoo
  const a1match = raw.match(/A1=[^;]+/);
  yfCookie = a1match ? a1match[0] : raw.split(';')[0];

  // Obtener crumb con esa cookie
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Cookie': yfCookie,
      'Accept': '*/*',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  const crumb = await r2.text();
  if (!crumb || crumb.length < 4 || crumb.includes('Host not')) {
    throw new Error('Crumb inválido: ' + crumb.slice(0, 30));
  }
  yfCrumb = crumb.trim();
  console.log('[MKT] Yahoo crumb OK');
}

// ── MÉTODO 1: Yahoo Finance v8 con crumb ─────────────────────
async function fetchYahooV8() {
  if (!yfCrumb) await refreshYahooCrumb();
  const syms = Object.values(SYMBOLS).join(',');
  const url  = `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(syms)}&crumb=${encodeURIComponent(yfCrumb)}`;
  const res  = await fetch(url, {
    timeout: 12000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': yfCookie,
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  if (res.status === 401 || res.status === 403) {
    yfCrumb = ''; // fuerza refresh del crumb la próxima vez
    throw new Error(`Yahoo v8 auth ${res.status} — crumb expirado`);
  }
  if (!res.ok) throw new Error(`Yahoo v8 HTTP ${res.status}`);
  const data   = await res.json();
  const quotes = data?.quoteResponse?.result || [];
  if (!quotes.length) throw new Error('Yahoo v8: respuesta vacía');
  const prices = {};
  quotes.forEach(q => {
    const name = REV_MAP[q.symbol];
    if (!name) return;
    prices[name] = {
      price:     q.regularMarketPrice,
      change:    q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      high:      q.regularMarketDayHigh,
      low:       q.regularMarketDayLow,
      volume:    q.regularMarketVolume,
      prev:      q.regularMarketPreviousClose,
      state:     q.marketState,
    };
  });
  return prices;
}

// ── MÉTODO 2: Stooq.com (gratis, sin auth, funciona en Windows) ──
// Stooq no requiere API key y sirve CSV directamente
const STOOQ_SYMS = {
  'NAS100': 'ndx',      // Nasdaq 100
  'SPX':    'spx',      // S&P 500
  'DOW':    'dji',      // Dow Jones
  'VIX':    'vix',      // VIX
  'NVDA':   'nvda.us',  // NVDA
  'AAPL':   'aapl.us',  // Apple
  'MSFT':   'msft.us',  // Microsoft
  'META':   'meta.us',  // Meta
  'GOOGL':  'googl.us', // Alphabet
  'AMZN':   'amzn.us',  // Amazon
  'TSLA':   'tsla.us',  // Tesla
  'AMD':    'amd.us',   // AMD
  'GOLD':   'xauusd',   // Gold spot
  'CRUDE':  'cl.f',     // Crude futures
  'BTC':    'btcusd',   // Bitcoin
};

async function fetchStooqOne(name, sym) {
  const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
  const res  = await fetch(url, {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/csv, text/plain, */*',
      'Referer': 'https://stooq.com/',
    }
  });
  if (!res.ok) throw new Error(`Stooq ${sym} HTTP ${res.status}`);
  const text  = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error(`Stooq ${sym}: sin datos`);
  // CSV header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const cols  = lines[1].split(',');
  const close = parseFloat(cols[6]);
  const open  = parseFloat(cols[3]);
  const high  = parseFloat(cols[4]);
  const low   = parseFloat(cols[5]);
  if (isNaN(close) || close === 0) throw new Error(`Stooq ${sym}: precio inválido`);
  const change    = close - open;
  const changePct = open > 0 ? (change / open) * 100 : 0;
  return { price: close, change, changePct, high, low, prev: open, volume: parseInt(cols[7]) || 0, state: 'REGULAR' };
}

async function fetchStooq() {
  const results = await Promise.allSettled(
    Object.entries(STOOQ_SYMS).map(([name, sym]) =>
      fetchStooqOne(name, sym).then(data => ({ name, data }))
    )
  );
  const prices = {};
  let ok = 0;
  results.forEach(r => {
    if (r.status === 'fulfilled') { prices[r.value.name] = r.value.data; ok++; }
  });
  if (ok === 0) throw new Error('Stooq: ningún símbolo respondió');
  return prices;
}

// ── MÉTODO 3: Coinbase REST v2 (BTC/ETH, sin key) ────────────
async function fetchCoinbase() {
  const pairs = { 'BTC': 'BTC-USD', 'ETH': 'ETH-USD' };
  const prices = {};
  await Promise.allSettled(Object.entries(pairs).map(async ([name, pair]) => {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, { timeout: 5000 });
    if (!res.ok) return;
    const d = await res.json();
    const price = parseFloat(d?.data?.amount);
    if (!isNaN(price)) prices[name] = { price, change: 0, changePct: 0, high: price, low: price, prev: price, state: 'REGULAR' };
  }));
  return prices;
}

// ── ORQUESTADOR: prueba Yahoo → Stooq → caché ────────────────
async function fetchPrices() {
  // Intento 1: Yahoo Finance v8 con crumb (más datos, más preciso)
  try {
    const prices = await fetchYahooV8();
    // Complementar BTC con Coinbase si Yahoo no lo devuelve bien
    if (!prices['BTC']) {
      try { const cb = await fetchCoinbase(); Object.assign(prices, cb); } catch {}
    }
    mktCache     = prices;
    lastMktFetch = Date.now();
    console.log(`[MKT] Yahoo v8 OK — ${Object.keys(prices).length} símbolos`);
    return prices;
  } catch (e) {
    console.warn(`[MKT] Yahoo v8 falló (${e.message}) — probando Stooq...`);
  }

  // Intento 2: Stooq (funciona sin auth en cualquier red normal)
  try {
    const prices = await fetchStooq();
    // Añadir BTC desde Coinbase
    try { const cb = await fetchCoinbase(); Object.assign(prices, cb); } catch {}
    mktCache     = prices;
    lastMktFetch = Date.now();
    console.log(`[MKT] Stooq OK — ${Object.keys(prices).length} símbolos`);
    return prices;
  } catch (e) {
    console.warn(`[MKT] Stooq falló (${e.message}) — usando caché anterior`);
    return mktCache;
  }
}

// ── FIN DEL ARCHIVO ──────────────────────────────────────────
