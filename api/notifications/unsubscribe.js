const connectToDatabase = require('../../lib/mongodb');
const { requireAuth } = require('../../middleware/auth');
const { normalizeNotificationTypes, sanitizeUser, updateNotificationSettings } = require('../../models/User');

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

module.exports = requireAuth(async function notificationUnsubscribeHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to disable notifications.',
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

  try {
    const { db } = await connectToDatabase();
    const updatedUser = await updateNotificationSettings(db, req.user.id, {
      enabled: false,
      permission: body.permission || 'default',
      pushSubscription: null,
      types: normalizeNotificationTypes(body.types || req.user.notifications.types),
    });

    return res.status(200).json({
      success: true,
      message: 'Notifications disabled for the FRANGAIN Ecosystem.',
      data: {
        notifications: sanitizeUser(updatedUser).notifications,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to disable notifications. Please try again later.',
      errors: { server: error.message },
    });
  }
});
