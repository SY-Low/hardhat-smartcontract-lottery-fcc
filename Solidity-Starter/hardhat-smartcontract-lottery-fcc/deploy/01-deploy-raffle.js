const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { networkConfig } = require("../helper-hardhat-config"); // to store list of network
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("1"); //1 LINK TOKEN: 1 Ether = 1e18 Wei

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address, subscriptionId;

  /**
   * Different args value for mocks and test net VRF Coordinator
   */
  if (developmentChains.includes(network.name)) {
    // Mock Contract for testing (local network)
    const VRFCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address;
    // create mock subscription automatically from local network
    const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId; //there are one event emitted for the tranactionReceipt under Mock COntract

    // Fund the subcscription
    // Usually, you'd need the link token on a real network
    await VRFCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMOUNT
    );
  } else {
    //Test Net, if we are not in the development environment
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  /**
   * General args value from helper-hardhat-config
   */
  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]; // Raffle constructor args
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  //VM Exception while processing transaction: reverted with custom error 'InvalidConsumer()'
  /**
   * Create a new consumer when running in local
   */
  if (chainId == 31337) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );

    await vrfCoordinatorV2Mock.addConsumer(
      subscriptionId.toNumber(),
      raffle.address
    );
    log("adding consumer...");
    log("Consumer added!");
  }

  // after deployment complete, execute verify.js under utils for verifications
  // ONLY verify when deploy to test net
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifiying...");
    await verify(raffle.address, args);
  }
  log("---------------------------------------");
};

module.exports.tags = ["all", "raffle"];
