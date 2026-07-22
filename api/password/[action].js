const bcrypt = require('bcrypt');
const connectToDatabase = require('../../lib/mongodb');
const { sendPasswordResetEmail } = require('../../lib/email');
const {
  createVerificationToken,
  hashVerificationToken,
} = require('../../lib/emailVerification');
const {
  findUserByEmail,
  findUserByPasswordResetTokenHash,
  normalizeLoginInput,
  resetUserPassword,
  updatePasswordResetToken,
} = require('../../models/User');

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
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

function getPasswordAction(req) {
  if (req.query && typeof req.query.action === 'string') {
    return req.query.action;
  }

  const pathname = (req.url || '').split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function getPasswordResetExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
}

function genericForgotPasswordResponse(res) {
  return res.status(200).json({
    success: true,
    message: 'If a verified FRANGAIN account exists for this email address, a password reset link has been sent.',
    data: {},
  });
}

async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to request a password reset link.',
      errors: { method: 'Only POST requests are supported.' },
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

  const input = normalizeLoginInput(body);

  if (!input.email) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required.',
      errors: { email: 'Enter the email address for your FRANGAIN account.' },
    });
  }

  const { db } = await connectToDatabase();
  const user = await findUserByEmail(db, input.email);

  if (!user || user.emailVerified !== true) {
    return genericForgotPasswordResponse(res);
  }

  const resetToken = createVerificationToken();
  const updatedUser = await updatePasswordResetToken(
    db,
    user._id,
    hashVerificationToken(resetToken),
    getPasswordResetExpiry()
  );

  await sendPasswordResetEmail({
    to: updatedUser.email,
    username: updatedUser.username,
    token: resetToken,
    req,
  });

  return genericForgotPasswordResponse(res);
}

async function handleResetPassword(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to reset your password.',
      errors: { method: 'Only POST requests are supported.' },
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

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  const errors = {};

  if (!token) {
    errors.token = 'Password reset token is required.';
  }

  if (!password) {
    errors.password = 'New password is required.';
  } else if (password.length < 8) {
    errors.password = 'New password must be at least 8 characters.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the highlighted fields.',
      errors,
    });
  }

  const { db } = await connectToDatabase();
  const tokenHash = hashVerificationToken(token);
  const user = await findUserByPasswordResetTokenHash(db, tokenHash);

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'This password reset link is invalid or has already been used.',
      errors: { token: 'Invalid password reset link.' },
    });
  }

  if (user.emailVerified !== true) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email before resetting your password.',
      errors: { emailVerified: 'Email verification is required.' },
    });
  }

  const expiresAt = new Date(user.passwordResetExpiresAt);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return res.status(400).json({
      success: false,
      message: 'This password reset link has expired. Please request a new one.',
      errors: { token: 'Expired password reset link.' },
    });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  await resetUserPassword(db, user._id, hashedPassword);

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now sign in with your new password.',
    data: {},
  });
}

module.exports = async function passwordHandler(req, res) {
  try {
    const action = getPasswordAction(req);

    if (action === 'forgot') {
      return handleForgotPassword(req, res);
    }

    if (action === 'reset') {
      return handleResetPassword(req, res);
    }

    return res.status(404).json({
      success: false,
      message: 'Password endpoint was not found.',
      errors: { action: 'Supported password actions are forgot and reset.' },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Password request failed. Please try again later.',
      errors: { server: error.message },
    });
  }
};
