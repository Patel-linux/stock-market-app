const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'verysecretkey';

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.cookies && req.cookies.token || req.body.token || req.query.token;
  if (!authHeader) return res.redirect('/auth/login');

  // accept "Bearer <token>" or token directly
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // attach user to req (fetch from DB)
    const user = await User.findById(payload.id).lean();
    if (!user) return res.redirect('/auth/login');
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error', err.message);
    return res.redirect('/auth/login');
  }
}

module.exports = { requireAuth };
