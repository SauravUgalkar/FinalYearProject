const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');

const buildCallbackUrl = () => {
  return process.env.GITHUB_REDIRECT_URI || 'http://localhost:5000/api/github/oauth/callback';
};

const parseOAuthState = (state) => {
  if (!state) return null;
  try {
    return jwt.verify(state, process.env.JWT_SECRET || 'your_secret_key');
  } catch {
    return null;
  }
};

const configurePassport = () => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return passport;
  }

  passport.use('github', new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: buildCallbackUrl(),
      passReqToCallback: true,
    },
    async (req, accessToken, _refreshToken, profile, done) => {
      try {
        const statePayload = parseOAuthState(req.query?.state);
        if (!statePayload?.userId || statePayload?.purpose !== 'github-link') {
          return done(null, false, { message: 'Invalid OAuth state' });
        }

        return done(null, {
          appUserId: statePayload.userId,
          accessToken,
          githubProfile: profile,
          returnTo: statePayload.returnTo,
        });
      } catch (error) {
        return done(error);
      }
    }
  ));

  return passport;
};

module.exports = {
  configurePassport,
};
