const { ethers } = require('ethers');
const chains = require('./chains');
const provider = chains.mainnet.taiko.provider;
const changeProvider = chains.mainnet.taiko.changeRpcProvider;
const explorer = chains.mainnet.taiko.explorer;
const changeRpc = chains.mainnet.tempTaiko.changeRpcProvider;
const tempProvider = chains.mainnet.tempTaiko.provider;
const fs = require('fs');
const moment = require('moment-timezone');
const { displayHeader, delay } = require('./chains/utils/utils');
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const { TAIKO_ABI } = require('./abi/abi');
const TAIKO_CA = '0xA9d23408b9bA935c230493c40C73824Df71A0975';
const defaultgasPrice = ethers.parseUnits('0.1', 'gwei');
function Timestamp() {
  return moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] | DD-MM-YYYY');
}
async function getRoundedGasPrice(tempProvider, defaultGasPrice) {
  try {
    const feeData = await tempProvider.getFeeData();
    let gasPrice = feeData.gasPrice;
    if (!gasPrice) throw new Error("Gas price tidak tersedia");
    let gasPriceInGwei = parseFloat(ethers.formatUnits(gasPrice, "gwei"));
    if (gasPriceInGwei < 0.1) {
      gasPriceInGwei = 0.1;
    } else {
      gasPriceInGwei = Math.ceil(gasPriceInGwei * 100) / 100;
    }
    const getRoundedGasPrice = ethers.parseUnits(gasPriceInGwei.toString(), "gwei");
    return getRoundedGasPrice;

  } catch (error) {
    console.log(`Error get gas price: ${error.message}. Using default gas price ${ethers.formatUnits(defaultGasPrice, "gwei")} gwei`);
    return defaultGasPrice;
  }
}
function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}

function isTimeoutError(error) {
  return error.message.includes('504 Gateway Timeout') || 
         error.message.includes('request timeout') || 
         error.message.includes('failed to detect network') ||
         error.message.includes('free limit') ||
         error.message.includes('Service Unavailable') || 
         error.message.includes('constant variable');
}

async function doSendTaiko(privateKey) {
  await delay(5000);
  const wallet = new ethers.Wallet(privateKey, tempProvider);
  const maxRetries = 3;
  let attempt = 0;
  const address = await wallet.getAddress();
  while (attempt < maxRetries) {
    try {
      console.log(`Transaction Send Taiko for wallet ${address} `);
      const gasPrice = await getRoundedGasPrice(tempProvider, defaultgasPrice);
      const nonce = await tempProvider.getTransactionCount(address, "latest");
      const taikoContract = new ethers.Contract(TAIKO_CA, TAIKO_ABI, wallet);
	  const toAddress = '0xa9640F7f3f2d08C95488Cc06543E8697AAC26c67';
      const amount = await taikoContract.balanceOf(address);
      console.log(`Balance TAIKO: ${ethers.formatUnits(amount, 'ether')} TAIKO | Nonce: ${nonce} | Gas Price: ${ethers.formatUnits(gasPrice, "gwei")}`);
      if (amount === 0n) {
        console.log(`${Timestamp()} | No TAIKO to send.`.yellow);
        return null;
      }
      const txSend = await taikoContract.transfer(toAddress, amount, { gasPrice: gasPrice, nonce: nonce });
      const receipt = await txSend.wait(1);
      const sendlog = `${Timestamp()} | Successful | ${explorer.tx(receipt.hash)}`;
      console.log(sendlog.cyan);
      appendLog(sendlog);
      return receipt.hash;

    } catch (error) {
      attempt++;
      const errorMessage = `${Timestamp()} | Error executing Send TAIKO transaction (Attempt ${attempt}/${maxRetries}): ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);

      if (attempt < maxRetries && (error.message.includes('insufficient funds') ||
          error.message.includes('nonce has already') ||
          error.message.includes('Gateway Timeout') ||
          error.message.includes('failed to detect network') ||
          error.message.includes('Service Unavailable') ||
          error.message.includes('request timeout') ||
          error.message.includes('free limit') ||
          error.message.includes('missing revert data'))) {
        console.log(`Retrying transaction after delay...`);
        await delay(20000);
        await changeProvider();
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Exceeded maximum retries for Unwrap transaction.`);
}
async function runSendTaiko() {
  displayHeader();
  for (const PRIVATE_KEY of PRIVATE_KEYS) {
    try {
      const sendTaiko = await doSendTaiko(PRIVATE_KEY);
      await delay(5000);
    } catch (error) {
      const errorMessage = `${Timestamp()} | Error processing transactions for private key. Details: ${error.message}`;
      console.log(errorMessage.red);
      console.log(error);
      appendLog(errorMessage);
      await delay(2000);
    }
  }
}
runSendTaiko();
