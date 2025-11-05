const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const Order = require('../models/Order');

// helper: fetch quote from Yahoo Finance
async function fetchQuoteYahoo(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const resp = await axios.get(url, { timeout: 5000 });
    const r = resp.data && resp.data.quoteResponse && resp.data.quoteResponse.result && resp.data.quoteResponse.result[0];
    if (!r) return { symbol, price: null, change: null };
    return { symbol: r.symbol, price: r.regularMarketPrice, change: r.regularMarketChange };
  } catch (err) {
    console.error('Yahoo fetch error', err.message);
    return { symbol, price: null, change: null };
  }
}

// Watchlist dashboard (optionally accept token in query to customize)
router.get('/', async (req, res) => {
  // optional token in query: keep for links to trading actions
  const token = req.query.token || '';
  let stocks = [];
  try {
    stocks = await Stock.find().sort({ createdAt: -1 }).lean();
  } catch (err) {
    console.warn('DB read failed (running fallback):', err.message);
    stocks = [];
  }

  // fetch quotes for each
  const quotes = await Promise.all(stocks.map(s => fetchQuoteYahoo(s.symbol)));
  const merged = stocks.map((s, i) => ({ ...s, quote: quotes[i] }));
  res.render('index', { stocks: merged, token });
});

// add page
router.get('/add', (req, res) => res.render('add'));

// add POST
router.post('/add', async (req, res) => {
  const { symbol, name, note } = req.body;
  if (!symbol) return res.redirect('/stocks/add');
  try {
    await Stock.create({ symbol: symbol.toUpperCase(), name, note });
    res.redirect('/stocks');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding');
  }
});

// individual stock page with live chart data from Yahoo
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const token = req.query.token || '';
  // meta from DB if exists
  const meta = await Stock.findOne({ symbol }).lean().catch(()=>null);
  const quote = await fetchQuoteYahoo(symbol);

  // fetch intraday chart points via Yahoo chart API (range=1d for 1 day)
  let chart = { labels: [], data: [] };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const r = await axios.get(url, { timeout: 5000 });
    const result = r.data && r.data.chart && r.data.chart.result && r.data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;
      chart.labels = timestamps.map(ts => new Date(ts*1000).toLocaleTimeString());
      chart.data = prices.map(p => p === null ? 0 : Number(p.toFixed ? p.toFixed(2) : p));
    }
  } catch (err) {
    console.warn('Chart fetch failed', err.message);
    // fallback: random mock
    const now = Date.now();
    const points = 24;
    for (let i=points-1;i>=0;i--) {
      chart.labels.push(new Date(now - i*3600*1000).toLocaleTimeString());
      chart.data.push((Number(quote.price || 100) * (0.95 + Math.random()*0.1)).toFixed(2));
    }
  }

  res.render('stock', { symbol, meta, quote, chart, token });
});

// simple API endpoint for live quote
router.get('/api/quote/:symbol', async (req, res) => {
  const q = await fetchQuoteYahoo(req.params.symbol);
  res.json(q);
});

module.exports = router;
