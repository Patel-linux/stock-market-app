// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config(); // Load .env for local testing

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------- Session --------------------
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// -------------------- MongoDB --------------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

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

        // Hash password
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

// Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).send("All fields are required");

        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        // Compare password
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(400).send("Invalid credentials");

        // Store user session
        req.session.userId = user._id;

        res.send("Login successful");
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// Test Route
app.get('/', (req, res) => {
    res.send("Server running!");
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
