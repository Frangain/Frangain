const connectToDatabase = require('../../lib/mongodb');
const { requireAuth } = require('../../middleware/auth');
const { NOTIFICATION_TYPES, getVapidPublicKey, isPushConfigured } = require('../../lib/pushNotifications');
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

function getNotificationAction(req) {
  if (req.query && typeof req.query.action === 'string') {
    return req.query.action;
  }

  const pathname = (req.url || '').split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET to read notification settings.',
      errors: { method: 'Only GET requests are supported.' },
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Notification settings loaded.',
    data: {
      notifications: req.user.notifications,
      notificationTypes: NOTIFICATION_TYPES,
      vapidPublicKey: getVapidPublicKey(),
      pushConfigured: isPushConfigured(),
    },
  });
}

async function handleSubscribe(req, res) {
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
}

async function handleUnsubscribe(req, res) {
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
}

module.exports = requireAuth(async function notificationHandler(req, res) {
  const action = getNotificationAction(req);

  if (action === 'status') {
    return handleStatus(req, res);
  }

  if (action === 'subscribe') {
    return handleSubscribe(req, res);
  }

  if (action === 'unsubscribe') {
    return handleUnsubscribe(req, res);
  }

  return res.status(404).json({
    success: false,
    message: 'Notification endpoint was not found.',
    errors: { action: 'Supported notification actions are status, subscribe, and unsubscribe.' },
  });
});
