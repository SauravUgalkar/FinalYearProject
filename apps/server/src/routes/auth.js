const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { Resend } = require('resend');

// Fail fast if the JWT secret is not set
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Resend client — only initialised when an API key is configured
const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

/** Generate a cryptographically secure 6-digit OTP */
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Send an OTP email via Resend.  Returns true on success, throws on failure. */
async function sendOtpEmail(to, otp) {
  if (!resendClient) {
    throw new Error('Email service is not configured (RESEND_API_KEY missing)');
  }
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  await resendClient.emails.send({
    from,
    to,
    subject: 'Your CollabCode verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0ea5e9">Verify your email</h2>
        <p>Use the code below to complete your CollabCode sign-up.
           It expires in 10&nbsp;minutes.</p>
        <div style="font-size:2.5rem;font-weight:700;letter-spacing:0.3em;
                    text-align:center;padding:24px;background:#f0f9ff;
                    border-radius:12px;color:#0369a1">${otp}</div>
        <p style="color:#64748b;font-size:0.85rem">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>`,
    text: `Your CollabCode verification code is: ${otp}\n\nIt expires in 10 minutes.`,
  });
  return true;
}

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Step 1 – Register: validate, send OTP, return a short-lived otpToken (stateless)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, codingLanguages } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user already exists
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

    // Hash password upfront so plaintext never travels in the OTP token
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      console.error('Password hashing error:', hashErr);
      return res.status(500).json({ error: 'Failed to process password' });
    }

    // Generate OTP and embed it (along with registration data) in a short-lived JWT
    const otp = generateOtp();
    let otpToken;
    try {
      otpToken = jwt.sign(
        {
          purpose: 'email-verification',
          otp,
          name: name.trim(),
          email: trimmedEmail,
          hashedPassword,
          codingLanguages: Array.isArray(codingLanguages) ? codingLanguages : [],
        },
        process.env.JWT_SECRET,
        { expiresIn: OTP_EXPIRY_SECONDS }
      );
    } catch (tokenErr) {
      console.error('OTP token generation error:', tokenErr);
      return res.status(500).json({ error: 'Failed to generate verification token' });
    }

    // Send OTP email
    try {
      await sendOtpEmail(trimmedEmail, otp);
    } catch (emailErr) {
      console.error('OTP email send error:', emailErr);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    console.log('OTP sent for new user registration');
    res.status(200).json({
      message: 'Verification code sent to your email.',
      otpToken,
    });
  } catch (err) {
    console.error('Register endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Step 2 – Verify OTP: confirm code, create account, return auth token
router.post('/verify-otp', async (req, res) => {
  try {
    const { otpToken, otp } = req.body;

    if (!otpToken || !otp) {
      return res.status(400).json({ error: 'otpToken and otp are required' });
    }

    // Decode and verify the short-lived JWT
    let payload;
    try {
      payload = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Verification code has expired. Please register again.' });
      }
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    if (payload.purpose !== 'email-verification') {
      return res.status(400).json({ error: 'Invalid token purpose.' });
    }

    if (otp.trim() !== payload.otp) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    // Double-check the email is still available (race-condition guard)
    let existingUser;
    try {
      existingUser = await User.findOne({ email: payload.email });
    } catch (dbErr) {
      console.error('Database error checking user:', dbErr);
      return res.status(503).json({ error: 'Database connection error. Please try again.' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Create the user
    const user = new User({
      name: payload.name,
      email: payload.email,
      password: payload.hashedPassword,
      codingLanguages: payload.codingLanguages || [],
    });

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

    // Generate long-lived auth token
    let token;
    try {
      token = jwt.sign(
        { userId: savedUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    } catch (tokenErr) {
      console.error('Token generation error:', tokenErr);
      return res.status(500).json({ error: 'Failed to generate auth token' });
    }

    console.log('User registered successfully');
    res.status(201).json({
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        codingLanguages: savedUser.codingLanguages || [],
      },
      token,
    });
  } catch (err) {
    console.error('Verify OTP endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during OTP verification' });
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
        process.env.JWT_SECRET,
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

// Logout current user and clear app-side OAuth link data
router.post('/logout', verifyToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $unset: {
        githubAccessToken: 1,
        githubTokenCiphertext: 1,
        githubTokenIv: 1,
        githubTokenTag: 1,
        githubTokenUpdatedAt: 1,
        githubId: 1,
        githubUsername: 1,
      },
      $set: { updatedAt: new Date() },
    });

    if (typeof req.logout === 'function') {
      req.logout(() => {});
    }

    if (req.session) {
      req.session.destroy(() => {});
    }

    const secure = process.env.NODE_ENV === 'production';
    res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'strict', secure, path: '/' });
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure, path: '/' });

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
