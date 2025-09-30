const crypto = require('crypto');

// Function to convert address to proper EIP-55 checksum
function toChecksumAddress(address) {
  address = address.toLowerCase().replace('0x', '');
  const hash = crypto.createHash('keccak256').update(address).digest('hex');
  let checksumAddress = '0x';
  
  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += address[i].toUpperCase();
    } else {
      checksumAddress += address[i];
    }
  }
  
  return checksumAddress;
}

const originalAddress = '0x8A2d4C9B3E7F1a5b8c6d9e2f4a7b3c8d5e9f2a6b';
const checksummedAddress = toChecksumAddress(originalAddress);

console.log('Original:', originalAddress);
console.log('Checksummed:', checksummedAddress);

// Update .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

const lines = envContent.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('VITE_ETHEREUM_NFT_CONTRACT_ADDRESS=')) {
    lines[i] = `VITE_ETHEREUM_NFT_CONTRACT_ADDRESS=${checksummedAddress}`;
    break;
  }
}

fs.writeFileSync(envPath, lines.join('\n'));
console.log('✅ Updated .env with proper checksummed address');
