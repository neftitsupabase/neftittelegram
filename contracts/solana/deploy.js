const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deploySolanaProgram() {
    console.log('🚀 Starting Solana NFT Program Deployment to Devnet...\n');

    try {
        // Check if Solana CLI is installed
        console.log('📋 Checking Solana CLI installation...');
        try {
            execSync('solana --version', { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ Solana CLI not found. Please install Solana CLI first.');
            console.log('Install from: https://docs.solana.com/cli/install-solana-cli-tools');
            process.exit(1);
        }

        // Check if Anchor CLI is installed
        console.log('\n📋 Checking Anchor CLI installation...');
        try {
            execSync('anchor --version', { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ Anchor CLI not found. Please install Anchor CLI first.');
            console.log('Install from: https://www.anchor-lang.com/docs/installation');
            process.exit(1);
        }

        // Set Solana config to devnet
        console.log('\n🌐 Setting Solana cluster to devnet...');
        execSync('solana config set --url devnet', { stdio: 'inherit' });

        // Check wallet balance
        console.log('\n💰 Checking wallet balance...');
        try {
            execSync('solana balance', { stdio: 'inherit' });
        } catch (error) {
            console.log('⚠️  Low balance detected. Requesting airdrop...');
            execSync('solana airdrop 2', { stdio: 'inherit' });
        }

        // Build the program
        console.log('\n🔨 Building Anchor program...');
        execSync('anchor build', { stdio: 'inherit', cwd: __dirname });

        // Get the program ID
        console.log('\n🔍 Getting program ID...');
        const programIdOutput = execSync('solana-keygen pubkey target/deploy/neftit_nft-keypair.json', { 
            encoding: 'utf8',
            cwd: __dirname 
        });
        const programId = programIdOutput.trim();
        console.log(`📋 Program ID: ${programId}`);

        // Update Anchor.toml with the correct program ID
        console.log('\n📝 Updating Anchor.toml with program ID...');
        const anchorTomlPath = path.join(__dirname, 'Anchor.toml');
        let anchorToml = fs.readFileSync(anchorTomlPath, 'utf8');
        anchorToml = anchorToml.replace(
            /neftit_nft = ".*"/,
            `neftit_nft = "${programId}"`
        );
        fs.writeFileSync(anchorTomlPath, anchorToml);

        // Update lib.rs with the correct program ID
        console.log('📝 Updating lib.rs with program ID...');
        const libRsPath = path.join(__dirname, 'programs/neftit-nft/src/lib.rs');
        let libRs = fs.readFileSync(libRsPath, 'utf8');
        libRs = libRs.replace(
            /declare_id!\(".*"\);/,
            `declare_id!("${programId}");`
        );
        fs.writeFileSync(libRsPath, libRs);

        // Rebuild with correct program ID
        console.log('\n🔨 Rebuilding with correct program ID...');
        execSync('anchor build', { stdio: 'inherit', cwd: __dirname });

        // Deploy the program
        console.log('\n🚀 Deploying to Solana Devnet...');
        execSync('anchor deploy', { stdio: 'inherit', cwd: __dirname });

        // Initialize the program
        console.log('\n⚡ Initializing program...');
        try {
            execSync('anchor run initialize', { stdio: 'inherit', cwd: __dirname });
        } catch (error) {
            console.log('⚠️  Initialize script not found, skipping initialization...');
        }

        console.log('\n✅ Solana NFT Program Deployment Complete!');
        console.log(`📋 Program ID: ${programId}`);
        console.log(`🌐 Network: Devnet`);
        console.log(`🔗 Explorer: https://explorer.solana.com/address/${programId}?cluster=devnet`);
        
        // Update environment variables
        console.log('\n📝 Please update your .env file with:');
        console.log(`VITE_SOLANA_NFT_PROGRAM_ID=${programId}`);
        console.log(`VITE_SOLANA_NETWORK=devnet`);

        return {
            programId,
            network: 'devnet',
            explorerUrl: `https://explorer.solana.com/address/${programId}?cluster=devnet`
        };

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run deployment if called directly
if (require.main === module) {
    deploySolanaProgram()
        .then((result) => {
            console.log('\n🎉 Deployment successful!', result);
        })
        .catch((error) => {
            console.error('❌ Deployment error:', error);
            process.exit(1);
        });
}

module.exports = { deploySolanaProgram };
