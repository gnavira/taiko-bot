const { ethers } = require('ethers');
const chains = require('./chains');
const provider = chains.mainnet.taiko.provider();
const explorer = chains.mainnet.taiko.explorer;
const fs = require('fs');
const moment = require('moment-timezone');
const { displayHeader, delay } = require('./chains/utils/utils');
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const { ABI, SEND_ABI } = require('./abi/abi');
const WETH_CA = '0xA51894664A773981C6C112C43ce576f315d5b1B6';
const SEND_CA = '0x2A5b0a407828b6Ca2E87e2e568CD8413fd5c24A1';
const recipientsaddress = JSON.parse(fs.readFileSync('recipients.json', 'utf8'));
const { CronJob } = require('cron');
const amountCheck = ethers.parseEther('1.5', 'ether');

function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}

async function doWrap(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    const amount = ethers.parseUnits('1.5', 'ether');
    const wrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
    const txWrap = await wrapContract.deposit({ value: amount });
    const receipt = await txWrap.wait(1);
    const successMessage = `Transaction Confirmed in block ${receipt.blockNumber}`;
    console.log(successMessage.blue);
    appendLog(successMessage);
    return receipt.hash;
  } catch (error) {
    const errorMessage = `[$timezone] Error executing transaction: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
}

async function doUnwrap(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    const amount = ethers.parseUnits('1.5', 'ether');
    const unwrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
    const txUnwrap = await unwrapContract.withdraw(amount);
    const receipt = await txUnwrap.wait(1);
    const successMessage = `Transaction Confirmed in block ${receipt.blockNumber}`;
    console.log(successMessage.blue);
    appendLog(successMessage);
    return receipt.hash;
  } catch (error) {
    const errorMessage = `[$timezone] Error executing transaction: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
}

async function doSendEther(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
	const values = ["1500000000000000000"];
    const recipients = recipientsaddress;
    const amount = ethers.parseUnits('1.5', 'ether');
    const sendContract = new ethers.Contract(SEND_CA, SEND_ABI, wallet);
    const txSendContract = await sendContract.multicall(recipients, values, { value: amount});
    const receipt = await txSendContract.wait(1);
    const successMessage = `Transaction Confirmed in block ${receipt.blockNumber}`;
    console.log(successMessage.blue);
    appendLog(successMessage);
    return receipt.hash;
  } catch (error) {
    const errorMessage = `[$timezone] Error executing Send ETH transaction: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
}

async function checkBalance(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  let balance = await provider.getBalance(address);

  let loadingSymbols = ['|', '/', '-', '\\'];
  let index = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rChecking balance for ${address}... ${loadingSymbols[index]}`);
    index = (index + 1) % loadingSymbols.length;
  }, 200);

  while (balance <= amountCheck) {
    await delay(2000);
    balance = await provider.getBalance(address);
  }

  clearInterval(loadingInterval);
  process.stdout.write('\r');

  console.log(`Check completed for address: ${address}, Balance: ${ethers.formatEther(balance)} ETH`);
  await delay(10000);
  return balance;
}

async function runWrapandUnwrap() {
  displayHeader();
  const timezone = moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY');
  for (const PRIVATE_KEY of PRIVATE_KEYS) {
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const address = await wallet.getAddress();

    try {
      let balance = await checkBalance(PRIVATE_KEY);
      while (balance <= amountCheck) {
        await delay(2000);
        balance = await checkBalance(PRIVATE_KEY);
      }

      for (let i = 0; i < 15; i++) {
        const receiptTx = await doWrap(PRIVATE_KEY);
        if (receiptTx) {
          const successMessage = `[${timezone}] Transaction Wrap: ${explorer.tx(receiptTx)}`;
          console.log(successMessage.cyan);
          appendLog(successMessage);
        }
        await delay(5000);

        const receiptTx2 = await doUnwrap(PRIVATE_KEY);
        if (receiptTx2) {
          const successMessage = `[${timezone}] Transaction Unwrap: ${explorer.tx(receiptTx2)}`;
          console.log(successMessage.cyan);
          appendLog(successMessage);
        }
        console.log('');
      }

      const receiptTxSend = await doSendEther(PRIVATE_KEY);
      if (receiptTxSend) {
        const successMessage = `[${timezone}] Transaction Send ETH: ${explorer.tx(receiptTxSend)}`;
        console.log(successMessage.cyan);
        appendLog(successMessage);
      }

    } catch (error) {
      const errorMessage = `[${timezone}] Error processing transaction. Please try again later.`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      await delay(5000);
      console.log('');
    }
  }
}

const job = new CronJob(
  '0 1 * * *',
  runWrapandUnwrap,
  null,
  true,
  'UTC'
);

job.start();
console.log('Transaction will run every day at 01:00 UTC');
