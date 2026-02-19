#!/usr/bin/env tsx
/**
 * Sign Message Script
 * 
 * Usage:
 *   pnpm tsx scripts/sign-message.ts <private_key> <message>
 * 
 * Or with environment variables:
 *   PRIVATE_KEY=0x... MESSAGE="Sign this..." pnpm tsx scripts/sign-message.ts
 * 
 * Example:
 *   pnpm tsx scripts/sign-message.ts \
 *     0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97 \
 *     "Sign this message to authenticate with OpenSight\nNonce: abc123"
 */

import { ethers } from "ethers";

async function main() {
  // Get inputs from args or environment
  const privateKey = process.argv[2] || process.env.PRIVATE_KEY;
  const message = process.argv[3] || process.env.MESSAGE;

  // Validate inputs
  if (!privateKey) {
    console.error("❌ Error: Private key required");
    console.error("\nUsage:");
    console.error("  pnpm tsx scripts/sign-message.ts <private_key> <message>");
    console.error("\nOr with environment variables:");
    console.error("  PRIVATE_KEY=0x... MESSAGE=\"...\" pnpm tsx scripts/sign-message.ts");
    process.exit(1);
  }

  if (!message) {
    console.error("❌ Error: Message required");
    console.error("\nUsage:");
    console.error("  pnpm tsx scripts/sign-message.ts <private_key> <message>");
    process.exit(1);
  }

  // Validate private key format
  if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
    console.error("❌ Error: Invalid private key format");
    console.error("   Expected: 0x followed by 64 hex characters");
    console.error("   Example:  0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97");
    process.exit(1);
  }

  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    
    // Sign the message
    const signature = await wallet.signMessage(message);
    
    // Output results
    console.log("\n✅ Message signed successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Wallet Address:   ", wallet.address);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📄 Message:");
    console.log(message);
    console.log("\n✍️  Signature:");
    console.log(signature);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📋 Copy the signature above for your API request");
    console.log("\nExample API call:");
    console.log(`  curl -X POST http://localhost:3001/auth/web3/verify \\\n    -H "Content-Type: application/json" \\\n    -d '{
      "nonceId": "your_nonce_id",
      "walletAddress": "${wallet.address.toLowerCase()}",
      "signature": "${signature}"
    }'`);
    console.log();

  } catch (error) {
    console.error("❌ Error signing message:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
