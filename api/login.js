const bcrypt = require('bcrypt');
const connectToDatabase = require('../lib/mongodb');
const { createAuthToken, serializeAuthCookie } = require('../lib/auth');
const {
  findUserByEmail,
  normalizeLoginInput,
  sanitizeUser,
  validateLoginInput,
} = require('../models/User');

function getRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }

  return req.body;
}

module.exports = async function loginHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to sign in.',
      errors: { method: 'Only POST requests are supported.' },
    });
  }

  try {
    const body = getRequestBody(req);

    if (body === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON request body.',
        errors: { body: 'Request body must be valid JSON.' },
      });
    }

    const input = normalizeLoginInput(body);
    const validationErrors = validateLoginInput(input);

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please correct the highlighted fields.',
        errors: validationErrors,
      });
    }

    const { db } = await connectToDatabase();
    const user = await findUserByEmail(db, input.email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errors: { credentials: 'Invalid email or password.' },
      });
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errors: { credentials: 'Invalid email or password.' },
      });
    }

    const token = createAuthToken(user);
    res.setHeader('Set-Cookie', serializeAuthCookie(token));

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: sanitizeUser(user),
        redirectTo: '/ecosystem/dashboard.html',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again later.',
      errors: { server: error.message },
    });
  }
};
