const connectToDatabase = require('../../lib/mongodb');
const { requireAuth } = require('../../middleware/auth');
const { getVapidPublicKey } = require('../../lib/pushNotifications');
const {
  normalizeNotificationTypes,
  sanitizeUser,
  updateNotificationSettings,
  validatePushSubscription,
} = require('../../models/User');

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

module.exports = requireAuth(async function notificationSubscribeHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to enable notifications.',
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

  if (!getVapidPublicKey()) {
    return res.status(503).json({
      success: false,
      message: 'Notifications are not configured yet. Please set VAPID_PUBLIC_KEY in the environment.',
      errors: { vapidPublicKey: 'VAPID public key is missing.' },
    });
  }

  const validationErrors = validatePushSubscription(body.subscription);

  if (Object.keys(validationErrors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Unable to enable notifications with this browser subscription.',
      errors: validationErrors,
    });
  }

  try {
    const { db } = await connectToDatabase();
    const updatedUser = await updateNotificationSettings(db, req.user.id, {
      enabled: true,
      permission: body.permission || 'granted',
      pushSubscription: body.subscription,
      types: normalizeNotificationTypes(body.types),
    });

    return res.status(200).json({
      success: true,
      message: 'Notifications enabled for the FRANGAIN Ecosystem.',
      data: {
        notifications: sanitizeUser(updatedUser).notifications,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to enable notifications. Please try again later.',
      errors: { server: error.message },
    });
  }
});
