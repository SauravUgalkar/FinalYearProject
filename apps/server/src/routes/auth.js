const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    console.log('Register request body:', req.body);
    const { name, email, password, codingLanguages } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user exists
    let existingUser;
    try {
      existingUser = await User.findOne({ email: trimmedEmail });
    } catch (dbErr) {
      console.error('Database error checking user:', dbErr);
      return res.status(503).json({ error: 'Database connection error. Please try again.' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      console.error('Password hashing error:', hashErr);
      return res.status(500).json({ error: 'Failed to process password' });
    }

    // Create user
    const user = new User({
      name: name.trim(),
      email: trimmedEmail,
      password: hashedPassword,
      codingLanguages: Array.isArray(codingLanguages) ? codingLanguages : []
    });

    // Save user to database
    let savedUser;
    try {
      savedUser = await user.save();
    } catch (saveErr) {
      console.error('User save error:', saveErr);
      if (saveErr.code === 11000) {
        return res.status(409).json({ error: 'User already exists' });
      }
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate token
    let token;
    try {
      token = jwt.sign(
        { userId: savedUser._id },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: '7d' }
      );
    } catch (tokenErr) {
      console.error('Token generation error:', tokenErr);
      return res.status(500).json({ error: 'Failed to generate auth token' });
    }

    console.log(`User registered successfully: ${trimmedEmail}`);
    res.status(201).json({
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        codingLanguages: savedUser.codingLanguages || []
      },
      token
    });
  } catch (err) {
    console.error('Register endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Find user
    let user;
    try {
      user = await User.findOne({ email: trimmedEmail });
    } catch (dbErr) {
      console.error('Database error during login:', dbErr);
      return res.status(503).json({ error: 'Database connection error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    let isPasswordValid;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (bcryptErr) {
      console.error('Password comparison error:', bcryptErr);
      return res.status(500).json({ error: 'Failed to validate password' });
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    let token;
    try {
      token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: '7d' }
      );
    } catch (tokenErr) {
      console.error('Token generation error:', tokenErr);
      return res.status(500).json({ error: 'Failed to generate auth token' });
    }

    console.log(`User logged in: ${trimmedEmail}`);
    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (err) {
    console.error('Login endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, codingLanguages } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, codingLanguages, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
