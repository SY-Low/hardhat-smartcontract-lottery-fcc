const {
  TASK_TEST_RUN_MOCHA_TESTS,
} = require("hardhat/builtin-tasks/task-names");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

const GOERLI_RPC_URL =
  process.env.GOERLI_RPC_URL ||
  //"https://eth-goerli.g.alchemy.com/v2/6aKMaw9AmjRTvN3_02uRVpld-fGuD9pL";
"https://goerli.infura.io/v3/f10c0b42e0f94bf6862a5cc615016ac5"; //starter app in infura nodes
const GOERLI_PRIVATE_KEY =
  "4574fd8ba80e4ab0af6afefb27ae18f6296ae716cc97f51aa6ae85e6da6ec222"; //process.env.GOERLI_PRIVATE_KEY || "0x";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const REPORT_GAS = process.env.REPORT_GAS || false;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    localhost: {
      chainId: 31337,
    },
    goerli: {
      chainId: 5,
      blockConfirmations: 6,
      url: GOERLI_RPC_URL,
      accounts:
        GOERLI_PRIVATE_KEY !== undefined ? [`0x${GOERLI_PRIVATE_KEY}`] : [],
      // accounts: { mnemonic: MNEMONIC },
      saveDeployments: true,
    },
  },
  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: false, //REPORT_GAS,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: COINMARKETCAP_API_KEY,
  },
  mocha: {
    timeout: 500000, //500 seconds max for running test: Raffle.test.js -> WinnerPicked events
  },
  solidity: "0.8.17",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
};
