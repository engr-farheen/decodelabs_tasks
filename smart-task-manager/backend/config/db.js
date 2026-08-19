const mongoose = require('mongoose');
const dns = require('dns');

// Node.js sometimes prefers IPv6 for DNS resolution, which can fail to
// reach MongoDB Atlas on networks where IPv6 routing is broken — forcing
// IPv4 first fixes the "querySrv ECONNREFUSED" error on those networks.
dns.setDefaultResultOrder('ipv4first');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;