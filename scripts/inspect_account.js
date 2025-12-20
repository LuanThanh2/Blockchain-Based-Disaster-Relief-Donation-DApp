const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();

  const [balanceWei, nonce, code, block] = await Promise.all([
    hre.ethers.provider.getBalance(address),
    hre.ethers.provider.getTransactionCount(address),
    hre.ethers.provider.getCode(address),
    hre.ethers.provider.getBlockNumber(),
  ]);

  const balanceEth = hre.ethers.formatEther(balanceWei);
  const codeBytes = Math.max(0, (code.length - 2) / 2);

  console.log("Network:", hre.network.name);
  console.log("Latest block:", block);
  console.log("Address:", address);
  console.log("Balance (ETH):", balanceEth);
  console.log("Nonce:", nonce);
  console.log("Has contract code:", code !== "0x");
  console.log("Code size (bytes):", codeBytes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
