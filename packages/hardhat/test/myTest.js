/* eslint-disable prettier/prettier */
const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

// Utilities methods
const increaseWorldTimeInSeconds = async (seconds, mine = false) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  if (mine) {
    await ethers.provider.send("evm_mine", []);
  }
};

describe("Staker App", () => {
  let addr1;

  let stakerContract;
  let exampleExternalContract;
  let ExampleExternalContractFactory;

  beforeEach(async () => {
    // Deploy ExampleExternalContract contract
    ExampleExternalContractFactory = await ethers.getContractFactory(
      "ExampleExternalContract"
    );
    exampleExternalContract = await ExampleExternalContractFactory.deploy();

    // Deploy Staker Contract
    const StakerContract = await ethers.getContractFactory("Staker");
    stakerContract = await StakerContract.deploy(
      exampleExternalContract.address
    );

    // eslint-disable-next-line no-unused-vars
    [addr1] = await ethers.getSigners();
  });

  describe("timeLeft", () => {
    it("returns 0 if the deadline has passed", async () => {
      await increaseWorldTimeInSeconds(180, true);

      const timeLeft = await stakerContract.timeLeft();
      expect(timeLeft).to.equal(0);
    });

    it("returns the deadline - the blocktimestamp if there is time left", async () => {
      const secondElapsed = 10;
      const timeLeftBefore = await stakerContract.timeLeft();
      await increaseWorldTimeInSeconds(secondElapsed, true);

      const timeLeftAfter = await stakerContract.timeLeft();
      expect(timeLeftAfter).to.equal(timeLeftBefore.sub(secondElapsed));
    });
  });

  describe("stake", () => {
    it("stakes the provided ETH in the external contract, updates the balances and emits a staking event", async () => {
      const amount = ethers.utils.parseEther("0.5");

      await expect(
        stakerContract.connect(addr1).stake({
          value: amount,
        })
      )
        .to.emit(stakerContract, "Stake")
        .withArgs(addr1.address, amount);

      expect(await ethers.provider.getBalance(stakerContract.address)).to.equal(
        amount
      );

      expect(await stakerContract.balances(addr1.address)).to.equal(amount);
    });

    it("reverts if the deadline is reached", async () => {
      await increaseWorldTimeInSeconds(180, true);
      const amount = ethers.utils.parseEther("0.5");
      await expect(
        stakerContract.connect(addr1).stake({ value: amount })
      ).to.be.revertedWith("Deadline already reached.");
    });

    it("reverts if the staking contract is executed", async () => {
      const amount = ethers.utils.parseEther("1");
      // Complete the stake process
      const txStake = await await stakerContract.connect(addr1).stake({
        value: amount,
      });
      await txStake.wait();

      // execute it
      const txExecute = await stakerContract.connect(addr1).execute();
      await txExecute.wait();
      await expect(
        stakerContract.connect(addr1).stake({ value: amount })
      ).to.be.revertedWith("staking process already completed");
    });
  });

  describe("execute", () => {
    it("sends the staked funds to the external contract", async () => {
      const amount = ethers.utils.parseEther("1");
      await stakerContract.connect(addr1).stake({
        value: amount,
      });
      await stakerContract.connect(addr1).execute();

      const completed = await exampleExternalContract.completed();
      expect(completed).to.equal(true);

      // check that the external contract has the staked amount in it's balance
      const externalContractBalance = await ethers.provider.getBalance(
        exampleExternalContract.address
      );
      expect(externalContractBalance).to.equal(amount);

      // check that the staking contract has 0 balance
      const contractBalance = await ethers.provider.getBalance(
        stakerContract.address
      );
      expect(contractBalance).to.equal(0);
    });

    it("reverts if the threshold is not met", async () => {
      await expect(stakerContract.connect(addr1).execute()).to.be.revertedWith(
        "Threshold not met"
      );
    });

    it("reverts if the contract is already executed", async () => {
      const amount = ethers.utils.parseEther("1");
      await stakerContract.connect(addr1).stake({
        value: amount,
      });
      await stakerContract.connect(addr1).execute();

      await expect(stakerContract.connect(addr1).execute()).to.be.revertedWith(
        "staking process already completed"
      );
    });

    it("reverts if the deadline is reached", async () => {
      await increaseWorldTimeInSeconds(180, true);
      await expect(stakerContract.connect(addr1).execute()).to.be.revertedWith(
        "Deadline already reached."
      );
    });
  });

  describe("withdraw", () => {
    it("Withdraw reverted if deadline is not reached", async () => {
      await expect(stakerContract.connect(addr1).withdraw()).to.be.revertedWith(
        "Deadline is not reached yet"
      );
    });

    it("Withdraw reverted if external contract is completed", async () => {
      // Complete the stake process
      const txStake = await stakerContract.connect(addr1).stake({
        value: ethers.utils.parseEther("1"),
      });
      await txStake.wait();

      // execute it
      const txExecute = await stakerContract.connect(addr1).execute();
      await txExecute.wait();

      // Let time pass
      await increaseWorldTimeInSeconds(180, true);

      await expect(stakerContract.connect(addr1).withdraw()).to.be.revertedWith(
        "staking process already completed"
      );
    });

    it("Withdraw reverted if address has no balance", async () => {
      // Let time pass
      await increaseWorldTimeInSeconds(180, true);

      await expect(stakerContract.connect(addr1).withdraw()).to.be.revertedWith(
        "You do not have a balance."
      );
    });

    it("Withdraw success!", async () => {
      // Complete the stake process
      const amount = ethers.utils.parseEther("1");
      const txStake = await stakerContract.connect(addr1).stake({
        value: amount,
      });
      await txStake.wait();

      // Let time pass
      await increaseWorldTimeInSeconds(180, true);

      const txWithdraw = await stakerContract.connect(addr1).withdraw();
      await txWithdraw.wait();

      // Check that the balance of the contract is 0
      const contractBalance = await ethers.provider.getBalance(
        stakerContract.address
      );
      expect(contractBalance).to.equal(0);

      // Check that the balance of the user is +1
      await expect(txWithdraw).to.changeEtherBalance(addr1, amount);
    });
  });
});
