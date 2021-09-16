pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "./ExampleExternalContract.sol";
//import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract YourContract {

 mapping(address => uint256) public balances;

 uint256 public constant threshold = 1 ether;

 event Stake(address indexed sender, uint256 amount);

  constructor() {
  }

 function stake() public payable {
   balances[msg.sender] += msg.value;

   emit Stake(msg.sender, msg.value);
 }
}
