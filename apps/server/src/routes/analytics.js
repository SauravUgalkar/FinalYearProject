const express = require('express');
const router = express.Router();
const axios = require('axios');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

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

// Get analytics for user
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const submissions = await Submission.find({ userId: req.params.userId }).limit(50);

    const analytics = {
      totalSubmissions: submissions.length,
      successfulSubmissions: submissions.filter(s => s.status === 'success').length,
      failedSubmissions: submissions.filter(s => s.status === 'error').length,
      averageExecutionTime: submissions.reduce((sum, s) => sum + (s.executionTime || 0), 0) / submissions.length,
      commonWeaknesses: user.weaknesses,
      recentSubmissions: submissions.slice(-10)
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze code with Gemini API
router.post('/analyze', verifyToken, async (req, res) => {
  try {
    const { code, language, submissionId } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini API not configured' });
    }

    // Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Analyze this ${language} code and identify weaknesses, improvements, and provide a score (0-100):\n\n${code}\n\nRespond in JSON format with: weaknesses[], improvements[], score, feedback`
          }]
        }]
      }
    );

    const analysisText = response.data.candidates[0].content.parts[0].text;
    const analysis = JSON.parse(analysisText);

    // Update submission with analysis
    if (submissionId) {
      await Submission.findByIdAndUpdate(
        submissionId,
        { aiAnalysis: analysis },
        { new: true }
      );
    }

    // Update user weaknesses
    const user = await User.findById(req.userId);
    if (user && analysis.weaknesses) {
      analysis.weaknesses.forEach(weakness => {
        const existing = user.weaknesses.find(w => w.category === weakness);
        if (existing) {
          existing.frequency++;
          existing.lastIdentified = new Date();
        } else {
          user.weaknesses.push({
            category: weakness,
            frequency: 1,
            lastIdentified: new Date()
          });
        }
      });
      await user.save();
    }

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get weakness summary
router.get('/weaknesses/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sortedWeaknesses = user.weaknesses.sort((a, b) => b.frequency - a.frequency);
    res.json(sortedWeaknesses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project analytics (all users)
router.get('/project/:projectId', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is the owner
    if (project.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only project owner can view analytics' });
    }

    res.json({ analytics: project.analytics || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project analytics for a user
router.post('/project/:projectId/update', verifyToken, async (req, res) => {
  try {
    const { totalRuns, successfulRuns, failedRuns, totalErrors, executionTimes } = req.body;
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create analytics entry for this user
    let userAnalytics = project.analytics.find(a => a.userId && a.userId.toString() === req.userId);
    
    if (userAnalytics) {
      // Update existing analytics
      userAnalytics.totalRuns = totalRuns;
      userAnalytics.successfulRuns = successfulRuns;
      userAnalytics.failedRuns = failedRuns;
      userAnalytics.totalErrors = totalErrors;
      userAnalytics.executionTimes = executionTimes;
      userAnalytics.lastActivity = new Date();
    } else {
      // Create new analytics entry
      project.analytics.push({
        userId: req.userId,
        userName: user.name,
        totalRuns,
        successfulRuns,
        failedRuns,
        totalErrors,
        executionTimes,
        lastActivity: new Date()
      });
    }

    await project.save();
    res.json({ success: true, analytics: project.analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
