const { ObjectId } = require('mongodb');

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function sanitizeUser(user) {
  return {
    id: user._id ? user._id.toString() : user.id.toString(),
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    memoryReserve: user.memoryReserve,
    miningRate: user.miningRate,
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
    emailVerified: false,
    memoryReserve: 0,
    miningRate: 1.0,
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
  createUser,
  ensureUserIndexes,
  findUserByEmail,
  findUserById,
  findUserByUsernameOrEmail,
  normalizeLoginInput,
  normalizeUserInput,
  sanitizeUser,
  validateLoginInput,
  validateRegistrationInput,
};
