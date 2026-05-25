const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const { pingRedis } = require("../queues");

router.get("/", async (_, res) => {
    const health = { status: "ok", db: "connected", redis: "connected" };
    let httpStatus = 200;

    try {
        await getPool().query("SELECT 1");
    } catch (_err) {
        health.db = "disconnected";
        health.status = "degraded";
        httpStatus = 503;
    }

    try {
        await pingRedis();
    } catch (_err) {
        health.redis = "disconnected";
        health.status = "degraded";
        httpStatus = 503;
    }

    res.status(httpStatus).json(health);
});

module.exports = router;
