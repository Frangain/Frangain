const { ObjectId } = require('mongodb');

const { calculateMiningReward, hasMiningSessionCompleted } = require('../lib/mining');

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MEMORY_MINING_DEFAULTS = {
  memoryReserve: 0,
  totalFrangMined: 0,
  miningRate: 1.0,
  miningActive: false,
  miningStartedAt: null,
  lastClaimAt: null,
  lastMiningCompletedAt: null,
};

const NOTIFICATION_TYPE_DEFAULTS = {
  memoryMiningReady: true,
  miningSessionAvailable: true,
  frangainAnnouncements: true,
};

const NOTIFICATION_DEFAULTS = {
  enabled: false,
  permission: 'default',
  pushSubscription: null,
  types: NOTIFICATION_TYPE_DEFAULTS,
  updatedAt: null,
};

const PROFILE_DEFAULTS = {
  displayName: '',
  walletAddress: '',
  country: '',
  profileImage: '',
};

function getUsersCollection(db) {
  return db.collection('users');
}

async function ensureUserIndexes(db) {
  const users = getUsersCollection(db);

  await Promise.all([
    users.createIndex({ username: 1 }, { unique: true }),
    users.createIndex({ email: 1 }, { unique: true }),
  ]);
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeUserInput(input) {
  return {
    username: typeof input.username === 'string' ? input.username.trim() : '',
    email: normalizeEmail(input.email),
    password: typeof input.password === 'string' ? input.password : '',
    confirmPassword: typeof input.confirmPassword === 'string' ? input.confirmPassword : '',
  };
}

function normalizeLoginInput(input) {
  return {
    email: normalizeEmail(input.email),
    password: typeof input.password === 'string' ? input.password : '',
  };
}

function validateRegistrationInput(input) {
  const errors = {};

  if (!input.username) {
    errors.username = 'Username is required.';
  } else if (!USERNAME_PATTERN.test(input.username)) {
    errors.username = 'Username must be 3-20 characters and may contain only letters, numbers, and underscores.';
  }

  if (!input.email) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_PATTERN.test(input.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!input.password) {
    errors.password = 'Password is required.';
  } else if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

function validateLoginInput(input) {
  const errors = {};

  if (!input.email) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_PATTERN.test(input.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!input.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

async function findUserByUsernameOrEmail(db, username, email) {
  return getUsersCollection(db).findOne({
    $or: [{ username }, { email }],
  });
}

async function findUserByEmail(db, email) {
  return getUsersCollection(db).findOne({ email });
}

async function findUserById(db, id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return getUsersCollection(db).findOne({ _id: new ObjectId(id) });
}

function normalizeNotificationTypes(types = {}) {
  return {
    memoryMiningReady: types.memoryMiningReady !== false,
    miningSessionAvailable: types.miningSessionAvailable !== false,
    frangainAnnouncements: types.frangainAnnouncements !== false,
  };
}

function normalizeNotifications(notifications = {}) {
  return {
    enabled: notifications.enabled === true,
    permission: notifications.permission || NOTIFICATION_DEFAULTS.permission,
    pushSubscription: notifications.pushSubscription || NOTIFICATION_DEFAULTS.pushSubscription,
    types: normalizeNotificationTypes(notifications.types),
    updatedAt: notifications.updatedAt || NOTIFICATION_DEFAULTS.updatedAt,
  };
}

function normalizeProfileInput(input = {}) {
  return {
    displayName: typeof input.displayName === 'string' ? input.displayName.trim() : '',
    walletAddress: typeof input.walletAddress === 'string' ? input.walletAddress.trim() : '',
    country: typeof input.country === 'string' ? input.country.trim() : '',
    profileImage: typeof input.profileImage === 'string' ? input.profileImage.trim() : '',
  };
}

function validateProfileInput(input) {
  const errors = {};

  if (input.displayName && input.displayName.length > 60) {
    errors.displayName = 'Display name must be 60 characters or fewer.';
  }

  if (input.walletAddress && input.walletAddress.length > 120) {
    errors.walletAddress = 'Wallet address must be 120 characters or fewer.';
  }

  if (input.country && input.country.length > 80) {
    errors.country = 'Country must be 80 characters or fewer.';
  }

  if (input.profileImage) {
    const validImage = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.profileImage);

    if (!validImage) {
      errors.profileImage = 'Profile picture must be a PNG, JPG, or WEBP image.';
    } else if (input.profileImage.length > 750000) {
      errors.profileImage = 'Profile picture must be smaller than 500 KB.';
    }
  }

  return errors;
}

function validatePushSubscription(subscription) {
  const errors = {};

  if (!subscription || typeof subscription !== 'object') {
    errors.subscription = 'A valid push subscription is required.';
    return errors;
  }

  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
    errors.endpoint = 'Subscription endpoint is required.';
  }

  if (!subscription.keys || typeof subscription.keys !== 'object') {
    errors.keys = 'Subscription keys are required.';
    return errors;
  }

  if (!subscription.keys.p256dh || typeof subscription.keys.p256dh !== 'string') {
    errors.p256dh = 'Subscription public key is required.';
  }

  if (!subscription.keys.auth || typeof subscription.keys.auth !== 'string') {
    errors.auth = 'Subscription auth secret is required.';
  }

  return errors;
}

async function updateNotificationSettings(db, id, settings = {}) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const users = getUsersCollection(db);
  const userId = new ObjectId(id);
  const now = new Date();
  const notificationSettings = {
    enabled: settings.enabled === true,
    permission: settings.permission || 'default',
    pushSubscription: settings.pushSubscription || null,
    types: normalizeNotificationTypes(settings.types),
    updatedAt: now,
  };

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        notifications: notificationSettings,
        updatedAt: now,
      },
    }
  );

  return users.findOne({ _id: userId });
}

