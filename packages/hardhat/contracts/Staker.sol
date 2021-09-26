pragma solidity >=0.6.0 <0.7.0;

import "hardhat/console.sol";
import "./ExampleExternalContract.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract Staker {
    mapping(address => uint256) public balances;

    uint256 public constant threshold = 1 ether;

    event Stake(address indexed sender, uint256 amount);

    event Withdraw(address indexed sender, uint256 amount);

    uint256 public deadline = block.timestamp + 5 days;

    modifier deadlineReached(bool requireReached) {
        uint256 timeRemaining = timeLeft();
        if (requireReached) {
            require(timeRemaining == 0, "Deadline is not reached yet.");
        } else {
            require(timeRemaining > 0, "Deadline already reached.");
        }
        _;
    }

    modifier externalContractNotCompleted() {
        bool completed = exampleExternalContract.completed();
        require(!completed, "staking process already completed");
        _;
    }

    ExampleExternalContract public exampleExternalContract;

    constructor(address exampleExternalContractAddress) public {
        exampleExternalContract = ExampleExternalContract(
            exampleExternalContractAddress
        );
    }

    function stake()
        public
        payable
        deadlineReached(false)
        externalContractNotCompleted()
    {
        balances[msg.sender] += msg.value;

        emit Stake(msg.sender, msg.value);
    }

    // After some `deadline` allow anyone to call an `execute()` function
    //  It should either call `exampleExternalContract.complete{value: address(this).balance}()` to send all the value
    function execute()
        public
        deadlineReached(false)
        externalContractNotCompleted()
    {
        uint256 balance = address(this).balance;

        require(balance >= threshold, "Threshold not met");

        (bool sent, ) = address(exampleExternalContract).call{value: balance}(
            abi.encodeWithSignature("complete()")
        );
        require(sent, "exampleExternalContract.complete failed");
    }

    // if the `threshold` was not met, allow everyone to call a `withdraw()` function
    function withdraw()
        public
        deadlineReached(true)
        externalContractNotCompleted()
    {
        uint256 userBalance = balances[msg.sender];

        require(userBalance > 0, "You do not have a balance.");

        balances[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: userBalance}("");
        require(sent, "Failed to send user balance back.");
        emit Withdraw(msg.sender, userBalance);
    }

    // Add a `timeLeft()` view function that returns the time left before the deadline for the frontend
    function timeLeft() public view returns (uint256 timeRemaining) {
        if (block.timestamp >= deadline) {
            return 0;
        } else {
            return deadline - block.timestamp;
        }
    }
}
