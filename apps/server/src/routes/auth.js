const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLogoDataUri() {
  try {
    const logoPath = path.resolve(__dirname, '../../../client/public/logo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    return '';
  }
}

const logoDataUri = getLogoDataUri();

/** Generate a cryptographically secure 6-digit OTP */
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Send an OTP email via Resend.  Returns true on success, throws on failure. */
async function sendOtpEmail(to, otp, recipientName = '') {
  if (!resendClient) {
    throw new Error('Email service is not configured (RESEND_API_KEY missing)');
  }
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const rawName = recipientName.trim() || 'there';
  const safeName = escapeHtml(rawName);
  const firstName = rawName.split(/\s+/)[0] || 'there';
  await resendClient.emails.send({
    from,
    to,
    subject: `${firstName}, verify your CollabCode account`,
    html: `
      <div style="margin:0 auto;max-width:560px;padding:32px 20px;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 100%);font-family:Inter,Arial,sans-serif;color:#0f172a">
        <div style="border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;background:#ffffff;box-shadow:0 20px 60px rgba(15,23,42,0.08)">
          <div style="padding:28px 28px 20px;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#0b1220 55%,#082f49 100%)">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="CollabCode" width="72" height="72" style="display:block;margin:0 auto 16px;border-radius:18px;object-fit:contain;background:rgba(255,255,255,0.08);padding:10px" />` : ''}
            <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(34,211,238,0.14);color:#c3f0ff;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">
              Email verification
            </div>
            <h2 style="margin:18px 0 8px;font-size:28px;line-height:1.2;color:#ffffff">Welcome to CollabCode</h2>
            <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.7">Hi ${safeName}, use the code below to finish creating your account.</p>
          </div>

          <div style="padding:28px">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155">
              We generated a secure 6-digit verification code for your sign-up. It expires in 10 minutes.
            </p>

            <div style="margin:24px 0;padding:22px;border:1px solid #bae6fd;border-radius:20px;background:linear-gradient(180deg,#ecfeff 0%,#eff6ff 100%);text-align:center">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#0369a1;font-weight:700;margin-bottom:12px">Your verification code</div>
              <div style="font-size:40px;font-weight:800;letter-spacing:0.38em;color:#0f172a;font-family:'Courier New',monospace;line-height:1">${otp}</div>
            </div>

            <div style="padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:14px;line-height:1.7">
              If you did not request this email, you can safely ignore it. Your code will expire automatically and cannot be used again.
            </div>
          </div>
        </div>
      </div>`,
    text: `Hi ${recipientName || 'there'},\n\nYour CollabCode verification code is: ${otp}\nIt expires in 10 minutes.\n\nIf you did not request this email, you can ignore it.`,
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
      await sendOtpEmail(trimmedEmail, otp, name.trim());
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

    const otpInput = Buffer.from(otp.trim());
    const otpStored = Buffer.from(payload.otp);
    if (
      otpInput.length !== otpStored.length ||
      !crypto.timingSafeEqual(otpInput, otpStored)
    ) {
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

const MAX_AVATAR_CHARS = Number(process.env.MAX_PROFILE_AVATAR_CHARS || 2000000);

const sanitizeSkills = (skills) => {
  if (!Array.isArray(skills)) return undefined;
  return Array.from(
    new Set(
      skills
        .map((skill) => String(skill || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 100);
};

const sanitizeProjects = (projects) => {
  if (!Array.isArray(projects)) return undefined;

  return projects
    .map((project) => ({
      title: String(project?.title || '').trim(),
      description: String(project?.description || '').trim(),
      techStack: Array.isArray(project?.techStack)
        ? Array.from(
            new Set(
              project.techStack
                .map((tech) => String(tech || '').trim())
                .filter(Boolean)
            )
          ).slice(0, 20)
        : [],
    }))
    .filter((project) => project.title)
    .slice(0, 50);
};

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      bio,
      codingLanguages,
      avatar,
      avgExecutionTime,
      profileProjects,
    } = req.body || {};

    const updatePayload = { updatedAt: new Date() };

    if (typeof name === 'string' && name.trim()) {
      updatePayload.name = name.trim();
    }

    if (typeof role === 'string') {
      updatePayload.role = role.trim().slice(0, 120);
    }

    if (typeof bio === 'string') {
      updatePayload.bio = bio.trim().slice(0, 2000);
    }

    if (typeof avgExecutionTime === 'string') {
      updatePayload.avgExecutionTime = avgExecutionTime.trim().slice(0, 80);
    }

    const sanitizedSkills = sanitizeSkills(codingLanguages);
    if (sanitizedSkills) {
      updatePayload.codingLanguages = sanitizedSkills;
    }

    const sanitizedProjects = sanitizeProjects(profileProjects);
    if (sanitizedProjects) {
      updatePayload.profileProjects = sanitizedProjects;
    }

    if (typeof avatar === 'string') {
      const trimmedAvatar = avatar.trim();
      if (trimmedAvatar.length > MAX_AVATAR_CHARS) {
        return res.status(400).json({ error: 'Avatar image is too large.' });
      }
      updatePayload.avatar = trimmedAvatar;
    }

    if (typeof email === 'string' && email.trim()) {
      const nextEmail = email.toLowerCase().trim();
      const emailOwner = await User.findOne({ email: nextEmail }).select('_id');
      if (emailOwner && String(emailOwner._id) !== String(req.userId)) {
        return res.status(409).json({ error: 'Email is already in use.' });
      }
      updatePayload.email = nextEmail;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updatePayload,
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

// Step 1 – Forgot Password: validate email, send OTP, return resetToken
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user exists
    let user;
    try {
      user = await User.findOne({ email: trimmedEmail });
    } catch (dbErr) {
      console.error('Database error checking user:', dbErr);
      return res.status(503).json({ error: 'Database connection error. Please try again.' });
    }

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      // But still generate OTP to maintain consistent response time
      console.log(`Forgot password requested for non-existent email: ${trimmedEmail}`);
      return res.status(200).json({
        message: 'If an account exists with this email, a verification code has been sent.',
      });
    }

    // Generate OTP and embed it in a short-lived JWT
    const otp = generateOtp();
    let resetToken;
    try {
      resetToken = jwt.sign(
        {
          purpose: 'password-reset',
          otp,
          email: trimmedEmail,
          userId: user._id,
        },
        process.env.JWT_SECRET,
        { expiresIn: OTP_EXPIRY_SECONDS }
      );
    } catch (tokenErr) {
      console.error('Reset token generation error:', tokenErr);
      return res.status(500).json({ error: 'Failed to generate reset token' });
    }

    // Send OTP email
    try {
      await sendOtpEmail(trimmedEmail, otp, user.name);
    } catch (emailErr) {
      console.error('OTP email send error:', emailErr);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    console.log(`Password reset OTP sent for user: ${trimmedEmail}`);
    res.status(200).json({
      message: 'Verification code sent to your email.',
      resetToken,
    });
  } catch (err) {
    console.error('Forgot password endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during password reset request' });
  }
});

// Step 2 – Verify Forgot Password OTP: confirm code, update password, return auth token
router.post('/verify-forgot-password', async (req, res) => {
  try {
    const { resetToken, otp, newPassword } = req.body;

    if (!resetToken || !otp || !newPassword) {
      return res.status(400).json({ error: 'resetToken, otp, and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Decode and verify the reset token
    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    if (payload.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid token purpose.' });
    }

    // Compare OTPs using timing-safe comparison
    const otpInput = Buffer.from(otp.trim());
    const otpStored = Buffer.from(payload.otp);
    if (
      otpInput.length !== otpStored.length ||
      !crypto.timingSafeEqual(otpInput, otpStored)
    ) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    // Hash the new password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(newPassword, 10);
    } catch (hashErr) {
      console.error('Password hashing error:', hashErr);
      return res.status(500).json({ error: 'Failed to process password' });
    }

    // Update user password
    let user;
    try {
      user = await User.findByIdAndUpdate(
        payload.userId,
        { password: hashedPassword, updatedAt: new Date() },
        { new: true }
      );
    } catch (updateErr) {
      console.error('User update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate auth token
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

    console.log(`Password reset successfully for user: ${user.email}`);
    res.status(200).json({
      message: 'Password reset successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error('Verify forgot password endpoint error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error during password reset verification' });
  }
});

module.exports = router;
