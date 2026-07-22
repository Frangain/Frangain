function getBaseUrl(req) {
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  const host = req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  const protocol = req && req.headers && (req.headers['x-forwarded-proto'] || 'http');

  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

function createVerificationUrl(token, req) {
  return `${getBaseUrl(req)}/api/verify-email?token=${encodeURIComponent(token)}`;
}

function createPasswordResetUrl(token, req) {
  return `${getBaseUrl(req)}/ecosystem/reset-password.html?token=${encodeURIComponent(token)}`;
}

function buildVerificationEmail({ username, verificationUrl }) {
  const safeUsername = username || 'FRANGAIN member';

  return {
    subject: 'Verify your FRANGAIN Ecosystem account',
    text: [
      `Hello ${safeUsername},`,
      '',
      'Welcome to the FRANGAIN Ecosystem.',
      'Verify your email address to activate your account:',
      verificationUrl,
      '',
      'The Coin Remembers.',
    ].join('\n'),
    html: [
      `<p>Hello ${safeUsername},</p>`,
      '<p>Welcome to the FRANGAIN Ecosystem.</p>',
      `<p><a href="${verificationUrl}">Verify your email address</a> to activate your account.</p>`,
      '<p>The Coin Remembers.</p>',
    ].join(''),
  };
}

function buildPasswordResetEmail({ username, resetUrl }) {
  const safeUsername = username || 'FRANGAIN member';

  return {
    subject: 'Reset your FRANGAIN Ecosystem password',
    text: [
      `Hello ${safeUsername},`,
      '',
      'We received a request to reset your FRANGAIN Ecosystem password.',
      'Use this secure link to create a new password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
      '',
      'The Coin Remembers.',
    ].join('\n'),
    html: [
      `<p>Hello ${safeUsername},</p>`,
      '<p>We received a request to reset your FRANGAIN Ecosystem password.</p>',
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      '<p>If you did not request this, you can ignore this email.</p>',
      '<p>The Coin Remembers.</p>',
    ].join(''),
  };
}

async function sendWithResend({ to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'FRANGAIN <frangain@frangain.com>',
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email delivery failed with status ${response.status}.`);
  }
}

async function sendWithSendGrid({ to, subject, text, html }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.EMAIL_FROM || 'frangain@frangain.com' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid email delivery failed with status ${response.status}.`);
  }
}

async function sendVerificationEmail({ to, username, token, req }) {
  const verificationUrl = createVerificationUrl(token, req);
  const message = buildVerificationEmail({ username, verificationUrl });

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({ to, ...message });
    return { sent: true, provider: 'resend' };
  }

  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid({ to, ...message });
    return { sent: true, provider: 'sendgrid' };
  }

  if (process.env.EMAIL_DELIVERY_MODE === 'console' && process.env.NODE_ENV !== 'production') {
    console.log(`FRANGAIN verification email for ${to}: ${verificationUrl}`);
    return { sent: true, provider: 'console', verificationUrl };
  }

  throw new Error('Email delivery is not configured.');
}

async function sendPasswordResetEmail({ to, username, token, req }) {
  const resetUrl = createPasswordResetUrl(token, req);
  const message = buildPasswordResetEmail({ username, resetUrl });

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({ to, ...message });
    return { sent: true, provider: 'resend' };
  }

  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid({ to, ...message });
    return { sent: true, provider: 'sendgrid' };
  }

  if (process.env.EMAIL_DELIVERY_MODE === 'console' && process.env.NODE_ENV !== 'production') {
    console.log(`FRANGAIN password reset email for ${to}: ${resetUrl}`);
    return { sent: true, provider: 'console', resetUrl };
  }

  throw new Error('Email delivery is not configured.');
}

module.exports = {
  createPasswordResetUrl,
  createVerificationUrl,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
