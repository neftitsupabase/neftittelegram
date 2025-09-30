import Web3 from 'web3';

async function checkContractPermissions() {
  try {
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const contractAddress = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
    const userAddress = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';

    // Basic ABI for permission checking
    const abi = [
      {'inputs':[],'name':'owner','outputs':[{'type':'address'}],'stateMutability':'view','type':'function'},
      {'inputs':[{'name':'role','type':'bytes32'},{'name':'account','type':'address'}],'name':'hasRole','outputs':[{'type':'bool'}],'stateMutability':'view','type':'function'},
      {'inputs':[],'name':'DEFAULT_ADMIN_ROLE','outputs':[{'type':'bytes32'}],'stateMutability':'view','type':'function'},
      {'inputs':[],'name':'MINTER_ROLE','outputs':[{'type':'bytes32'}],'stateMutability':'view','type':'function'}
    ];

    const contract = new web3.eth.Contract(abi, contractAddress);

    console.log('🔍 Checking contract permissions...');
    console.log('📋 Contract:', contractAddress);
    console.log('👤 User:', userAddress);
    console.log('');

    // Check owner
    try {
      const owner = await contract.methods.owner().call();
      console.log('👑 Contract owner:', owner);
      console.log('🔍 Is user owner?', owner.toLowerCase() === userAddress.toLowerCase());
    } catch (e) {
      console.log('❌ No owner() function or error:', e.message);
    }

    // Check DEFAULT_ADMIN_ROLE
    try {
      const DEFAULT_ADMIN_ROLE = await contract.methods.DEFAULT_ADMIN_ROLE().call();
      console.log('🔑 DEFAULT_ADMIN_ROLE:', DEFAULT_ADMIN_ROLE);
      
      const hasAdminRole = await contract.methods.hasRole(DEFAULT_ADMIN_ROLE, userAddress).call();
      console.log('✅ User has DEFAULT_ADMIN_ROLE:', hasAdminRole);
    } catch (e) {
      console.log('❌ No DEFAULT_ADMIN_ROLE or error:', e.message);
    }

    // Check MINTER_ROLE
    try {
      const MINTER_ROLE = await contract.methods.MINTER_ROLE().call();
      console.log('🔑 MINTER_ROLE:', MINTER_ROLE);
      
      const hasMinterRole = await contract.methods.hasRole(MINTER_ROLE, userAddress).call();
      console.log('✅ User has MINTER_ROLE:', hasMinterRole);
    } catch (e) {
      console.log('❌ No MINTER_ROLE or error:', e.message);
    }

  } catch (error) {
    console.error('❌ Error checking contract:', error.message);
  }
}

checkContractPermissions();
