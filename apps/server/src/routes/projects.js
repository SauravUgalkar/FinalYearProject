const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

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

const canEditProject = (project, userId) => {
  if (!project) return false;
  const isOwner = project.owner.toString() === userId;
  const isCollaboratorEditor = (project.collaborators || []).some(
    (c) => c.userId?.toString() === userId && (c.role === 'editor' || c.role === 'admin')
  );
  return isOwner || isCollaboratorEditor;
};

const getLanguageFromName = (fileName) => {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  const extensions = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown'
  };
  return extensions[ext] || 'plaintext';
};

const sanitizeFiles = (files, defaultLanguage) => {
  if (!Array.isArray(files)) return [];

  return files
    .map((f) => {
      const rawName = String(f?.name || '');
      const name = rawName.trim();
      if (!name) return null;
      // Strip .gitkeep placeholder files (folder markers)
      if (name === '.gitkeep' || name.endsWith('/.gitkeep')) return null;
      const inferredLanguage = getLanguageFromName(name);
      return {
        _id: f?._id,
        name,
        content: typeof f?.content === 'string' ? f.content : '',
        language: inferredLanguage !== 'plaintext' ? inferredLanguage : (f?.language || defaultLanguage || 'javascript'),
        lastModified: f?.lastModified || f?.lastModifiedAt || new Date(),
        lastModifiedBy: f?.lastModifiedBy || 'system'
      };
    })
    .filter(Boolean);
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, language, isPublic } = req.body;
    const project = new Project({
      name,
      description,
      language,
      isPublic,
      owner: req.userId,
      createdBy: req.userId,
      isInviteOnly: true, // Default to secure mode
      invitedUsers: [],
      activeUsers: [],
      files: []
    });

    // Align roomId with the document id to keep the unique index happy
    project.roomId = project._id.toString();

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.userId },
        { 'collaborators.userId': req.userId }
      ]
    })
    .populate('owner', 'name email')
    .sort({ updatedAt: -1 });
    
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific project
router.get('/:projectId', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('owner', 'name email');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Security check: Only allow access if:
    // 1. User is the owner, OR
    // 2. User is a collaborator, OR
    // 3. Project is public, OR
    // 4. User was invited (in invitedUsers array)
    const isOwner = project.owner._id.toString() === req.userId;
    const isCollaborator = project.collaborators.some(
      c => c.userId && c.userId.toString() === req.userId
    );
    const isInvited = project.invitedUsers && project.invitedUsers.some(
      id => id.toString() === req.userId
    );

    if (!isOwner && !isCollaborator && !project.isPublic && !isInvited) {
      return res.status(403).json({ 
        error: 'Access denied. You must be invited to view this room.' 
      });
    }

    const projectResponse = project.toObject();
    projectResponse.files = sanitizeFiles(project.files, project.language);

    res.json(projectResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:projectId', verifyToken, async (req, res) => {
  try {
    const { name, description, files } = req.body;
    
    // Verify authorization before allowing update
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!canEditProject(project, req.userId)) {
      return res.status(403).json({ error: 'Only project owner or editor collaborators can update project details' });
    }

    const updateDoc = { updatedAt: new Date() };
    if (typeof name === 'string') updateDoc.name = name;
    if (typeof description === 'string') updateDoc.description = description;
    const sanitizedFiles = Array.isArray(files)
      ? sanitizeFiles(files, project.language)
      : null;
    if (sanitizedFiles) updateDoc.files = sanitizedFiles;

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.projectId,
      updateDoc,
      { new: true }
    );

    if (sanitizedFiles) {
      const roomManager = req.app.get('roomManager');
      roomManager?.syncPersistentFiles(req.params.projectId, sanitizedFiles, project.language);
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/files', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!canEditProject(project, req.userId)) {
      return res.status(403).json({ error: 'Only project owner or editor collaborators can delete files' });
    }

    const rawTargetPath = String(req.query.path || req.body?.path || '').trim();
    if (!rawTargetPath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const targetPath = rawTargetPath.replace(/\/+$/, '');
    const nextFiles = (project.files || []).filter((f) => String(f.name || '').trim() !== targetPath);

    project.files = nextFiles;
    project.updatedAt = new Date();
    await project.save();

    return res.json({ success: true, deletedPath: targetPath, deletedType: 'file', files: project.files });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/folders', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!canEditProject(project, req.userId)) {
      return res.status(403).json({ error: 'Only project owner or editor collaborators can delete folders' });
    }

    const rawTargetPath = String(req.query.path || req.body?.path || '').trim();
    if (!rawTargetPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const folderPath = rawTargetPath.replace(/\/+$/, '');
    const folderPrefix = `${folderPath}/`;
    const nextFiles = (project.files || []).filter((f) => {
      const name = String(f.name || '').trim();
      return name !== folderPath && name !== folderPrefix && !name.startsWith(folderPrefix);
    });

    project.files = nextFiles;
    project.updatedAt = new Date();
    await project.save();

    return res.json({ success: true, deletedPath: folderPath, deletedType: 'folder', files: project.files });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can delete project
    if (project.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only project owner can delete project' });
    }

    const deletedProject = await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Project deleted', project: deletedProject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share project with a user
router.post('/:projectId/share', verifyToken, async (req, res) => {
  try {
    const { email, role } = req.body;
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.owner.toString() !== req.userId) {
      const isAdmin = project.collaborators.find(c => c.userId.toString() === req.userId && c.role === 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: 'You do not have permission to share this project' });
      }
    }

    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingCollaborator = project.collaborators.find(c => c.email === email);
    if (existingCollaborator) {
      existingCollaborator.role = role;
    } else {
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

module.exports = router;
