/**
 * config/db.js
 *
 * Separating the DB connection logic into its own config module follows the
 * MVC "Separation of Concerns" principle required by the academic spec.
 * server.js calls this function; it is NOT inlined there to keep server.js clean.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
