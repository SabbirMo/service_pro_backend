const dns = require('node:dns');
const mongoose = require('mongoose');

const configureMongoDns = async (uri) => {
  if (!uri || !uri.startsWith('mongodb+srv://')) {
    return;
  }
  try {
    const hostname = new URL(uri).hostname;
    await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      dns.setServers(['1.1.1.1', '8.8.8.8']);
    }
  }
};

const connectDB = async () => {
  try {
    await configureMongoDns(process.env.MONGODB_URI);
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
