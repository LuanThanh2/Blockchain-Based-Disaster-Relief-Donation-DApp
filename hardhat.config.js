require("@nomicfoundation/hardhat-toolbox");

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });
dotenv.config({ path: path.join(__dirname, "backend", ".env"), override: true });

function normalizeAmoyRpcUrl(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (/YOUR_KEY|YOUR_API_KEY|<redacted>/i.test(trimmed)) return "";
  return trimmed;
}

const amoyUrl =
  normalizeAmoyRpcUrl(process.env.AMOY_RPC_URL || process.env.RPC_URL) ||
  "https://rpc-amoy.polygon.technology";
const sepoliaUrl =
  normalizeAmoyRpcUrl(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL) ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const deployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
const expectedDeployerAddress = process.env.EXPECTED_DEPLOYER_ADDRESS;

function normalizePrivateKey(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (trimmed.startsWith("0x")) return trimmed;
  // Allow 64-hex keys without 0x prefix (common when copy/pasting)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Missing ${name}. Set it in E:\\Disaster_Relief_Dapp\\.env (or backend\\.env) as KEY=value (no spaces around '=').`
    );
  }
}

function assertPrivateKey(value, name) {
  assertNonEmptyString(value, name);
  const normalized = normalizePrivateKey(value);
  if (!normalized.startsWith("0x") || normalized.length !== 66) {
    throw new Error(
      `${name} must be a 32-byte hex private key with 0x prefix (length 66).`
    );
  }
}

assertNonEmptyString(amoyUrl, "AMOY_RPC_URL (or RPC_URL)");
assertPrivateKey(deployerPrivateKey, "DEPLOYER_PRIVATE_KEY (or PRIVATE_KEY)");

const normalizedDeployerPrivateKey = normalizePrivateKey(deployerPrivateKey);

if (typeof expectedDeployerAddress === "string" && expectedDeployerAddress.trim()) {
  const { Wallet } = require("ethers");
  const derived = new Wallet(normalizedDeployerPrivateKey).address;
  const expected = expectedDeployerAddress.trim();
  console.log(
    "[hardhat] expected deployer:",
    `${expected.slice(0, 6)}...${expected.slice(-4)}`
  );
  console.log(
    "[hardhat] derived deployer:",
    `${derived.slice(0, 6)}...${derived.slice(-4)}`
  );
  if (derived.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      [
        "Deployer private key does NOT match EXPECTED_DEPLOYER_ADDRESS.",
        `  derived:  ${derived}`,
        `  expected: ${expected}`,
        "Fix E:\\Disaster_Relief_Dapp\\.env DEPLOYER_PRIVATE_KEY to the key for the expected address.",
      ].join("\n")
    );
  }
}

try {
  const u = new URL(amoyUrl);
  console.log("[hardhat] amoy rpc host:", u.host);
} catch {
  console.log("[hardhat] amoy rpc host: <invalid url>");
}

try {
  const u = new URL(sepoliaUrl);
  console.log("[hardhat] sepolia rpc host:", u.host);
} catch {
  console.log("[hardhat] sepolia rpc host: <invalid url>");
}

module.exports = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      url: amoyUrl,
      accounts: [normalizedDeployerPrivateKey],
      chainId: 80002,
    },
    sepolia: {
      url: sepoliaUrl,
      accounts: [normalizedDeployerPrivateKey],
      chainId: 11155111,
    },
  },
};