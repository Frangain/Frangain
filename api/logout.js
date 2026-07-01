const { AUTH_COOKIE_NAME } = require('../lib/auth');

function serializeLogoutCookie() {
  const cookieParts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

module.exports = async function logoutHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to sign out.',
      errors: { method: 'Only POST requests are supported.' },
    });
  }

  res.setHeader('Set-Cookie', serializeLogoutCookie());

  return res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
    data: {},
  });
};
