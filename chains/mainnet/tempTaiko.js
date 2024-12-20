const { JsonRpcProvider } = require('ethers');
const rpcProviders = [
  'https://rpc.taiko.xyz',
  'https://rpc.ankr.com/taiko',
  'https://taiko.drpc.org',
  'https://taiko-mainnet.rpc.porters.xyz/taiko-public',
  'https://167000.rpc.thirdweb.com',
  'https://taiko-rpc.publicnode.com',
];
let currentRpcProviderIndex = 0;  
let provider = new JsonRpcProvider(rpcProviders[currentRpcProviderIndex]);

function changeRpcProvider() {  
  currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;
  provider = new JsonRpcProvider(rpcProviders[currentRpcProviderIndex])
  console.log("Switch to RPC:", currentRpc());
  return provider;
}
function currentRpc() {
  return rpcProviders[currentRpcProviderIndex];
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
module.exports = { changeRpcProvider, provider, PRIVATE_KEY, explorer, ticker, currentRpc };
