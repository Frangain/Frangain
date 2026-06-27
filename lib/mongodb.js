const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'frangain_ecosystem';

if (!global._frangainMongo) {
  global._frangainMongo = {
    client: null,
    db: null,
    promise: null,
  };
}

async function connectToDatabase() {
  if (!uri) {
    throw new Error('MongoDB connection failed: MONGODB_URI is not defined in the environment.');
  }

  if (global._frangainMongo.client && global._frangainMongo.db) {
    return {
      client: global._frangainMongo.client,
      db: global._frangainMongo.db,
    };
  }

  if (!global._frangainMongo.promise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    global._frangainMongo.promise = client
      .connect()
      .then((connectedClient) => {
        const db = connectedClient.db(dbName);

        global._frangainMongo.client = connectedClient;
        global._frangainMongo.db = db;

        return { client: connectedClient, db };
      })
      .catch((error) => {
        global._frangainMongo.promise = null;
        throw new Error(`MongoDB connection failed: ${error.message}`);
      });
  }

  return global._frangainMongo.promise;
}

module.exports = connectToDatabase;

