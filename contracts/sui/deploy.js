const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deploySuiContract() {
    console.log('🚀 Starting Sui NFT Contract Deployment to Testnet...\n');

    try {
        // Check if Sui CLI is installed
        console.log('📋 Checking Sui CLI installation...');
        try {
            execSync('sui --version', { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ Sui CLI not found. Please install Sui CLI first.');
            console.log('Install from: https://docs.sui.io/guides/developer/getting-started/sui-install');
            process.exit(1);
        }

        // Check Sui client status
        console.log('\n📋 Checking Sui client configuration...');
        try {
            execSync('sui client active-env', { stdio: 'inherit' });
        } catch (error) {
            console.log('⚠️  Setting up Sui client for testnet...');
            execSync('sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443', { stdio: 'inherit' });
            execSync('sui client switch --env testnet', { stdio: 'inherit' });
        }

        // Check if we have a wallet address
        console.log('\n💰 Checking wallet configuration...');
        try {
            const activeAddress = execSync('sui client active-address', { encoding: 'utf8' });
            console.log(`📋 Active address: ${activeAddress.trim()}`);
        } catch (error) {
            console.log('⚠️  Creating new wallet address...');
            execSync('sui client new-address ed25519', { stdio: 'inherit' });
        }

        // Request testnet tokens
        console.log('\n💰 Requesting testnet SUI tokens...');
        try {
            execSync('sui client faucet', { stdio: 'inherit' });
            console.log('✅ Testnet tokens requested successfully');
        } catch (error) {
            console.log('⚠️  Faucet request failed, continuing with deployment...');
        }

        // Build the contract
        console.log('\n🔨 Building Sui Move contract...');
        execSync('sui move build', { stdio: 'inherit', cwd: __dirname });

        // Deploy the contract
        console.log('\n🚀 Deploying to Sui Testnet...');
        const deployOutput = execSync('sui client publish --gas-budget 100000000', { 
            encoding: 'utf8',
            cwd: __dirname 
        });

        console.log('📋 Deployment output:');
        console.log(deployOutput);

        // Parse deployment output to extract package ID
        const packageIdMatch = deployOutput.match(/Package ID: (0x[a-fA-F0-9]+)/);
        const packageId = packageIdMatch ? packageIdMatch[1] : null;

        if (packageId) {
            console.log('\n✅ Sui NFT Contract Deployment Complete!');
            console.log(`📋 Package ID: ${packageId}`);
            console.log(`🌐 Network: Testnet`);
            console.log(`🔗 Explorer: https://suiexplorer.com/object/${packageId}?network=testnet`);
            
            // Update environment variables
            console.log('\n📝 Please update your .env file with:');
            console.log(`VITE_SUI_NFT_PACKAGE_ID=${packageId}`);
            console.log(`VITE_SUI_NETWORK=testnet`);

            return {
                packageId,
                network: 'testnet',
                explorerUrl: `https://suiexplorer.com/object/${packageId}?network=testnet`
            };
        } else {
            throw new Error('Could not extract package ID from deployment output');
        }

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.log('\n📋 Troubleshooting tips:');
        console.log('1. Make sure Sui CLI is installed: https://docs.sui.io/guides/developer/getting-started/sui-install');
        console.log('2. Ensure you have testnet SUI tokens');
        console.log('3. Check your internet connection');
        console.log('4. Verify Move.toml configuration');
        process.exit(1);
    }
}

// Run deployment if called directly
if (require.main === module) {
    deploySuiContract()
        .then((result) => {
            console.log('\n🎉 Deployment successful!', result);
        })
        .catch((error) => {
            console.error('❌ Deployment error:', error);
            process.exit(1);
        });
}

module.exports = { deploySuiContract };
