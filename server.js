// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();

// -------------------- Middleware --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- View Engine --------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------- MongoDB --------------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

// -------------------- Session --------------------
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        secure: process.env.NODE_ENV === 'production'
    }
}));

// -------------------- User Schema --------------------
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// -------------------- Stock Schema --------------------
const stockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Stock = mongoose.model('Stock', stockSchema);

// -------------------- Routes --------------------

// Home Page - list stocks
app.get('/', async (req, res) => {
    try {
        const stocks = await Stock.find(); // fetch all stocks
        res.render('index', { stocks });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Registration
app.get('/register', (req, res) => res.render('register')); // register form
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).send("All fields are required");

        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Login
app.get('/login', (req, res) => res.render('login')); // login form
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).send("All fields are required");

        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(400).send("Invalid credentials");

        req.session.userId = user._id;

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
        );

        res.redirect('/profile');
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Profile - protected
app.get('/profile', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    try {
        const user = await User.findById(req.session.userId);
        const stocks = await Stock.find({ createdBy: req.session.userId });

        res.render('profile', { user, stocks });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Add stock (protected)
app.post('/stocks', async (req, res) => {
    if (!req.session.userId) return res.status(401).send("Unauthorized");

    try {
        const { name, price } = req.body;
        const newStock = new Stock({
            name,
            price,
            createdBy: req.session.userId
        });
        await newStock.save();
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Catch-all for 404
app.get('*', (req, res) => {
    res.status(404).render('404');
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
