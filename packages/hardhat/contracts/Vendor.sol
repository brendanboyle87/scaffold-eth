pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./YourToken.sol";
import "hardhat/console.sol";

contract Vendor is Ownable {

  uint256 public constant tokensPerEth = 100;

  event BuyTokens(address buyer, uint256 amountOfETH, uint256 amountOfTokens);

  
  event SellTokens(address seller, uint256 amountOfETH, uint256 amountOfTokens);


  YourToken yourToken;

  constructor(address tokenAddress) public {
    yourToken = YourToken(tokenAddress);
  }

  function buyTokens() public payable returns (uint256 tokenAmount) {
    require(msg.value > 0, "Need to send ETH to buy tokens");

    uint256 amountToBuy = msg.value * tokensPerEth;
    uint256 vendorBalance = yourToken.balanceOf(address(this));
    require(vendorBalance >= amountToBuy, "Vendor does not have enough tokens");
      
    (bool sent) = yourToken.transfer(msg.sender, amountToBuy);
    require(sent, "Failed to transfer token to user");

    BuyTokens(msg.sender, msg.value, amountToBuy);

    return amountToBuy;
  }

  function sellTokens(uint256 tokenAmountToSell) public {
    require(tokenAmountToSell > 0, "Please provide a token amount to sell");

    uint256 userBalance = yourToken.balanceOf(msg.sender);
    require(userBalance >= tokenAmountToSell, "You do not have enough tokens to sell");
    uint256 ethForTokens = tokenAmountToSell / tokensPerEth;

    require(address(this).balance >= ethForTokens, "Vendor does not have enough ETH to buy tokens");

    (bool sent) = yourToken.transferFrom(msg.sender, address(this), tokenAmountToSell);
    require(sent, "Failed to transfer token to vendor");

    (sent,) = msg.sender.call{value: ethForTokens}("");
    require(sent, "Failed to send ether to user");

    SellTokens(msg.sender, ethForTokens, tokenAmountToSell);
  }

    function withdraw() public onlyOwner {
    uint256 ownerBalance = address(this).balance;
    require(ownerBalance > 0, "Owner has not balance to withdraw");

    (bool sent,) = msg.sender.call{value: address(this).balance}("");
    require(sent, "Failed to send user balance back to the owner");
  }
}
