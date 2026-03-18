const Project = require('../models/Project');

const matchesUserId = (candidate, userId) => String(candidate || '') === String(userId || '');

const isProjectMember = (project, userId) => {
  if (!project || !userId) return false;

  if (matchesUserId(project.owner, userId)) {
    return true;
  }

  if ((project.collaborators || []).some((collaborator) => matchesUserId(collaborator?.userId, userId))) {
    return true;
  }

  if ((project.invitedUsers || []).some((invitedUserId) => matchesUserId(invitedUserId, userId))) {
    return true;
  }

  return false;
};

const loadProjectMemberContext = async (projectId, userId) => {
  const project = await Project.findById(projectId);

  if (!project) {
    return {
      project: null,
      isMember: false,
      error: 'Project not found',
      status: 404,
    };
  }

  const isMember = isProjectMember(project, userId);

  if (!isMember) {
    return {
      project,
      isMember: false,
      error: 'Access denied. Project membership required.',
      status: 403,
    };
  }

  return {
    project,
    isMember: true,
    error: null,
    status: 200,
  };
};

const checkProjectMember = (projectIdParam = 'projectId') => async (req, res, next) => {
  try {
    const projectId = req.params?.[projectIdParam] || req.body?.[projectIdParam];
    const userId = req.userId || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const membership = await loadProjectMemberContext(projectId, userId);

    if (!membership.isMember) {
      return res.status(membership.status).json({ error: membership.error });
    }

    req.project = membership.project;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to validate project membership' });
  }
};

module.exports = {
  checkProjectMember,
  isProjectMember,
  loadProjectMemberContext,
};