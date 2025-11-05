require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const authRouter = require('./routes/auth');
const stocksRouter = require('./routes/stocks');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// DB connect
(async () => {
  if (!MONGO_URI) {
    console.log('⚠️ MONGO_URI missing — running in fallback mode (DB disabled)');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connect failed:', err.message);
  }
})();

// routes
app.get('/', (req, res) => res.render('open'));
app.use('/auth', authRouter);
app.use('/stocks', stocksRouter);
app.use('/orders', ordersRouter);

// 404
app.use((req, res) => res.status(404).send('404 Not Found'));

app.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
