const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying NEFTIT NFT contract...");

  // Get the ContractFactory and Signers here.
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy the contract
  const NeftitNFT = await ethers.getContractFactory("NeftitNFT");
  const neftitNFT = await NeftitNFT.deploy();

  await neftitNFT.deployed();

  console.log("NeftitNFT deployed to:", neftitNFT.address);
  console.log("Transaction hash:", neftitNFT.deployTransaction.hash);

  // Verify contract on Etherscan (optional)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await neftitNFT.deployTransaction.wait(6);
    
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: neftitNFT.address,
        constructorArguments: [],
      });
    } catch (error) {
      console.log("Error verifying contract:", error.message);
    }
  }

  // Test minting functionality
  console.log("\nTesting mint functionality...");
  const testTokenURI = "https://nftstorage.link/ipfs/bafkreiabcdefghijklmnopqrstuvwxyz123456789";
  const testRarity = "common";
  
  const mintTx = await neftitNFT.mint(deployer.address, testTokenURI, testRarity);
  await mintTx.wait();
  
  console.log("Test NFT minted successfully!");
  console.log("Token ID:", await neftitNFT.getCurrentTokenId() - 1);
  
  return {
    contract: neftitNFT,
    address: neftitNFT.address,
    deployer: deployer.address
  };
}

main()
  .then((result) => {
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Contract Address:", result.address);
    console.log("Deployer Address:", result.deployer);
    console.log("Network:", network.name);
    console.log("==========================");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
