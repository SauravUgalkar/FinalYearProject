const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Project = require('../models/Project');
const { loadProjectMemberContext } = require('../middleware/checkProjectMember');

const router = express.Router();

const MAX_OUTPUT_PREVIEW_CHARS = Number(process.env.MAX_ANALYTICS_OUTPUT_CHARS || 12000);

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

const trimForPreview = (value) => {
  const text = String(value || '');
  if (text.length <= MAX_OUTPUT_PREVIEW_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_OUTPUT_PREVIEW_CHARS)}\n[truncated]`;
};

const toExecutionDto = (submission, options = {}) => {
  const includeCode = Boolean(options.includeCode);
  const includeFullOutput = Boolean(options.includeFullOutput);
  const includeFiles = Boolean(options.includeFiles);

  const output = submission.output || submission.executionOutput || '';
  const error = submission.error || submission.executionError || '';
  const resolvedUsername = submission.username
    || submission.userId?.name
    || submission.userId?.username
    || submission.userName
    || 'Unknown';
  const resolvedLogs = String(submission.logs || '').trim() || [output && `stdout:\n${output}`, error && `stderr:\n${error}`].filter(Boolean).join('\n\n');

  return {
    id: submission._id,
    executionId: submission.executionId || String(submission._id),
    projectId: submission.projectId,
    userId: submission.userId,
    username: resolvedUsername,
    language: submission.language || 'javascript',
    status: submission.status || 'error',
    executionTime: Number(submission.executionTime || 0),
    output: includeFullOutput ? output : trimForPreview(output),
    error: includeFullOutput ? error : trimForPreview(error),
    logs: includeFullOutput ? resolvedLogs : trimForPreview(resolvedLogs),
    createdAt: submission.createdAt,
    ...(includeCode ? { code: submission.code || '' } : {}),
    ...(includeFiles
      ? {
          files: Array.isArray(submission.files)
            ? submission.files
                .map((file) => ({
                  filename: String(file?.filename || ''),
                  content: String(file?.content || ''),
                }))
                .filter((file) => file.filename)
            : [],
        }
      : {}),
  };
};

const hydrateSubmissionUsernames = async (submissions) => {
  const userIds = Array.from(
    new Set(
      submissions
        .map((submission) => String(submission.userId?._id || submission.userId || ''))
        .filter(Boolean)
    )
  );

  if (userIds.length === 0) {
    return submissions;
  }

  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return submissions.map((submission) => {
    const userId = String(submission.userId?._id || submission.userId || '');
    const user = userMap.get(userId);
    return {
      ...submission,
      userId: submission.userId && typeof submission.userId === 'object'
        ? submission.userId
        : (user ? { _id: user._id, name: user.name, email: user.email } : submission.userId),
      username: submission.username || user?.name || 'Unknown',
    };
  });
};

const canManageExecutionHistory = (project, userId) => {
  if (!project || !userId) return false;
  const normalizedUserId = String(userId);

  if (String(project.owner || '') === normalizedUserId) {
    return true;
  }

  return (project.collaborators || []).some(
    (collaborator) =>
      String(collaborator?.userId || '') === normalizedUserId
      && String(collaborator?.role || '').toLowerCase() === 'admin'
  );
};

const buildExecutionLookupFilters = (id) => {
  const filters = [{ executionId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    filters.push({ _id: id });
  }
  return filters;
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      projectId,
      userId,
      language,
      status,
      search,
      limit = 100,
      page = 1,
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId query param is required' });
    }

    const membership = await loadProjectMemberContext(projectId, req.userId);
    if (!membership.isMember) {
      return res.status(membership.status).json({ error: membership.error });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const query = { projectId };

    if (userId) {
      query.userId = userId;
    }

    if (language) {
      query.language = String(language).trim().toLowerCase();
    }

    if (status) {
      query.status = String(status).trim().toLowerCase();
    }

    if (search) {
      const safeRegex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ username: safeRegex }, { executionId: safeRegex }];
    }

    const [items, total] = await Promise.all([
      Submission.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .select('projectId userId username executionId language status executionTime output error logs createdAt')
        .lean(),
      Submission.countDocuments(query),
    ]);

    const hydratedItems = await hydrateSubmissionUsernames(items);

    res.json({
      items: hydratedItems.map((item) => toExecutionDto(item, { includeFullOutput: false })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.max(Math.ceil(total / safeLimit), 1),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const includeCode = String(req.query.includeCode || '').toLowerCase() === 'true';

    const lookupFilters = [{ executionId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      lookupFilters.push({ _id: id });
    }

    const submission = await Submission.findOne({
      $or: lookupFilters,
    })
      .select('projectId userId username executionId language status executionTime output error logs createdAt code executionOutput executionError files')
      .lean();

    if (!submission) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const [hydratedSubmission] = await hydrateSubmissionUsernames([submission]);

    const membership = await loadProjectMemberContext(hydratedSubmission.projectId, req.userId);
    if (!membership.isMember) {
      return res.status(membership.status).json({ error: membership.error });
    }

    res.json({
      execution: toExecutionDto(hydratedSubmission, {
        includeCode,
        includeFiles: true,
        includeFullOutput: true,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await Submission.findOne({
      $or: buildExecutionLookupFilters(id),
    })
      .select('_id projectId userId executionId')
      .lean();

    if (!submission) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const membership = await loadProjectMemberContext(submission.projectId, req.userId);
    if (!membership.isMember) {
      return res.status(membership.status).json({ error: membership.error });
    }

    const isOwnerOrAdmin = canManageExecutionHistory(membership.project, req.userId);
    const isExecutionOwner = String(submission.userId || '') === String(req.userId || '');
    if (!isOwnerOrAdmin && !isExecutionOwner) {
      return res.status(403).json({ error: 'You can only delete your own execution history.' });
    }

    await Submission.deleteOne({ _id: submission._id });
    await Project.findByIdAndUpdate(submission.projectId, {
      $pull: { submissions: submission._id },
    });

    return res.json({
      success: true,
      deletedId: submission._id,
      executionId: submission.executionId || String(submission._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/', verifyToken, async (req, res) => {
  try {
    const projectId = req.query.projectId || req.body?.projectId;
    const targetUserId = req.query.userId || req.body?.userId;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required to clear execution history.' });
    }

    const membership = await loadProjectMemberContext(projectId, req.userId);
    if (!membership.isMember) {
      return res.status(membership.status).json({ error: membership.error });
    }

    const isOwnerOrAdmin = canManageExecutionHistory(membership.project, req.userId);
    let deleteQuery = { projectId };
    let scope = 'project';

    if (targetUserId) {
      if (!isOwnerOrAdmin && String(targetUserId) !== String(req.userId)) {
        return res.status(403).json({ error: 'You cannot clear execution history for other users.' });
      }
      deleteQuery = { ...deleteQuery, userId: targetUserId };
      scope = String(targetUserId) === String(req.userId) ? 'self' : 'user';
    } else if (!isOwnerOrAdmin) {
      deleteQuery = { ...deleteQuery, userId: req.userId };
      scope = 'self';
    }

    const records = await Submission.find(deleteQuery).select('_id').lean();
    if (!records.length) {
      return res.json({ success: true, deletedCount: 0, scope });
    }

    const submissionIds = records.map((record) => record._id);
    const deletionResult = await Submission.deleteMany({ _id: { $in: submissionIds } });
    await Project.findByIdAndUpdate(projectId, {
      $pull: { submissions: { $in: submissionIds } },
    });

    return res.json({
      success: true,
      deletedCount: Number(deletionResult.deletedCount || 0),
      scope,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
