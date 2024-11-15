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
const { ABI, SEND_ABI } = require('./abi/abi');
const WETH_CA = '0xA51894664A773981C6C112C43ce576f315d5b1B6';
const SEND_CA = '0x2A5b0a407828b6Ca2E87e2e568CD8413fd5c24A1';
const recipientsaddress = JSON.parse(fs.readFileSync('recipients.json', 'utf8'));
const { CronJob } = require('cron');
const amountCheck = ethers.parseEther('1', 'ether');
const defaultgasPrice = ethers.parseUnits('0.19', 'gwei');
async function getRoundedGasPrice(provider, defaultGasPrice) {
  try {
    let feeData = await provider.getFeeData();
    let gasPrice = feeData.gasPrice;

    if (!gasPrice) throw new Error("Gas price tidak tersedia");

    let gasPriceInGwei = ethers.formatUnits(gasPrice, 'gwei');
    
    // Set harga gas minimal 0.15 Gwei
    if (parseFloat(gasPriceInGwei) < 0.15) {
      gasPriceInGwei = '0.15';
    }

    let gasPriceRounded = ethers.parseUnits(gasPriceInGwei, 'gwei');
    return gasPriceRounded;
  } catch (error) {
    console.log(`Error: ${error.message}. Menggunakan harga gas default ${ethers.formatUnits(defaultGasPrice, 'gwei')} gwei`);
    return defaultGasPrice;
  }
}
function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}
async function doSendEther(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const recipients = recipientsaddress;
  const values = recipients.map(() => ethers.parseUnits('1.5', 'ether'));
  const sendContract = new ethers.Contract(SEND_CA, SEND_ABI, wallet);
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const gasPrice = await getRoundedGasPrice(provider, defaultgasPrice);
      const txSendContract = await sendContract.multicall(recipients, values, { value: ethers.parseUnits('1.5', 'ether'), gasPrice: gasPrice });
      const receipt = await txSendContract.wait(1);
      return receipt.hash;
    } catch (error) {
      attempt++;
      const errorMessage = `[$timezone] Error executing Send ETH transaction (Attempt ${attempt}/${maxRetries}): ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      if (attempt < maxRetries && (error.message.includes('insufficient funds') || 
          error.message.includes('nonce has already') ||
          error.message.includes('Gateway Timeout') ||
          error.message.includes('failed to detect network') ||
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

  throw new Error(`Exceeded maximum retries for Send ETH transaction.`);
}
async function checkBalance(privateKey) {
  const wallet = new ethers.Wallet(privateKey, tempProvider);
  const address = await wallet.getAddress();
  let balance = await tempProvider.getBalance(address);

  const loadingSymbols = ['|', '/', '-', '\\'];
  let index = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rChecking balance for ${address}... ${loadingSymbols[index]}`);
    index = (index + 1) % loadingSymbols.length;
  }, 200);

  while (balance <= amountCheck) {
    try {
      await delay(5000);
      balance = await tempProvider.getBalance(address);
    } catch (error) {
      if (error.message.includes('504 Gateway Timeout')) {
        console.log(`\nRPC Error: 504 Gateway Timeout. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else if (error.message.includes('request timeout')) {
        console.log(`\nRequest Timeout Error. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else if (error.message.includes('free limit')) {
        console.log(`\nRequest Limit. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else if (error.message.includes('constant variable')) {
        console.log(`\nRequest Limit. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else {
        const errorMessage = `[$timezone] Error checking balance: ${error.message}`;
        console.log(errorMessage.red);
        appendLog(errorMessage);
        process.exit(0);
      }
    }
    await delay(120000);
  }

  clearInterval(loadingInterval);
  process.stdout.write('\r');
  console.log(`Balance check completed`);
  console.log(`Wallet address: ${address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log('');
  return balance;
}
async function runWrapandUnwrap() {
  displayHeader();
  const timezone = moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY');
  for (const PRIVATE_KEY of PRIVATE_KEYS) {
    try {
      let balance = await checkBalance(PRIVATE_KEY);
      await delay(5000);
      for (let i = 0; i < 1; i++) {
      const receiptTxSend = await doSendEther(PRIVATE_KEY);
      if (receiptTxSend) {
        const successMessage = `[${timezone}] Transaction Send ETH: ${explorer.tx(receiptTxSend)}`;
        console.log(successMessage.cyan);
        appendLog(successMessage);
       }
      }
    } catch (error) {
      const errorMessage = `[${timezone}] Error processing transaction : ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      await delay(5000);
      console.log('');
    }
  }
}
runWrapandUnwrap()
