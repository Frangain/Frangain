const connectToDatabase = require('../../lib/mongodb');
const { requireAuth } = require('../../middleware/auth');
const { claimMiningReward, sanitizeUser } = require('../../models/User');

module.exports = requireAuth(async function claimMiningHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to claim a Mining Reward.',
      errors: { method: 'Only POST requests are supported.' },
    });
  }

  try {
    const { db } = await connectToDatabase();
    const result = await claimMiningReward(db, req.user.id, new Date());

    if (!result.matched) {
      return res.status(404).json({
        success: false,
        message: 'Authenticated user was not found.',
        errors: { user: 'User account does not exist.' },
      });
    }

    if (result.reason === 'not_active') {
      return res.status(409).json({
        success: false,
        message: 'No active Mining Session is available to claim.',
        errors: { miningActive: 'Start and complete a Mining Session before claiming.' },
      });
    }

    if (result.reason === 'not_completed') {
      return res.status(409).json({
        success: false,
        message: 'Your Mining Session is not finished yet.',
        errors: { miningSession: 'A Mining Session must run for 24 hours before claiming.' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mining Reward Claimed',
      data: {
        reward: result.reward,
        claimedAt: result.user.lastClaimAt,
        user: sanitizeUser(result.user),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to claim Mining Reward. Please try again later.',
      errors: { server: error.message },
    });
  }
});
