const dotenv = require("dotenv");
dotenv.config();

module.exports = {
    port: process.env.PORT || 4000,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    rpcUrl: process.env.RPC_URL,
};