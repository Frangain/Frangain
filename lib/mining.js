const MINING_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const BASE_DAILY_MINING_REWARD = 24;

function calculateMiningReward(miningRate) {
  const rate = Number.isFinite(Number(miningRate)) ? Number(miningRate) : 1;
  return BASE_DAILY_MINING_REWARD * rate;
}

function hasMiningSessionCompleted(miningStartedAt, now = new Date()) {
  const startedAt = new Date(miningStartedAt);

  if (Number.isNaN(startedAt.getTime())) {
    return false;
  }

  return now.getTime() - startedAt.getTime() >= MINING_SESSION_DURATION_MS;
}

module.exports = {
  BASE_DAILY_MINING_REWARD,
  MINING_SESSION_DURATION_MS,
  calculateMiningReward,
  hasMiningSessionCompleted,
};
