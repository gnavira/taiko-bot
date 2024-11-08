const { ethers } = require('ethers');
const chains = require('./chains');
const provider = chains.mainnet.taiko.provider();
const explorer = chains.mainnet.taiko.explorer;
const changeRpc = chains.mainnet.tempTaiko.changeRpcProvider;
const tempProvider = chains.mainnet.tempTaiko.provider();
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
const gasPrice = ethers.parseUnits('0.2', 'gwei');

function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}
async function checkWethBalance(privateKey) {
  const wallet = new ethers.Wallet(privateKey, tempProvider);
  const address = await wallet.getAddress();
  let balanceWeth = await new ethers.Contract(WETH_CA, ABI, tempProvider).balanceOf(address);

  const loadingSymbols = ['|', '/', '-', '\\'];
  let index = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rChecking WETH balance for ${address}... ${loadingSymbols[index]}`);
    index = (index + 1) % loadingSymbols.length;
  }, 200);

  const amountToUnwrap = ethers.parseUnits('1', 'ether'); // Batas saldo WETH yang diperlukan (1.5 WETH)

  while (balanceWeth <= amountToUnwrap) {
    try {
      await delay(5000); // Tunggu 5 detik sebelum pengecekan ulang
      balanceWeth = await new ethers.Contract(WETH_CA, ABI, tempProvider).balanceOf(address);
    } catch (error) {
      if (error.message.includes('504 Gateway Timeout')) {
        console.log(`\nRPC Error: 504 Gateway Timeout. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else if (error.message.toLowerCase().includes('timeout')) {
        console.log(`\nRequest Timeout Error. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
        } else if (error.message.toLowerCase().includes('constant variable')) {
        console.log(`\nRequest Limit. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else {
        const errorMessage = `[${
          moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY')
        }] Error checking WETH balance: ${error.message}`;
        console.log(errorMessage.red);
        appendLog(errorMessage);
        process.exit(0);
      }
    }
    await delay(5000); // Tunggu 2 menit sebelum pengecekan ulang
  }

  clearInterval(loadingInterval);
  process.stdout.write('\r');
  console.log(`${ethers.formatEther(balanceWeth)} WETH`.blue);
  return balanceWeth;
}

async function doWrap(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    const amount = ethers.parseUnits('1.5', 'ether');
    const wrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
    const txWrap = await wrapContract.deposit({ value: amount, gasPrice: gasPrice });
    const receipt = await txWrap.wait(1);
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
    const txUnwrap = await unwrapContract.withdraw(amount, { gasPrice: gasPrice });
    const receipt = await txUnwrap.wait(1);
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
      } else if (error.message.toLowerCase().includes('timeout')) {
        console.log(`\nRequest Timeout Error. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
        } else if (error.message.toLowerCase().includes('free limit')) {
        console.log(`\nRequest Limit. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
        } else if (error.message.toLowerCase().includes('constant variable')) {
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
async function checkBalanceDeposit(privateKey) {
  const wallet = new ethers.Wallet(privateKey, tempProvider);
  const address = await wallet.getAddress();
  let balanceDeposit = await tempProvider.getBalance(address);

  const loadingSymbols = ['|', '/', '-', '\\'];
  let index = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rChecking balance for ${address}... ${loadingSymbols[index]}`);
    index = (index + 1) % loadingSymbols.length;
  }, 200);

  while (balanceDeposit <= amountCheck) {
    try {
      await delay(5000);
      balanceDeposit = await tempProvider.getBalance(address);
    } catch (error) {
      if (error.message.includes('504 Gateway Timeout')) {
        console.log(`\nRPC Error: 504 Gateway Timeout. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
      } else if (error.message.toLowerCase().includes('timeout')) {
        console.log(`\nRequest Timeout Error. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
        } else if (error.message.toLowerCase().includes('free limit')) {
        console.log(`\nRequest Limit. Retrying with another RPC...`);
        tempProvider = changeRpc();
        continue;
        } else if (error.message.toLowerCase().includes('constant variable')) {
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
  console.log(`${ethers.formatEther(balance)} ETH`.blue);
  console.log('');
  return balanceDeposit;
}

async function runWrapandUnwrap() {
  displayHeader();
  const timezone = moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY');
  for (const PRIVATE_KEY of PRIVATE_KEYS) {
    try {
      let balance = await checkBalance(PRIVATE_KEY);
      await delay(5000);
      for (let i = 0; i < 15; i++) {
        const txMessage = `Transaction Wrap and Unwrap`;
        console.log(txMessage);
        appendLog(txMessage);
        let balanceDeposit = await checkBalanceDeposit(PRIVATE_KEY);
        await delay(5000);
        const receiptTx = await doWrap(PRIVATE_KEY);
        if (receiptTx) {
          const successMessage = `[${timezone}] Transaction Wrap: ${explorer.tx(receiptTx)}`;
          console.log(successMessage.cyan);
          appendLog(successMessage);
        }
        let balanceWeth = await checkWethBalance(PRIVATE_KEY);
        await delay(5000);
        const receiptTx2 = await doUnwrap(PRIVATE_KEY);
        if (receiptTx2) {
          const successMessage = `[${timezone}] Transaction Unwrap: ${explorer.tx(receiptTx2)}`;
          console.log(successMessage.cyan);
          appendLog(successMessage);
        }
      }
      await delay(5000);
      const sendMessage = `Transaction Send ETH`;
      console.log(sendMessage);
      appendLog(sendMessage);
      const receiptTxSend = await doSendEther(PRIVATE_KEY);
      if (receiptTxSend) {
        const successMessage = `[${timezone}] Transaction Send ETH: ${explorer.tx(receiptTxSend)}`;
        console.log(successMessage.cyan);
        appendLog(successMessage);
      }
      console.log('');
    } catch (error) {
      const errorMessage = `[${timezone}] Error processing transaction. Details: ${error.message}`;
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

runWrapandUnwrap()
  .then(() => {
    console.log('First run of runWrapandUnwrap completed.');
    job.start();
    console.log('Transaction will run every 01:00 UTC');
  })
  .catch(error => {
    console.error(`Error during the first run: ${error.message}`);
  });
