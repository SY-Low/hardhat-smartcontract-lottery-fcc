const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
// const { CompilationJobCreationErrorReason } = require("hardhat/types");
const { developmentChains } = require("../../helper-hardhat-config");

//If development chain then test, else skip test (we only want to run staging test in test network)
developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Staging Test", async function () {
      let raffle, raffleEntranceFee, deployer;
      // we do not need the mock vrfCoordinator & interval & player (get on spot in test net)

      const chainId = network.config.chainId;

      // pre-requisite before each test below
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer; // from hardhat.config.js: as we hardcode to 0 & player = 1, it's better we use getSigner to get list of account in current node
        // accounts = await ethers.getSigners();
        // deployer = accounts[0]; // defined first signer as the deployer, second as the player
        // player = accounts[1];

        //await deployments.fixture(["all"]); //deploy everything: under both deploy js module.exports
        raffle = await ethers.getContract("Raffle", deployer); // connect the contract Raffle to the deployer
        // do not need to connect the player to contract (unlike local unit test)
        //raffle = raffleContract.connect(player); // **Returns new instance of Raffle Contract connected to player
        raffleEntranceFee = await raffle.getEntranceFee(); // after connect with player only get remaining properties

        // we do not need interval as the counter could be run after we deploy into test net
      });

      describe("fullfillRandomWords", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          // enter the raffle, random number will be handled by chianlink keep and vrf in test net
          const startingTimeStamp = await raffle.getLatestTime();
          const accounts = await ethers.getSigners();

          await new Promise(async (resolve, reject) => {
            // setup listener before we enter the raffle*****
            // Just in case the blockchain moves REALLY fast in test net
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!");

              try {
                // add our asserts here
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance(); // deployer balance
                const endingTimeStamp = await raffle.getLatestTime();

                await expect(raffle.getPlayer(0)).to.be.reverted; // expect player 0 to be reverted 
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState, "0");
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEntranceFee).toString() //expect ending balance = starting balance + raffleEntrance Fees
                );
                    assert (endingTimeStamp > startingTimeStamp);
                    resolve();

              } catch (error) {
                console.log(error);
                reject(e);
              }
            });

            //Then entering the raffle, after the event Promise (listener) function done
            console.log("Entering Raffle...")
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
                      console.log("Ok, time to wait...");
            const winnerStartingBalance = await accounts[0].getBalance(); //upon entering the raffle, get winner starting balance

            // and this code WONT complete until our listener has finised listening!
          });
        });
      });
    });

