const connectToDatabase = require('../lib/mongodb');
const { hashVerificationToken } = require('../lib/emailVerification');
const { findUserByVerificationTokenHash, verifyUserEmail } = require('../models/User');

function sendHtml(res, status, title, message) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FRANGAIN Email Verification</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f7f9; color: #20509e; font-family: Arial, sans-serif; }
      main { width: min(92vw, 560px); padding: 42px; background: #fff; border-radius: 8px; box-shadow: 0 23px 49px rgba(33, 54, 61, 0.12); text-align: center; }
      h1 { margin: 0 0 14px; font-size: 34px; }
      p { color: #75849a; line-height: 1.6; }
      a { display: inline-block; margin-top: 18px; padding: 14px 28px; border-radius: 50px; background: linear-gradient(to right, #3e2bce, #2dd3aa); color: #fff; text-decoration: none; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="/ecosystem/login.html">Sign In</a>
    </main>
  </body>
</html>`);
}

module.exports = async function verifyEmailHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendHtml(res, 405, 'Verification link unavailable', 'Please open the verification link from your email.');
  }

  try {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const token = (req.query && req.query.token) || requestUrl.searchParams.get('token');

    if (!token || typeof token !== 'string') {
      return sendHtml(res, 400, 'Verification link unavailable', 'This verification link is missing its secure token.');
    }

    const { db } = await connectToDatabase();
    const tokenHash = hashVerificationToken(token);
    const user = await findUserByVerificationTokenHash(db, tokenHash);

    if (!user) {
      return sendHtml(res, 400, 'Verification link unavailable', 'This verification link has already been used or is no longer valid.');
    }

    const expiresAt = new Date(user.emailVerificationExpiresAt);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return sendHtml(res, 400, 'Verification link expired', 'Please request a new verification email and try again.');
    }

    await verifyUserEmail(db, user._id, new Date());

    return sendHtml(res, 200, 'Email verified', 'Your FRANGAIN Ecosystem account is active. You can now sign in and continue building your Memory Reserve.');
  } catch (error) {
    return sendHtml(res, 500, 'Verification temporarily unavailable', 'Please try again later.');
  }
};
