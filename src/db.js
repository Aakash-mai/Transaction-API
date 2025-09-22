const pkg = require("pg");
const fs = require("fs");
const path = require("path");
const logger = require("./lib/logger.js");

const { Pool } = pkg;
let pool;

/**
 * Initialize and connect to Aiven Postgres
 */
async function connectDb() {
    if (pool) return pool; // already connected
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // ssl: { rejectUnauthorized: false },
        ssl: {
            rejectUnauthorized: true, // still validate server cert
            ca: fs.readFileSync(path.resolve(__dirname, "../certs/ca.pem")).toString(),
        },
    });
    try {
        await pool.query("SELECT NOW()");
        logger.info("Postgres Connection Successful");
    } catch (err) {
        logger.error("Failed to connect to Postgres!", err);
        process.exit(1);
    }

    return pool;
}
function getPool() {
    if (!pool) throw new Error("Pool not initialized. Call connectDb() first.");
    return pool;
}
module.exports = { getPool, connectDb };