const { ethers } = require('ethers');
const chains = require('./chains');
const provider = chains.mainnet.taiko.provider();
const explorer = chains.mainnet.taiko.explorer;
let tempProvider = chains.mainnet.tempTaiko.provider();
const fs = require('fs');
const moment = require('moment-timezone');
const { displayHeader, delay } = require('./chains/utils/utils');
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const { SEND_ABI } = require('./abi/abi');
const SEND_CA = '0x2A5b0a407828b6Ca2E87e2e568CD8413fd5c24A1';
const amountCheck = ethers.parseEther('1', 'ether');
const gasPrice = ethers.parseUnits('0.2', 'gwei');
const recipientsaddress = JSON.parse(fs.readFileSync('recipients.json', 'utf8'));
function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}
const { CronJob } = require('cron');
async function doSendEther(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    const recipients = recipientsaddress;
    const values = recipients.map(() => ethers.parseUnits('1.5', 'ether'));
    const sendContract = new ethers.Contract(SEND_CA, SEND_ABI, wallet);
    const txSendContract = await sendContract.multicall(recipients, values, { value: ethers.parseUnits('1.5', 'ether'), gasPrice: gasPrice });
    const receipt = await txSendContract.wait(1);
    return receipt.hash;
  } catch (error) {
    const errorMessage = `[$timezone] Error executing Send ETH transaction: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
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
