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

const rpcUrl = normalizeAmoyRpcUrl(process.env.RPC_URL || "") || "";
const amoyUrl =
  normalizeAmoyRpcUrl(process.env.AMOY_RPC_URL) || rpcUrl ||
  "https://rpc-amoy.polygon.technology";
const sepoliaUrl =
  normalizeAmoyRpcUrl(process.env.SEPOLIA_RPC_URL) || rpcUrl ||
  "https://ethereum-sepolia-rpc.publicnode.com";

const deployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

function normalizePrivateKey(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (trimmed.startsWith("0x")) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Missing ${name}. Set it in E:\\Disaster_Relief_Dapp\\.env`
    );
  }
}

function assertPrivateKey(value, name) {
  assertNonEmptyString(value, name);
  const normalized = normalizePrivateKey(value);
  if (!normalized.startsWith("0x") || normalized.length !== 66) {
    throw new Error(`${name} must be a 32-byte hex private key`);
  }
}

assertNonEmptyString(amoyUrl, "AMOY_RPC_URL");

let normalizedDeployerPrivateKey = "";
if (deployerPrivateKey) {
  assertPrivateKey(deployerPrivateKey, "DEPLOYER_PRIVATE_KEY");
  normalizedDeployerPrivateKey = normalizePrivateKey(deployerPrivateKey);
}

// ========== CONFIG ==========
const config = {
  solidity: "0.8.28",

  networks: {
    hardhat: {
      chainId: 31337,
      host: "0.0.0.0",
      port: 30001,   
    },
  },
};

// Thêm mạng ngoài nếu có private key
if (normalizedDeployerPrivateKey) {
  config.networks.amoy = {
    url: amoyUrl,
    accounts: [normalizedDeployerPrivateKey],
    chainId: 80002,
  };

  config.networks.sepolia = {
    url: sepoliaUrl,
    accounts: [normalizedDeployerPrivateKey],
    chainId: 11155111,
  };
}

module.exports = config;
