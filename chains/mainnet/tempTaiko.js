require('dotenv').config();
const { JsonRpcProvider } = require('ethers');

const rpcProviders = [
  new JsonRpcProvider('https://rpc.ankr.com/taiko'),
  new JsonRpcProvider('https://167000.rpc.thirdweb.com'),
  new JsonRpcProvider('https://taiko-mainnet.gateway.tenderly.co'),
  new JsonRpcProvider('https://taiko-rpc.publicnode.com'),
  new JsonRpcProvider('https://taiko-mainnet.rpc.porters.xyz/taiko-public'),
  new JsonRpcProvider('https://taiko.drpc.org'),
];

let currentRpcProviderIndex = 0;  
  
function provider() {  
  return rpcProviders[currentRpcProviderIndex];  
}  
  
function changeRpcProvider() {  
  currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;  
  return provider();  
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const baseExplorerUrl = 'https://taikoscan.net';
const explorer = {
  get tx() {
    return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
  },
  get address() {
    return (address) => `${baseExplorerUrl}/address/${address}`;
  }
};


const axios = require('axios');

async function ticker() {
  try {
    const response = await axios.get('https://chainid.network/chains.json');
    const allChains = response.data;
    const network = await provider().getNetwork();
    const chainId = Number(network.chainId);

    const chain = allChains.find(chain => chain.chainId === chainId);
    if (chain) {
      return chain.nativeCurrency ? chain.nativeCurrency.symbol : 'Unknown';
    } else {
      return 'Unknown';
    }
  } catch (error) {
    return 'Unknown';
  }
}
module.exports = { changeRpcProvider, provider, PRIVATE_KEY, explorer, ticker };
