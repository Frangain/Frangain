const { requireAuth } = require('../../middleware/auth');
const { NOTIFICATION_TYPES, getVapidPublicKey, isPushConfigured } = require('../../lib/pushNotifications');

module.exports = requireAuth(async function notificationStatusHandler(req, res) {
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
});
