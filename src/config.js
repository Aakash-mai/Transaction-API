const dotenv = require("dotenv");
dotenv.config();

module.exports = {
    port: process.env.PORT || 4000,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    amoyRpcUrl: process.env.AMOY_RPC_URL,
    fujiRpcUrl: process.env.FUJI_RPC_URL,
    opsepoliaRpcUrl: process.env.OPSEPOLIA_RPC_URL,
};