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

// Serve static files (CSS, JS, images) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- View Engine --------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // your ejs files folder

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

// -------------------- Routes --------------------

// Home Page
app.get('/', (req, res) => {
    res.render('index'); // renders views/index.ejs
});

// Registration
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
        res.redirect('/login'); // redirect to login page after registration
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Login (session + JWT)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).send("All fields are required");

        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(400).send("Invalid credentials");

        // Store session
        req.session.userId = user._id;

        // JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
        );

        // Optionally pass token to frontend
        res.redirect('/profile'); // redirect to profile page
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Profile page (protected)
app.get('/profile', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('profile', { userId: req.session.userId }); // renders views/profile.ejs
});

// Login page
app.get('/login', (req, res) => {
    res.render('login'); // renders views/login.ejs
});

// Catch-all route
app.get('*', (req, res) => {
    res.status(404).render('404'); // optional 404 page
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
