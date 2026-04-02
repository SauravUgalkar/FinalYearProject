require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../src/models/User');
const { saveGithubTokenForUser } = require('../src/services/githubTokenService');

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri);

  const candidates = await User.find({
    githubAccessToken: { $exists: true, $ne: '' },
    $or: [
      { githubTokenCiphertext: { $exists: false } },
      { githubTokenCiphertext: '' },
    ],
  }).select('_id githubAccessToken githubId githubUsername');

  let migrated = 0;
  let failed = 0;

  for (const user of candidates) {
    try {
      await saveGithubTokenForUser({
        userId: user._id,
        accessToken: user.githubAccessToken,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
      });
      migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(`[MIGRATE_GITHUB_TOKEN] Failed for user ${user._id}: ${error.message}`);
    }
  }

  console.log(`[MIGRATE_GITHUB_TOKEN] Candidates: ${candidates.length}`);
  console.log(`[MIGRATE_GITHUB_TOKEN] Migrated: ${migrated}`);
  console.log(`[MIGRATE_GITHUB_TOKEN] Failed: ${failed}`);

  await mongoose.disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
};

run().catch(async (error) => {
  console.error('[MIGRATE_GITHUB_TOKEN] Fatal error:', error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
