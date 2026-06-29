const { ObjectId } = require('mongodb');
const connectToDatabase = require('../lib/mongodb');
const { getAuthTokenFromRequest, verifyAuthToken } = require('../lib/auth');
const { findUserById, sanitizeUser } = require('../models/User');

async function authenticateRequest(req) {
  const token = getAuthTokenFromRequest(req);

  if (!token) {
    return {
      authenticated: false,
      status: 401,
      response: {
        success: false,
        message: 'Authentication is required.',
        errors: { auth: 'Missing authentication token.' },
      },
    };
  }

  let payload;

  try {
    payload = verifyAuthToken(token);
  } catch (error) {
    return {
      authenticated: false,
      status: 401,
      response: {
        success: false,
        message: 'Authentication is invalid or expired.',
        errors: { auth: 'Invalid authentication token.' },
      },
    };
  }

  if (!ObjectId.isValid(payload.userId)) {
    return {
      authenticated: false,
      status: 401,
      response: {
        success: false,
        message: 'Authentication is invalid.',
        errors: { auth: 'Invalid user token.' },
      },
    };
  }

  const { db } = await connectToDatabase();
  const user = await findUserById(db, payload.userId);

  if (!user) {
    return {
      authenticated: false,
      status: 401,
      response: {
        success: false,
        message: 'Authentication user was not found.',
        errors: { auth: 'User account does not exist.' },
      },
    };
  }

  req.user = sanitizeUser(user);

  return {
    authenticated: true,
    user: req.user,
  };
}

function requireAuth(handler) {
  return async function authenticatedHandler(req, res) {
    const auth = await authenticateRequest(req);

    if (!auth.authenticated) {
      return res.status(auth.status).json(auth.response);
    }

    return handler(req, res);
  };
}

module.exports = {
  authenticateRequest,
  requireAuth,
};
