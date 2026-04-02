const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  const raw = process.env.GITHUB_TOKEN_ENC_KEY || '';
  if (!raw) {
    return null;
  }

  // Prefer base64 in production, fall back to utf8 for local setup convenience.
  let key = null;
  try {
    const fromB64 = Buffer.from(raw, 'base64');
    if (fromB64.length === 32) {
      key = fromB64;
    }
  } catch {
    key = null;
  }

  if (!key) {
    const fromUtf8 = Buffer.from(raw, 'utf8');
    if (fromUtf8.length === 32) {
      key = fromUtf8;
    }
  }

  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('GITHUB_TOKEN_ENC_KEY must be 32 bytes (base64 or utf8) in production.');
  }

  return key;
};

const encryptGithubToken = (plainToken) => {
  if (!plainToken) return null;

  const key = getEncryptionKey();
  if (!key) {
    // Local fallback so development is not blocked if key is not configured yet.
    return {
      ciphertext: plainToken,
      iv: null,
      tag: null,
      insecure: true,
    };
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainToken), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    insecure: false,
  };
};

const decryptGithubToken = (payload) => {
  if (!payload) return '';

  // Backward compatibility path for plain token records.
  if (payload.insecure || (!payload.iv && !payload.tag)) {
    return payload.ciphertext || '';
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Missing GITHUB_TOKEN_ENC_KEY. Cannot decrypt GitHub token.');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
};

module.exports = {
  encryptGithubToken,
  decryptGithubToken,
};
