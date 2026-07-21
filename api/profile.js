const bcrypt = require('bcrypt');
const connectToDatabase = require('../lib/mongodb');
const { sendVerificationEmail } = require('../lib/email');
const {
  createVerificationToken,
  getVerificationExpiry,
  hashVerificationToken,
  isEmailVerificationRequired,
} = require('../lib/emailVerification');
const { requireAuth } = require('../middleware/auth');
const {
  findUserByEmail,
  findUserById,
  sanitizeUser,
  updateUserEmail,
  updateUserPassword,
  updateUserProfile,
  normalizeProfileInput,
  validateProfileInput,
} = require('../models/User');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function normalizeAccountInput(body = {}) {
  return {
    action: typeof body.action === 'string' ? body.action.trim() : '',
    currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : '',
    newPassword: typeof body.newPassword === 'string' ? body.newPassword : '',
    confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
    newEmail: typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '',
  };
}

async function loadAuthenticatedUser(db, id) {
  const user = await findUserById(db, id);

  if (!user) {
    return null;
  }

  return user;
}

async function verifyCurrentPassword(user, password) {
  if (!password) {
    return false;
  }

  return bcrypt.compare(password, user.password);
}

async function handleChangePassword(req, res, input) {
  const errors = {};

  if (!input.currentPassword) {
    errors.currentPassword = 'Current password is required.';
  }

  if (!input.newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (input.newPassword.length < 8) {
    errors.newPassword = 'New password must be at least 8 characters.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (input.newPassword !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (input.currentPassword && input.newPassword && input.currentPassword === input.newPassword) {
    errors.newPassword = 'Choose a new password that is different from your current password.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the highlighted password fields.',
      errors,
    });
  }

  const { db } = await connectToDatabase();
  const user = await loadAuthenticatedUser(db, req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account was not found.',
      errors: { account: 'Authenticated account was not found.' },
    });
  }

  const passwordMatches = await verifyCurrentPassword(user, input.currentPassword);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect.',
      errors: { currentPassword: 'Enter your current password.' },
    });
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  const updatedUser = await updateUserPassword(db, req.user.id, hashedPassword);

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully.',
    data: {
      user: sanitizeUser(updatedUser),
    },
  });
}

async function handleChangeEmail(req, res, input) {
  const errors = {};

  if (!input.currentPassword) {
    errors.currentPassword = 'Current password is required.';
  }

  if (!input.newEmail) {
    errors.newEmail = 'New email address is required.';
  } else if (!EMAIL_PATTERN.test(input.newEmail)) {
    errors.newEmail = 'Please enter a valid email address.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the highlighted email fields.',
      errors,
    });
  }

  const { db } = await connectToDatabase();
  const user = await loadAuthenticatedUser(db, req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account was not found.',
      errors: { account: 'Authenticated account was not found.' },
    });
  }

  const passwordMatches = await verifyCurrentPassword(user, input.currentPassword);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect.',
      errors: { currentPassword: 'Enter your current password.' },
    });
  }

  if (input.newEmail === user.email) {
    return res.status(400).json({
      success: false,
      message: 'This email address is already on your account.',
      errors: { newEmail: 'Enter a different email address.' },
    });
  }

  const existingUser = await findUserByEmail(db, input.newEmail);

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'This email address is already registered.',
      errors: { newEmail: 'Use a different email address.' },
    });
  }

  const verificationRequired = isEmailVerificationRequired();
  const verificationToken = verificationRequired ? createVerificationToken() : null;
  const updatedUser = await updateUserEmail(db, req.user.id, {
    email: input.newEmail,
    emailVerified: !verificationRequired,
    emailVerificationTokenHash: verificationToken ? hashVerificationToken(verificationToken) : null,
    emailVerificationExpiresAt: verificationToken ? getVerificationExpiry() : null,
  });

  if (verificationRequired) {
    await sendVerificationEmail({
      to: updatedUser.email,
      username: updatedUser.username,
      token: verificationToken,
      req,
    });
  }

  return res.status(200).json({
    success: true,
    message: verificationRequired
      ? 'Email changed successfully. Please verify your new email address.'
      : 'Email changed successfully.',
    data: {
      emailVerificationRequired: verificationRequired,
      user: sanitizeUser(updatedUser),
    },
  });
}

module.exports = requireAuth(async function profileHandler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Profile loaded.',
      data: {
        user: req.user,
      },
    });
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET to read profile data, PUT to update profile data, or POST for account actions.',
      errors: { method: 'Only GET, PUT, and POST requests are supported.' },
    });
  }

  const body = getRequestBody(req);

  if (body === null) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.',
      errors: { body: 'Request body must be valid JSON.' },
    });
  }

  if (req.method === 'POST') {
    try {
      const input = normalizeAccountInput(body);

      if (input.action === 'change-password') {
        return handleChangePassword(req, res, input);
      }

      if (input.action === 'change-email') {
        return handleChangeEmail(req, res, input);
      }

      return res.status(400).json({
        success: false,
        message: 'Unsupported account action.',
        errors: { action: 'Supported actions are change-password and change-email.' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to update account settings. Please try again later.',
        errors: { server: error.message },
      });
    }
  }

  const input = normalizeProfileInput(body);
  const validationErrors = validateProfileInput(input);

  if (Object.keys(validationErrors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the highlighted profile fields.',
      errors: validationErrors,
    });
  }

  try {
    const { db } = await connectToDatabase();
    const updatedUser = await updateUserProfile(db, req.user.id, input);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Profile was not found.',
        errors: { profile: 'Authenticated user profile was not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to update profile. Please try again later.',
      errors: { server: error.message },
    });
  }
});
