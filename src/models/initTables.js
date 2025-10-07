const { getPool } = require("../db.js");
const logger = require("../lib/logger.js");
async function initDb() {
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
      wallet_id SERIAL PRIMARY KEY,
        public_key TEXT UNIQUE NOT NULL,
        private_key TEXT NOT NULL, 
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        queue_id UUID PRIMARY KEY,
        backend_wallet TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        function_signature TEXT NOT NULL,
        args JSONB,
        chain_id BIGINT NOT NULL,
        transaction_hash TEXT,
        status TEXT DEFAULT 'queued',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

  } catch (err) {
    logger.error("Failed to initialize DB schema", err);
    process.exit(1);
  }
}

module.exports = { initDb };