async function updateUserProfile(db, id, profileData = {}) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const users = getUsersCollection(db);
  const userId = new ObjectId(id);
  const now = new Date();
  const input = normalizeProfileInput(profileData);

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        displayName: input.displayName,
        walletAddress: input.walletAddress,
        country: input.country,
        profileImage: input.profileImage,
        updatedAt: now,
      },
    }
  );

  return users.findOne({ _id: userId });
}

async function updateUserPassword(db, id, hashedPassword) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const users = getUsersCollection(db);
  const userId = new ObjectId(id);
  const now = new Date();

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        password: hashedPassword,
        updatedAt: now,
      },
    }
  );

  return users.findOne({ _id: userId });
}

async function startMiningSession(db, id, startedAt = new Date()) {
  if (!ObjectId.isValid(id)) {
    return {
      matched: false,
      alreadyActive: false,
      user: null,
    };
  }

  const users = getUsersCollection(db);
  const userId = new ObjectId(id);
  const updateResult = await users.updateOne(
    {
      _id: userId,
      miningActive: { $ne: true },
    },
    {
      $set: {
        miningActive: true,
        miningStartedAt: startedAt,
        updatedAt: startedAt,
      },
    }
  );

  if (updateResult.modifiedCount === 1) {
    return {
      matched: true,
      alreadyActive: false,
      user: await users.findOne({ _id: userId }),
    };
  }

  const existingUser = await users.findOne({ _id: userId });

  return {
    matched: Boolean(existingUser),
    alreadyActive: Boolean(existingUser && existingUser.miningActive === true),
    user: existingUser,
  };
}

