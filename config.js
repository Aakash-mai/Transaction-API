const dotenv = require("dotenv");

dotenv.config();

module.exports = {
    port: process.env.PORT || 4000,
    databaseUrl: process.env.DATABASE_URL,
};