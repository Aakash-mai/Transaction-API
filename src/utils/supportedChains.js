const config = require("../config");
// Supported chain IDs and their names
const supportedChains = {
    80002: { name: "amoy", rpcUrl: config.amoyRpcUrl },
    43113: { name: "fuji", rpcUrl: config.fujiRpcUrl },
    11155420: { name: "opsepolia", rpcUrl: config.opsepoliaRpcUrl },
};

module.exports = { supportedChains };