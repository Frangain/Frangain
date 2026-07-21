const connectToDatabase = require('../lib/mongodb');
const { requireAuth } = require('../middleware/auth');
const { sanitizeUser, updateUserProfile, normalizeProfileInput, validateProfileInput } = require('../models/User');

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

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET to read profile data or PUT to update profile data.',
      errors: { method: 'Only GET and PUT requests are supported.' },
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
