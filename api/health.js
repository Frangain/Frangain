const connectToDatabase = require('../lib/mongodb');

module.exports = async function healthHandler(req, res) {
  try {
    const { db } = await connectToDatabase();
    await db.command({ ping: 1 });

    return res.status(200).json({
      success: true,
      message: 'FRANGAIN Ecosystem backend is running.',
      database: 'Connected',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'FRANGAIN Ecosystem backend health check failed.',
      database: 'Disconnected',
      error: error.message,
    });
  }
};
