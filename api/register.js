const bcrypt = require('bcrypt');
const connectToDatabase = require('../lib/mongodb');
const {
  createUser,
  ensureUserIndexes,
  findUserByUsernameOrEmail,
  normalizeUserInput,
  validateRegistrationInput,
} = require('../models/User');

const SALT_ROUNDS = 12;

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

module.exports = async function registerHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to create an account.',
    });
  }

  try {
    const body = getRequestBody(req);

    if (body === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON request body.',
      });
    }

    const input = normalizeUserInput(body);
    const validationErrors = validateRegistrationInput(input);

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please correct the highlighted fields.',
        errors: validationErrors,
      });
    }

    const { db } = await connectToDatabase();
    await ensureUserIndexes(db);

    const existingUser = await findUserByUsernameOrEmail(db, input.username, input.email);

    if (existingUser) {
      const errors = {};

      if (existingUser.username === input.username) {
        errors.username = 'This username is already taken.';
      }

      if (existingUser.email === input.email) {
        errors.email = 'This email address is already registered.';
      }

      return res.status(409).json({
        success: false,
        message: 'An account with this username or email already exists.',
        errors,
      });
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await createUser(db, {
      username: input.username,
      email: input.email,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: 'Welcome to the FRANGAIN Ecosystem. Your account has been created successfully. Please verify your email to activate your account.',
      user,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this username or email already exists.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again later.',
      error: error.message,
    });
  }
};
