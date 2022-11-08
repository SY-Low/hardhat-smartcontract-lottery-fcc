// Raffle

// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completely automated

// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keeper)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
// KeeperCompatible.sol imports the functions from both ./KeeperBase.sol and
// ./interfaces/KeeperCompatibleInterface.sol

error Raffle__NotEnoughETH();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
); //Variables to display error message

/** @title A sample Raffle Contract
 *  @author
 *  @notice This cotnract is for creating a untamperable decentralize smart contracct
 *  @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /*Type declarations -enums*/
    enum RaffleState {
        OPEN,
        CALCULATING
    } // indirectly we are creating uint256 0=OPEN, 1=CALCULATING

    /*State Variables*/
    uint256 private immutable i_entranceFee; // change to immutable to save some gas
    address payable[] private s_players; //we need to pay the players if he win, hence the keyword payable.abi
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    //Lottery Variables;
    address private s_recentWinner;
    //uint256 private s_state; // pending, open, closed, calculating
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /*Events*/
    event RaffleEnter(address indexed player); // index parameters == topics (searchable)
    event RaffleWinnerRequested(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    //let the entraceFee be configurable
    constructor(
        address vrfCoordinatorV2, //contract
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval // value to be passed in to start the lottery
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp; //update last block timestamp = current timestamp, when enter the block
        i_interval = interval;
    }

    function enterRaffle() public payable {
        //we allow everyone to enter our Raffle hence public payable
        //more gas efficient when we use error code compare to text string
        // require(msg.value > i_entraceFee, "Not Enough ETH!" );
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETH();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender)); //we outcast the sender address to be payable address into the array

        //Events: Emit an event when we update a dynamic array or mapping (listening to offchain/onchain transaction - important for FE)
        //Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev this is the function that the Chainlink Keeper nodes call
     * they look for the 'upkeepNeeded' to return true
     * The following should be true in order to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player, and have some ETH (balance)
     * 3. Our subsription is funded with LINK
     * 4. The lottery should be in an "open" state.
     */
    function checkUpkeep(bytes memory)
        public
        override
        returns (
            //calldata /*performData*/
            bool upkeepNeeded,
            bytes memory /*performData*/
        )
    {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        // return current timestamp of the block =>
        // block.timestamp - last block timestamp > interval to wait before the lottery run
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    // this function will be automatically called after checkUpkeep is true
    function performUpkeep(
        bytes calldata /*performData*/
    ) external {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance, // balance of this contract
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        //Request the random number
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        //Once we get it, do something with it: this emit event is redundant!
        emit RaffleWinnerRequested(requestId);
        //chainlink VRF require 2 transaction process (request & Response)
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        //pick random winner using mod function from s_player array
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN; //Reopen the Raffle State after fullfilled the random word
        s_players = new address payable[](0); //Reset the list of player after winner picked
        s_lastTimeStamp = block.timestamp; // Reset the timestamp once winner picked so that other player can join to start a new lottery (start another interval)
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        //require success
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /*View / Pure functions*/
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTime() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
