const jwt = require('jsonwebtoken');

const AUTH_COOKIE_NAME = 'frangain_auth';
const TOKEN_EXPIRES_IN = '7d';
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in the environment.');
  }

  return secret;
}

function createAuthToken(user) {
  return jwt.sign(
    {
      userId: user._id ? user._id.toString() : user.id.toString(),
      email: user.email,
      username: user.username,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function serializeAuthCookie(token) {
  const cookieParts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      return cookies;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (name) {
      cookies[name] = decodeURIComponent(value);
    }

    return cookies;
  }, {});
}

function getAuthTokenFromRequest(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
}

function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  AUTH_COOKIE_NAME,
  TOKEN_MAX_AGE_SECONDS,
  createAuthToken,
  getAuthTokenFromRequest,
  serializeAuthCookie,
  verifyAuthToken,
};
