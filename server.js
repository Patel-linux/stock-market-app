// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        secure: process.env.NODE_ENV === 'production' // HTTPS in production
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
        res.status(201).send("User registered successfully");
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Login (with session + JWT)
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

        // Create JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
        );

        res.json({ message: "Login successful", token });
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Protected route example
app.get('/profile', (req, res) => {
    if (!req.session.userId) return res.status(401).send("Unauthorized");
    res.send(`Welcome User ID: ${req.session.userId}`);
});

// Test Route
app.get('/', (req, res) => {
    res.send("Server running!");
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
