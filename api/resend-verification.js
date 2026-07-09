const connectToDatabase = require('../lib/mongodb');
const { sendVerificationEmail } = require('../lib/email');
const {
  createVerificationToken,
  getVerificationExpiry,
  hashVerificationToken,
  isEmailVerificationRequired,
} = require('../lib/emailVerification');
const { findUserByEmail, normalizeLoginInput, updateEmailVerificationToken } = require('../models/User');

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

module.exports = async function resendVerificationHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to resend verification email.',
      errors: { method: 'Only POST requests are supported.' },
    });
  }

  if (!isEmailVerificationRequired()) {
    return res.status(200).json({
      success: true,
      message: 'Email verification is not required for this environment.',
      data: { emailVerificationRequired: false },
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

    if (!input.email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        errors: { email: 'Enter the email address for your FRANGAIN account.' },
      });
    }

    const { db } = await connectToDatabase();
    const user = await findUserByEmail(db, input.email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No FRANGAIN account was found for this email address.',
        errors: { email: 'No account exists for this email address.' },
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'This account is already verified. You can sign in now.',
        data: { alreadyVerified: true },
      });
    }

    const verificationToken = createVerificationToken();
    const updatedUser = await updateEmailVerificationToken(
      db,
      user._id,
      hashVerificationToken(verificationToken),
      getVerificationExpiry()
    );

    await sendVerificationEmail({
      to: updatedUser.email,
      username: updatedUser.username,
      token: verificationToken,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      data: { email: updatedUser.email },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to resend verification email. Please try again later.',
      errors: { server: error.message },
    });
  }
};
