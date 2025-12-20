const hre = require("hardhat");

async function main() {
  const DisasterFund = await hre.ethers.getContractFactory("DisasterFund");
  const fund = await DisasterFund.deploy();
  await fund.waitForDeployment();

  console.log("DisasterFund deployed to:", await fund.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
