const pkg = require("pg");
const logger = require("../lib/logger");

const { Pool } = pkg;
let pool;

async function connectDb() {
    if (pool) return pool;
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    // Log unexpected client errors so they don't become unhandled rejections
    pool.on("error", (err) => {
        logger.error(`Unexpected DB pool client error: ${err.message}`);
    });

    try {
        await pool.query("SELECT NOW()");
        logger.info("Postgres Connection Successful");
    } catch (err) {
        logger.error(`Failed to connect to Postgres: ${err.message}`);
        process.exit(1);
    }

    return pool;
}

function getPool() {
    if (!pool) throw new Error("DB pool not initialized. Call connectDb() first.");
    return pool;
}

async function disconnectDb() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info("Postgres pool closed.");
    }
}

module.exports = { getPool, connectDb, disconnectDb };