async function completeMiningSession(db, id, completedAt = new Date()) {
  if (!ObjectId.isValid(id)) {
    return {
      matched: false,
      completed: false,
      reason: 'not_found',
      reward: 0,
      user: null,
    };
  }

  const users = getUsersCollection(db);
  const userId = new ObjectId(id);
  const user = await users.findOne({ _id: userId });

  if (!user) {
    return {
      matched: false,
      completed: false,
      reason: 'not_found',
      reward: 0,
      user: null,
    };
  }

  if (user.miningActive !== true || !user.miningStartedAt) {
    return {
      matched: true,
      completed: false,
      reason: 'not_active',
      reward: 0,
      user,
    };
  }

  if (!hasMiningSessionCompleted(user.miningStartedAt, completedAt)) {
    return {
      matched: true,
      completed: false,
      reason: 'not_completed',
      reward: 0,
      user,
    };
  }

  const reward = calculateMiningReward(user.miningRate);

  const updateResult = await users.updateOne(
    { _id: userId, miningActive: true },
    {
      $inc: {
        memoryReserve: reward,
        totalFrangMined: reward,
      },
      $set: {
        miningActive: false,
        miningStartedAt: null,
        lastClaimAt: completedAt,
        lastMiningCompletedAt: completedAt,
        updatedAt: completedAt,
      },
    }
  );

  if (updateResult.modifiedCount !== 1) {
    return {
      matched: true,
      completed: false,
      reason: 'not_active',
      reward: 0,
      user: await users.findOne({ _id: userId }),
    };
  }

  return {
    matched: true,
    completed: true,
    reason: null,
    reward,
    user: await users.findOne({ _id: userId }),
  };
}

function sanitizeUser(user) {
  return {
    id: user._id ? user._id.toString() : user.id.toString(),
    username: user.username,
    email: user.email,
    displayName: user.displayName ?? PROFILE_DEFAULTS.displayName,
    walletAddress: user.walletAddress ?? PROFILE_DEFAULTS.walletAddress,
    country: user.country ?? PROFILE_DEFAULTS.country,
    profileImage: user.profileImage ?? PROFILE_DEFAULTS.profileImage,
    memoryReserve: user.memoryReserve ?? MEMORY_MINING_DEFAULTS.memoryReserve,
    totalFrangMined: user.totalFrangMined ?? MEMORY_MINING_DEFAULTS.totalFrangMined,
    miningRate: user.miningRate ?? MEMORY_MINING_DEFAULTS.miningRate,
    miningActive: user.miningActive ?? MEMORY_MINING_DEFAULTS.miningActive,
    miningStartedAt: user.miningStartedAt ?? MEMORY_MINING_DEFAULTS.miningStartedAt,
    lastClaimAt: user.lastClaimAt ?? MEMORY_MINING_DEFAULTS.lastClaimAt,
    lastMiningCompletedAt: user.lastMiningCompletedAt ?? MEMORY_MINING_DEFAULTS.lastMiningCompletedAt,
    notifications: normalizeNotifications(user.notifications),
    circleMembers: user.circleMembers,
    miningBonus: user.miningBonus,
    totalMined: user.totalMined,
    lastMiningTime: user.lastMiningTime,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function createUser(db, userData) {
  const now = new Date();
  const user = {
    username: userData.username,
    email: userData.email,
    password: userData.password,
    ...PROFILE_DEFAULTS,
    ...MEMORY_MINING_DEFAULTS,
    notifications: normalizeNotifications(),
    circleMembers: 0,
    miningBonus: 0,
    totalMined: 0,
    lastMiningTime: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getUsersCollection(db).insertOne(user);

  return sanitizeUser({ ...user, _id: result.insertedId });
}

module.exports = {
  completeMiningSession,
  createUser,
  ensureUserIndexes,
  findUserByEmail,
  findUserById,
  findUserByUsernameOrEmail,
  normalizeLoginInput,
  normalizeNotifications,
  normalizeNotificationTypes,
  normalizeProfileInput,
  normalizeUserInput,
  sanitizeUser,
  startMiningSession,
  updateNotificationSettings,
  updateUserPassword,
  updateUserProfile,
  validateProfileInput,
  validatePushSubscription,
  validateLoginInput,
  validateRegistrationInput,
};
