const express = require('express');
const router = express.Router();
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

// Create project
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, language, isPublic } = req.body;

    const project = new Project({
      name,
      description,
      language,
      isPublic,
      owner: req.userId,
      files: [
        {
          name: 'main.' + getFileExtension(language),
          content: getBoilerplate(language),
          language
        }
      ]
    });

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all projects for user
router.get('/', verifyToken, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.userId },
        { 'collaborators.userId': req.userId }
      ]
    }).sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific project
router.get('/:projectId', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:projectId', verifyToken, async (req, res) => {
  try {
    const { name, description, files } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { name, description, files, updatedAt: new Date() },
      { new: true }
    );

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:projectId', verifyToken, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Project deleted', project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share project with a user
router.post('/:projectId/share', verifyToken, async (req, res) => {
  try {
    const { email, role } = req.body;
    const { projectId } = req.params;

    // Find project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is owner or admin
    if (project.owner.toString() !== req.userId) {
      const isAdmin = project.collaborators.find(
        c => c.userId.toString() === req.userId && c.role === 'admin'
      );
      if (!isAdmin) {
        return res.status(403).json({ error: 'You do not have permission to share this project' });
      }
    }

    // Validate role
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be viewer, editor, or admin' });
    }

    // Check if already shared
    const existingCollaborator = project.collaborators.find(c => c.email === email);
    if (existingCollaborator) {
      existingCollaborator.role = role;
    } else {
      // Find user by email to get userId
      const User = require('../models/User');
      const user = await User.findOne({ email });
      
      if (!user) {
        // Still allow sharing via email (user can join with link later)
        project.collaborators.push({
          email,
          name: email.split('@')[0],
          role,
          joinedAt: new Date()
        });
      } else {
        project.collaborators.push({
          userId: user._id,
          email: user.email,
          name: user.name,
          role,
          joinedAt: new Date()
        });
      }
    }

    await project.save();

    res.json({
      message: 'Project shared successfully',
      collaborators: project.collaborators
    });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove collaborator
router.delete('/:projectId/collaborators/:collaboratorId', verifyToken, async (req, res) => {
  try {
    const { projectId, collaboratorId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is owner
    if (project.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only project owner can remove collaborators' });
    }

    project.collaborators = project.collaborators.filter(
      c => c._id.toString() !== collaboratorId
    );

    await project.save();

    res.json({
      message: 'Collaborator removed',
      collaborators: project.collaborators
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project collaborators
router.get('/:projectId/collaborators', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    res.json({
      owner: project.owner,
      collaborators: project.collaborators
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function getFileExtension(language) {
  const extensions = {
    javascript: 'js',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    csharp: 'cs'
  };
  return extensions[language] || 'txt';
}

function getBoilerplate(language) {
  const boilerplates = {
    javascript: `// Welcome to CollabCode!\n// Write your JavaScript code here\n\nconsole.log("Hello, World!");`,
    python: `# Welcome to CollabCode!\n# Write your Python code here\n\nprint("Hello, World!")`,
    java: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}`,
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}`,
    csharp: `using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}`
  };
  return boilerplates[language] || '';
}

module.exports = router;
