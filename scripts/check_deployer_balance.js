const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  const balanceWei = await hre.ethers.provider.getBalance(address);
  const balanceEth = hre.ethers.formatEther(balanceWei);

  console.log("Deployer address:", address);
  console.log("Balance (ETH):", balanceEth);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
