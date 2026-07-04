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

async function claimMiningReward(db, id, claimedAt = new Date()) {
  if (!ObjectId.isValid(id)) {
    return {
      matched: false,
      claimable: false,
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
      claimable: false,
      reason: 'not_found',
      reward: 0,
      user: null,
    };
  }

  if (user.miningActive !== true || !user.miningStartedAt) {
    return {
      matched: true,
      claimable: false,
      reason: 'not_active',
      reward: 0,
      user,
    };
  }

  if (!hasMiningSessionCompleted(user.miningStartedAt, claimedAt)) {
    return {
      matched: true,
      claimable: false,
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
        lastClaimAt: claimedAt,
        lastMiningCompletedAt: claimedAt,
        updatedAt: claimedAt,
      },
    }
  );

  if (updateResult.modifiedCount !== 1) {
    return {
      matched: true,
      claimable: false,
      reason: 'not_active',
      reward: 0,
      user: await users.findOne({ _id: userId }),
    };
  }

  return {
    matched: true,
    claimable: true,
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
    emailVerified: user.emailVerified,
    memoryReserve: user.memoryReserve ?? MEMORY_MINING_DEFAULTS.memoryReserve,
    totalFrangMined: user.totalFrangMined ?? MEMORY_MINING_DEFAULTS.totalFrangMined,
    miningRate: user.miningRate ?? MEMORY_MINING_DEFAULTS.miningRate,
    miningActive: user.miningActive ?? MEMORY_MINING_DEFAULTS.miningActive,
    miningStartedAt: user.miningStartedAt ?? MEMORY_MINING_DEFAULTS.miningStartedAt,
    lastClaimAt: user.lastClaimAt ?? MEMORY_MINING_DEFAULTS.lastClaimAt,
    lastMiningCompletedAt: user.lastMiningCompletedAt ?? MEMORY_MINING_DEFAULTS.lastMiningCompletedAt,
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
    emailVerified: true,
    ...MEMORY_MINING_DEFAULTS,
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
  claimMiningReward,
  createUser,
  ensureUserIndexes,
  findUserByEmail,
  findUserById,
  findUserByUsernameOrEmail,
  normalizeLoginInput,
  normalizeUserInput,
  sanitizeUser,
  startMiningSession,
  validateLoginInput,
  validateRegistrationInput,
};
