const { Wallet } = require("ethers");

function normalizePrivateKey(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (trimmed.startsWith("0x")) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

function main() {
  const pkRaw = process.env.PK || process.argv[2];
  if (!pkRaw) {
    console.error("Usage: node scripts/print_address_from_pk.js <privateKey>  (or set env PK)");
    process.exit(1);
  }

  const pk = normalizePrivateKey(pkRaw);
  if (!pk.startsWith("0x") || pk.length !== 66) {
    console.error("Invalid private key format. Expected 64 hex chars (optionally with 0x prefix)." );
    process.exit(1);
  }

  const wallet = new Wallet(pk);
  console.log("Address:", wallet.address);
}

main();
