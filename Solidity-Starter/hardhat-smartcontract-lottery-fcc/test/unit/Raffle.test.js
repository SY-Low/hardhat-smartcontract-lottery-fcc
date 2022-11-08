/**
 * steps to write code: Contract script > Deployment script (localhost/testnet) > verify your deployment > test
 * Only do unit test on development chains
 */

const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat-config");
const { developmentChains } = require("../../helper-hardhat-config");

//If development chain then test, else skip test
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test", async function () {
      let raffle,
        raffleContract,
        vrfCoordinatorV2Mock,
        raffleEntranceFee,
        //deployer,
        player,
        interval;
      const chainId = network.config.chainId;

      // pre-requisite before each test below
      beforeEach(async function () {
        //deployer = await getNamedAccounts().deployer; // from hardhat.config.js: as we hardcode to 0 & player = 1, it's better we use getSigner to get list of account in current node
        accounts = await ethers.getSigners();
        deployer = accounts[0]; // defined first signer as the deployer, second as the player
        player = accounts[1];

        await deployments.fixture(["all"]); //deploy everything: under both deploy js module.exports
        raffleContract = await ethers.getContract("Raffle", deployer); // connect the contract Raffle to the deployer
        raffle = raffleContract.connect(player); // **Returns new instance of Raffle Contract connected to player

        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        raffleEntranceFee = await raffle.getEntranceFee(); // after connect with player only get remaining properties
        interval = await raffle.getInterval();
      });

      // test for each function call in the contract Raffle
      // fist test: for describe code snippet, async keyword do not make differences for the function hence not necessary
      describe("constructor", function () {
        it("initializes the raffle correctly", async function () {
          //Ideally we make our tests have just 1 assert per "it" block
          const raffleState = await raffle.getRaffleState(); // return big number
          //const interval = await raffle.getInterval();

          assert.equal(raffleState.toString(), "0"); //Open - stringify it
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      // second test
      describe("enterRaffle", function () {
        it("reverts when you don't pay enough entrance fee", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughETH"
          );
        });

        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, player.address);
        });

        it("emit event on enter", async function () {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "RaffleEnter"); // test to expect  emit event "RaffleEnter"
        });

        it("doesnt allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });

          //hardhat network references
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]); // to by pass the block interval time when we are testing: to get the checkUpKeep return true to proceed perfromUpKeep

          await network.provider.request({ method: "evm_mine", params: [] }); // manually mine new block using this RPC method

          // we pretend to be a Chainlink keeper for a second
          await raffle.performUpkeep([]); // changes the state to calculating for our comparison below

          // because the raffleState will be update to CALCULATING when we enter performUpKeep function
          // so when enterRaffle, the status is expecting to be OPEN but not CALCULATING, if status is CALCULATING, shall revert the error
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith(
            // is reverted as raffle is calculating
            "Raffle__NotOpen"
          );
        });
      });

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          //await network.provider.request({ method: "evm_mine", params: [] });
          // or
          await network.provider.send("evm_mine", []);
          // callStatic used to simulate the function instead of trigger the transaction during test
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          //expect upkeepNeeded is false when the interval is over == timePassed
          assert(!upkeepNeeded); // expect to return "not false" === TRUE
        });

        it("return false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] }); // manually mine new block using this RPC method
          await raffle.performUpkeep([]); // changes the state to calculating for our comparison below

          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)

          assert.notEqual(raffleState.toString(), "0");
          assert.equal(upkeepNeeded, false);
          // assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("it can only run if checkupkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []); // use send or request also can
          const tx = await raffle.performUpkeep("0x"); // or put [] also can, check if moved to next block should be return TRUE
          assert(tx);
        });

        it("reverts when checkupkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded" // can write more specific test for each vairables (balance etc)
          );
        });

        it("updates the raffle state and emits a requestId, and calls the vrf coordinator", async () => {
          // Too many asserts in this test!
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x"); // emits requestId
          const txReceipt = await txResponse.wait(1); // waits 1 block
          const raffleState = await raffle.getRaffleState(); // updates state
          //it's going to be first event after the i_vrfCoordinator.requestRandomWords is triggered
          const requestId = txReceipt.events[1].args.requestId; //under VRFCoordinatorV2Mocks it did return request Id under mocks/VRFCoordinatorV2Mock.sol (i_vrf_Coordinator)
          assert(requestId.toNumber() > 0);
          assert(raffleState == 1); // 0 = open, 1 = calculating
        });
      });

      describe("fulfillRandomWords", function () {
        // run before each to get the initial repeated steps (need to have someone enter the raffle first)
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled: refer to V2Mock.sol, this function require requestId, consumer address
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
        });

        // This test is too big...
        // This test simulates users entering the raffle and wraps the entire functionality of the raffle
        // inside a promise that will resolve if everything is successful.
        // An event listener for the WinnerPicked is set up
        // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
        // All the assertions are done once the WinnerPicked event is fired
        it("picks a winner, resets the lottery, and sends money", async () => {
          const additionalEntrances = 3; // fake account to test, so total we have 4 players
          const startingIndex = 1; // deployer = 0, so player start at 1, we skip the 1st player defined on top to ensure winner is player[2]
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            // connect additional 3 player into the raffle
            // i = 2; i < 5; i=i+1
            raffle = raffleContract.connect(accounts[i]); // Returns a new instance of the Raffle contract connected to player
            await raffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLatestTime(); // stores starting timestamp (before we fire our event)

          /**
           * performUpkeep (mock being chainlink keepers)
           * fulfillRandomWords (mock being the Chainlink VRF)
           * we will have to wait for the fulfillRandomWords to be called
           * create a new Promise, listener to simulate the actual scenario (winner wait to be draw)
           */

          // This will be more important for our staging tests...
          await new Promise(async (resolve, reject) => {
            //listen for the WinnerPicked event emitted
            raffle.once("WinnerPicked", async () => {
              // Setting up the listener => event listener for WinnerPicked:

              //below, we will fire the event, and the listener will pick it up, and resolve
              console.log("WinnerPicked event fired!");
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event
              // if it fails.

              try {
                // Now lets get the ending values...
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerBalance = await accounts[1].getBalance();
                const endingTimeStamp = await raffle.getLatestTime();
                const numPlayers = await raffle.getNumberOfPlayers();

                console.log("Recent Winner: " + recentWinner);
                console.log(accounts[0].address);
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);

                await expect(raffle.getPlayer(0)).to.be.reverted;
                // Comparisons to check if our ending values are correct:
                assert.equal(recentWinner.toString(), accounts[1].address);
                assert.equal(numPlayers.toString(), "0"); // once winner pick, the player pool will be reset to 0
                assert.equal(raffleState, 0); // raffle state will be reopen
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(
                      raffleEntranceFee
                        .mul(additionalEntrances)
                        .add(raffleEntranceFee)
                    )
                    .toString()
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve(); // if try passes, resolves the promise
              } catch (e) {
                reject(e); // if try fails, rejects the promise
              }
            });

            // code below kicking off the Promise snippet on top: for mock only, else this section is to be using real chainlnk keeper & vrfcoordinator
            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            const tx = await raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const startingBalance = await accounts[1].getBalance(); //before we call fulfillRandomWords function, set the starting balance
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
