const User = require('../models/User');
const { encryptGithubToken, decryptGithubToken } = require('../utils/githubTokenCrypto');

const getGithubTokenFromUser = (user) => {
  if (!user) return '';

  // New encrypted format
  if (user.githubTokenCiphertext) {
    return decryptGithubToken({
      ciphertext: user.githubTokenCiphertext,
      iv: user.githubTokenIv,
      tag: user.githubTokenTag,
      insecure: false,
    });
  }

  // Backward compatibility with previous plain storage.
  return user.githubAccessToken || '';
};

const saveGithubTokenForUser = async ({ userId, accessToken, githubId, githubUsername }) => {
  const encrypted = encryptGithubToken(accessToken);
  if (!encrypted?.ciphertext) {
    throw new Error('GitHub token encryption failed');
  }

  const update = {
    githubId: githubId || undefined,
    githubUsername: githubUsername || undefined,
    githubTokenCiphertext: encrypted.ciphertext,
    githubTokenIv: encrypted.iv,
    githubTokenTag: encrypted.tag,
    githubTokenUpdatedAt: new Date(),
    updatedAt: new Date(),
  };

  // Remove legacy plain token once migrated.
  update.githubAccessToken = undefined;

  await User.findByIdAndUpdate(userId, { $set: update, $unset: { githubAccessToken: 1 } });
};

module.exports = {
  getGithubTokenFromUser,
  saveGithubTokenForUser,
};
