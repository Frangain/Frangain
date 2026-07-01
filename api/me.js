const { requireAuth } = require('../middleware/auth');

module.exports = requireAuth(async function meHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET to read the current user.',
      errors: { method: 'Only GET requests are supported.' },
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Authenticated user loaded.',
    data: {
      user: req.user,
    },
  });
});
