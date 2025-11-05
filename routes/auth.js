const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'verysecretkey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// render signup
router.get('/signup', (req, res) => res.render('auth/signup'));

// signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.render('auth/signup', { error: 'Email and password required' });

    const existing = await User.findOne({ email }).lean();
    if (existing) return res.render('auth/signup', { error: 'Email already registered' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email, passwordHash: hash });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    // send token via cookie or show in UI — here redirect to login and show a message
    res.redirect('/auth/login?registered=1');
  } catch (err) {
    console.error(err);
    res.render('auth/signup', { error: 'Signup failed' });
  }
});

// render login
router.get('/login', (req, res) => {
  const registered = req.query.registered;
  res.render('auth/login', { registered });
});

// login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.render('auth/login', { error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.render('auth/login', { error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // In demo we pass token via query param to pages; in production use httpOnly cookie
    res.redirect(`/stocks?token=${token}`);
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'Login failed' });
  }
});

module.exports = router;
