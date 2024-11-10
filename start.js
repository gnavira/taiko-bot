const { ethers } = require('ethers');
const chains = require('./chains');
let provider = chains.mainnet.taiko.provider();
const changeProvider = chains.mainnet.taiko.changeRpcProvider();
const explorer = chains.mainnet.taiko.explorer;
const changeRpc = chains.mainnet.tempTaiko.changeRpcProvider();
let tempProvider = chains.mainnet.tempTaiko.provider();
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
async function switchProvider() {
  console.log(`Beralih ke penyedia RPC baru...`);
  tempProvider = changeRpc; // Memperbarui penyedia

  // Tambahkan log untuk memeriksa apakah penyedia baru valid
  if (tempProvider && tempProvider.connection && tempProvider.connection.url) {
    console.log(`Menggunakan RPC: ${tempProvider.connection.url}`);
  } else {
    console.error(`Error: Penyedia RPC baru tidak valid.`);
  }

  await delay(5000); // Beri sedikit waktu untuk stabil
}
async function switchRpc() {
  console.log(`Beralih ke penyedia RPC baru...`);
  provider = changeProvider; // Memperbarui penyedia
  if (provider && provider.connection && provider.connection.url) {
    console.log(`Menggunakan RPC: ${provider.connection.url}`);
  } else {
    console.error(`Error: Penyedia RPC baru tidak valid.`);
  }

  await delay(5000); // Beri sedikit waktu untuk stabil
}

function isTimeoutError(error) {
  return error.message.includes('504 Gateway Timeout') || 
         error.message.includes('request timeout') || 
         error.message.includes('failed to detect network') || 
         error.message.includes('free limit') || 
         error.message.includes('constant variable');
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

  const amountToUnwrap = ethers.parseUnits('1', 'ether')

  while (balanceWeth <= amountToUnwrap) {
    try {
      await delay(5000);
      balanceWeth = await new ethers.Contract(WETH_CA, ABI, tempProvider).balanceOf(address);
    } catch (error) {
      if (isTimeoutError(error)) {
        console.log(`Kesalahan timeout terjadi: ${error.message}`);
        await switchProvider();
        continue;
      }
      const errorMessage = `Kesalahan memeriksa saldo: ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      throw error;
    }
  }
  clearInterval(loadingInterval);
  process.stdout.write('\r');
  console.log(`${ethers.formatEther(balanceWeth)} WETH`.blue);
  return balanceWeth;
}

async function doWrap(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const amount = ethers.parseUnits('1.5', 'ether');
  const maxRetries = 3; // Maximum number of retries
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const wrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
      const txWrap = await wrapContract.deposit({ value: amount, gasPrice: gasPrice });
      const receipt = await txWrap.wait(1);
      return receipt.hash; // Return the transaction hash on success
    } catch (error) {
      attempt++;
      const errorMessage = `[$timezone] Error executing Wrap transaction (Attempt ${attempt}/${maxRetries}): ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      if (attempt < maxRetries && (error.message.includes('insufficient funds') || 
          error.message.includes('nonce has already') ||
          error.message.includes('Gateway Timeout') ||
          error.message.includes('missing revert data'))) {
        console.log(`Retrying transaction after delay...`);
        await delay(20000);
        await switchRpc();
      } else {
        throw error; // Re-throw the error for other issues or if max retries reached
      }
    }
  }

  throw new Error(`Exceeded maximum retries for Wrap transaction.`); // Throw an error if all retries failed
}
async function doUnwrap(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const amount = ethers.parseUnits('1.5', 'ether');
  const maxRetries = 3; // Maximum number of retries
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const unwrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
      const txUnwrap = await unwrapContract.withdraw(amount, { gasPrice: gasPrice });
      const receipt = await txUnwrap.wait(1);
      return receipt.hash; // Return the transaction hash on success
    } catch (error) {
      attempt++;
      const errorMessage = `[$timezone] Error executing Unwrap transaction (Attempt ${attempt}/${maxRetries}): ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      if (attempt < maxRetries && (error.message.includes('insufficient funds') || 
          error.message.includes('nonce has already') ||
          error.message.includes('Gateway Timeout') ||
          error.message.includes('missing revert data'))) {
        console.log(`Retrying transaction after delay...`);
        await delay(20000);
        await switchRpc();
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Exceeded maximum retries for Unwrap transaction.`);
}

async function doSendEther(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const recipients = recipientsaddress;
  const values = recipients.map(() => ethers.parseUnits('1.5', 'ether'));
  const sendContract = new ethers.Contract(SEND_CA, SEND_ABI, wallet);
  const maxRetries = 3; // Maximum number of retries
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const txSendContract = await sendContract.multicall(recipients, values, { value: ethers.parseUnits('1.5', 'ether'), gasPrice: gasPrice });
      const receipt = await txSendContract.wait(1);
      return receipt.hash; // Return the transaction hash on success
    } catch (error) {
      attempt++;
      const errorMessage = `[$timezone] Error executing Send ETH transaction (Attempt ${attempt}/${maxRetries}): ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      if (attempt < maxRetries && (error.message.includes('insufficient funds') || 
          error.message.includes('nonce has already') ||
          error.message.includes('Gateway Timeout') ||
          error.message.includes('missing revert data'))) {
        console.log(`Retrying transaction after delay...`);
        await delay(20000);
        await switchRpc();
      } else {
        throw error; // Re-throw the error for other issues or if max retries reached
      }
    }
  }

  throw new Error(`Exceeded maximum retries for Send ETH transaction.`); // Throw an error if all retries failed
}
async function checkBalance(privateKey) {
  const wallet = new ethers.Wallet(privateKey, tempProvider);
  const address = await wallet.getAddress();
  let balance = await tempProvider.getBalance(address);

  const loadingSymbols = ['|', '/', '-', '\\'];
  let index = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rMemeriksa saldo untuk ${address}... ${loadingSymbols[index]}`);
    index = (index + 1) % loadingSymbols.length;
  }, 200);

  while (balance <= amountCheck) {
    try {
      await delay(120000);
      balance = await tempProvider.getBalance(address);
    } catch (error) {
      if (isTimeoutError(error)) {
        console.log(`Kesalahan timeout terjadi: ${error.message}`);
        await switchProvider();
        continue;
      }
      const errorMessage = `Kesalahan memeriksa saldo: ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      throw error;
    }
  }

  clearInterval(loadingInterval);
  process.stdout.write('\r');
  console.log(`Pemeriksaan saldo selesai. Saldo: ${ethers.formatEther(balance)} ETH`);
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
      if (isTimeoutError(error)) {
        console.log(`Kesalahan timeout terjadi: ${error.message}`);
        await switchProvider();
        continue;
      }
      const errorMessage = `Kesalahan memeriksa saldo: ${error.message}`;
      console.log(errorMessage.red);
      appendLog(errorMessage);
      throw error;
    }
  }
  clearInterval(loadingInterval);
  process.stdout.write('\r');
  console.log(`${ethers.formatEther(balanceDeposit)} ETH`.blue);
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
      let balanceSend = await checkBalanceDeposit(PRIVATE_KEY);
      await delay(5000);
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
      console.log(error);
      appendLog(errorMessage);
      await delay(5000);
      console.log('');
    }
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

