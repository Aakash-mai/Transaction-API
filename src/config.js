const dotenv = require("dotenv");
dotenv.config();

module.exports = {
    port: process.env.PORT || 4000,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    amoyRpcUrl: process.env.AMOY_RPC_URL,
    fujiRpcUrl: process.env.FUJI_RPC_URL,
    opsepoliaRpcUrl: process.env.OPSEPOLIA_RPC_URL,
    bnbTestnetRpcUrl: process.env.BNBTESTNET_RPC_URL,
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
    celoSepoliaRpcUrl: process.env.CELO_SEPOLIA_RPC_URL,
    baseSepoliaRpcUrl: process.env.BASESEPOLIA_RPC_URL,
    // Kalp credentials
    prodkalpPrivateKey: process.env.PROD_KALP_PRIVATE_KEY,
    prodkalpEnrollmentId: process.env.PROD_KALP_ENROLLMENT_ID,
    prodkalpCert: process.env.PROD_KALP_CERT,
    devkalpPrivateKey: process.env.DEV_KALP_PRIVATE_KEY,
    devkalpEnrollmentId: process.env.DEV_KALP_ENROLLMENT_ID,
    devkalpCert: process.env.DEV_KALP_CERT,
    stagekalpPrivateKey: process.env.STAGE_KALP_PRIVATE_KEY,
    stagekalpEnrollmentId: process.env.STAGE_KALP_ENROLLMENT_ID,
    stagekalpCert: process.env.STAGE_KALP_CERT,
};