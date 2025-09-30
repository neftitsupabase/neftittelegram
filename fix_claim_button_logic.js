// Fix for Claim Rewards Button Logic Bug
// Issue: Both NFT and Token sections use total_pending_rewards instead of section-specific rewards

const fs = require('fs');
const path = require('path');

const stakingPagePath = path.join(__dirname, 'src', 'pages', 'Staking.tsx');

// Read the file
let content = fs.readFileSync(stakingPagePath, 'utf8');

// Fix NFT section button (first occurrence)
content = content.replace(
  /disabled={stakingSummary\.total_pending_rewards <= 0 \|\| isLoadingStaking \|\| isClaiming}/,
  'disabled={stakingSummary.nft_pending_rewards <= 0.1 || isLoadingStaking || isClaiming}'
);

content = content.replace(
  /stakingSummary\.total_pending_rewards <= 0 \? \(\s*'No Rewards'/,
  "stakingSummary.nft_pending_rewards <= 0 ? (\n            'No NFT Rewards'"
);

content = content.replace(
  /`Claim \${stakingSummary\.total_pending_rewards\.toFixed\(2\)} NEFT`/,
  '`Claim ${stakingSummary.nft_pending_rewards.toFixed(2)} NEFT`'
);

// Fix Token section button (second occurrence)
// We need to be more specific for the token section
const tokenSectionRegex = /Your Staked Tokens[\s\S]*?disabled={stakingSummary\.total_pending_rewards <= 0 \|\| isLoadingStaking \|\| isClaiming}/;
content = content.replace(
  tokenSectionRegex,
  (match) => match.replace(
    'disabled={stakingSummary.total_pending_rewards <= 0 || isLoadingStaking || isClaiming}',
    'disabled={stakingSummary.token_pending_rewards <= 0 || isLoadingStaking || isClaiming}'
  )
);

// Fix token section button text
const tokenButtonTextRegex = /Your Staked Tokens[\s\S]*?stakingSummary\.total_pending_rewards <= 0 \? \(\s*'No Rewards'/;
content = content.replace(
  tokenButtonTextRegex,
  (match) => match.replace(
    "stakingSummary.total_pending_rewards <= 0 ? (\n            'No Rewards'",
    "stakingSummary.token_pending_rewards <= 0 ? (\n            'No Token Rewards'"
  )
);

// Fix token section claim amount
const tokenClaimAmountRegex = /Your Staked Tokens[\s\S]*?`Claim \${stakingSummary\.total_pending_rewards\.toFixed\(2\)} NEFT`/;
content = content.replace(
  tokenClaimAmountRegex,
  (match) => match.replace(
    '`Claim ${stakingSummary.total_pending_rewards.toFixed(2)} NEFT`',
    '`Claim ${stakingSummary.token_pending_rewards.toFixed(2)} NEFT`'
  )
);

// Write the fixed content back
fs.writeFileSync(stakingPagePath, content, 'utf8');

console.log('✅ Fixed claim rewards button logic!');
console.log('Changes made:');
console.log('1. NFT section now uses stakingSummary.nft_pending_rewards');
console.log('2. Token section now uses stakingSummary.token_pending_rewards');
console.log('3. Button text updated to be section-specific');
