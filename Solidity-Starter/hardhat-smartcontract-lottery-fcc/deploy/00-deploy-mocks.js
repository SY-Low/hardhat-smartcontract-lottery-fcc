const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

// args for VRFCOordinatorV2Mock - deploy mock to test net
const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK per request : for the random number
const GAS_PRICE_LINK = 1e9; // link per gas - calculated value based on the gas price of the chain.

// Eth price ^ $ 1,000,000,000
// Chainlink Nodes pay the gas fees to give us randomness and do external execution
// So the price of requests change basd on the price of gas

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  const chainId = network.config.chainId;

  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");
    //deploy a mock vrfcoordinator...
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: args,
      log: true,
      //waitConfirmations: network.config.blockConfirmations || 1,
    });
    log("Mocks Deployed!");
    log("---------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
