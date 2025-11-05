const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');

// create BUY/SELL order (protected)
router.post('/trade', requireAuth, async (req, res) => {
  try {
    const { symbol, type, quantity } = req.body;
    if (!symbol || !type || !quantity) return res.status(400).send('missing fields');

    // get current price (yahoo)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const r = await axios.get(url);
    const r0 = r.data && r.data.quoteResponse && r.data.quoteResponse.result && r.data.quoteResponse.result[0];
    const price = r0 && r0.regularMarketPrice ? Number(r0.regularMarketPrice) : null;
    if (!price) return res.status(500).send('price fetch failed');

    const order = await Order.create({
      user: req.user._id,
      symbol: symbol.toUpperCase(),
      type: type.toUpperCase(),
      quantity: Number(quantity),
      price: Number(price),
      status: 'EXECUTED'
    });

    res.redirect('/orders/portfolio?token=' + (req.query.token || req.body.token || ''));
  } catch (err) {
    console.error(err);
    res.status(500).send('order failed');
  }
});

// portfolio view (protected)
router.get('/portfolio', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    // compute holdings (aggregate)
    const holdings = {};
    for (const o of orders) {
      const s = o.symbol;
      const mul = o.type === 'BUY' ? 1 : -1;
      if (!holdings[s]) holdings[s] = { qty: 0, avgPriceSum: 0, totalCost: 0 };
      holdings[s].qty += o.quantity * mul;
      holdings[s].totalCost = (holdings[s].totalCost || 0) + o.price * o.quantity * mul;
    }
    // convert to array
    const holdingList = Object.keys(holdings).map(sym => {
      return { symbol: sym, qty: holdings[sym].qty, totalCost: Number(holdings[sym].totalCost.toFixed(2)) };
    });
    res.render('portfolio', { orders, holdingList, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('portfolio error');
  }
});

module.exports = router;
