const connectToDatabase = require('../../lib/mongodb');
const { requireAuth } = require('../../middleware/auth');
const { sanitizeUser, startMiningSession } = require('../../models/User');

module.exports = requireAuth(async function startMiningHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to start Memory Mining.',
      errors: { method: 'Only POST requests are supported.' },
    });
  }

  try {
    const { db } = await connectToDatabase();
    const result = await startMiningSession(db, req.user.id, new Date());

    if (!result.matched) {
      return res.status(404).json({
        success: false,
        message: 'Authenticated user was not found.',
        errors: { user: 'User account does not exist.' },
      });
    }

    if (result.alreadyActive) {
      return res.status(409).json({
        success: false,
        message: 'A Mining Session is already active.',
        errors: { miningActive: 'Your current Mining Session has already started.' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mining Session Started',
      data: {
        user: sanitizeUser(result.user),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to start Memory Mining. Please try again later.',
      errors: { server: error.message },
    });
  }
});
