const webPush = require('web-push');

const NOTIFICATION_TYPES = {
  memoryMiningReady: {
    label: 'Memory Mining ready to claim',
    description: 'Receive an alert when a Mining Session reaches its completion window.',
  },
  miningSessionAvailable: {
    label: 'Mining session available',
    description: 'Receive a reminder when it is time to begin a new Mining Session.',
  },
  frangainAnnouncements: {
    label: 'FRANGAIN announcements',
    description: 'Receive important FRANGAIN Ecosystem updates.',
  },
};

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function getVapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY || '';
}

function getVapidSubject() {
  return process.env.VAPID_SUBJECT || 'mailto:admin@frangain.com';
}

function isPushConfigured() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

function configureWebPush() {
  if (!isPushConfigured()) {
    return false;
  }

  webPush.setVapidDetails(getVapidSubject(), getVapidPublicKey(), getVapidPrivateKey());
  return true;
}

async function sendPushNotification(subscription, payload) {
  if (!configureWebPush()) {
    throw new Error('Web Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  }

  return webPush.sendNotification(subscription, JSON.stringify(payload));
}

module.exports = {
  NOTIFICATION_TYPES,
  getVapidPublicKey,
  isPushConfigured,
  sendPushNotification,
};
