const config = require("../config");
// Supported chain IDs and their names
const supportedChains = {
    80002: { name: "amoy", rpcUrl: config.amoyRpcUrl },
    43113: { name: "fuji", rpcUrl: config.fujiRpcUrl },
    11155420: { name: "opsepolia", rpcUrl: config.opsepoliaRpcUrl },
    97: { name: "bnbTestnet", rpcUrl: config.bnbTestnetRpcUrl },
    11155111: { name: "sepolia", rpcUrl: config.sepoliaRpcUrl },
    11142220: { name: "celoSepolia", rpcUrl: config.celoSepoliaRpcUrl },
    84532: { name: "baseSepolia", rpcUrl: config.baseSepoliaRpcUrl },
};

module.exports = { supportedChains };