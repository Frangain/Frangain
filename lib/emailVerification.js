const crypto = require('crypto');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function isEmailVerificationRequired() {
  return String(process.env.EMAIL_VERIFICATION_REQUIRED).toLowerCase() !== 'false';
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getVerificationExpiry(now = new Date()) {
  return new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
}

module.exports = {
  VERIFICATION_TOKEN_TTL_MS,
  createVerificationToken,
  getVerificationExpiry,
  hashVerificationToken,
  isEmailVerificationRequired,
};
