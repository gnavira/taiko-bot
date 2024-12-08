const { ethers } = require('ethers');
const readline = require('readline');
const fs = require('fs');
const moment = require('moment-timezone');
const { displayHeader, delay } = require('./chains/utils/utils');
const chains = require('./chains');
const provider = chains.mainnet.taiko.provider;
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const WETH_CA = '0xA51894664A773981C6C112C43ce576f315d5b1B6';
const SEND_CA = '0x2A5b0a407828b6Ca2E87e2e568CD8413fd5c24A1';
const { ABI, SEND_ABI } = require('./abi/abi');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
function appendLog(message) {
  fs.appendFileSync('logreplace.txt', message + '\n');
}

const askQuestion = (question) => {
  return new Promise((resolve) => rl.question(question, resolve));
};
async function checkPendingNonce(walletAddress) {
  try {
    const pendingNonce = await provider.getTransactionCount(walletAddress, 'latest');
    console.log(`Nonce yang sedang pending: ${pendingNonce}`);
    return pendingNonce;
  } catch (error) {
    console.error('Gagal memeriksa transaksi pending:', error.message);
    return null;
  }
}

async function showMenu() {
  console.log("\nMenu Pilihan Transaksi:");
  console.log("1. doWrap");
  console.log("2. doUnwrap");
  console.log("3. doSendEther");
  console.log("0. Exit");

  const choice = await askQuestion("Pilih transaksi (1/2/3) atau 0 untuk keluar: ");
  return choice;
}
async function startTransaction() {
  try {
    displayHeader();
    const privateKey = PRIVATE_KEYS[0];
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    const pendingNonce = await checkPendingNonce(walletAddress);
    if (pendingNonce === null) {
      console.log('Tidak dapat memeriksa nonce pending. Membatalkan proses...');
      return;
    }

    while (true) {
      const transactionChoice = await showMenu();

      if (transactionChoice === '0') {
        console.log("Keluar dari program...");
        rl.close();
        return; // Exit
      }
      const transactionType = transactionChoice === '1' ? 'doWrap' :
                             transactionChoice === '2' ? 'doUnwrap' :
                             transactionChoice === '3' ? 'doSendEther' :
                             null;

      if (!transactionType) {
        console.log('Pilihan tidak valid. Silakan pilih kembali.');
        continue;
      }
      const gasPriceInput = await askQuestion("Masukkan gasPrice (dalam gwei): ");
      const gasPrice = ethers.parseUnits(gasPriceInput, 'gwei');
      
      let nonceInput = await askQuestion("Masukkan nonce transaksi: ");
      let nonce = parseInt(nonceInput, 10);
      if (nonce === NaN) {
        nonce = pendingNonce;
        console.log(`Menggunakan nonce yang sedang pending: ${nonce}`);
      }

      let txHash;

      if (transactionType === 'doWrap') {
        txHash = await doWrap(privateKey, gasPrice, nonce);
      } else if (transactionType === 'doUnwrap') {
        txHash = await doUnwrap(privateKey, gasPrice, nonce);
      } else if (transactionType === 'doSendEther') {
        txHash = await doSendEther(privateKey, gasPrice, nonce);
      }
      console.log(`Transaksi berhasil! Hash: https://taikoscan.net/tx/${txHash}`);
      appendLog(`Transaksi ${transactionType}: ${txHash}`);
    }
  } catch (error) {
    console.error('Error dalam melakukan transaksi:', error.message);
  } finally {
    rl.close();
  }
}
async function doWrap(privateKey, gasPrice, nonce) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const amount = ethers.parseUnits('1', 'ether');
  
  try {
    const wrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
    const txWrap = await wrapContract.deposit({ value: amount, gasPrice, nonce });
    const receipt = await txWrap.wait(1);
    return receipt.hash;
  } catch (error) {
    console.error(`Wrap transaction failed: ${error.message}`);
    throw error;
  }
}

async function doUnwrap(privateKey, gasPrice, nonce) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  try {
    const unwrapContract = new ethers.Contract(WETH_CA, ABI, wallet);
    const amount = await unwrapContract.balanceOf(address);
    if (amount === 0n) {
      console.log(`[${Timestamp()}] No WETH to unwrap.`.yellow);
      return null;
    }
    const txUnwrap = await unwrapContract.withdraw(amount, { gasPrice, nonce });
    const receipt = await txUnwrap.wait(1);
    return receipt.hash;
  } catch (error) {
    console.error(`Unwrap transaction failed: ${error.message}`);
    throw error;
  }
}

async function doSendEther(privateKey, gasPrice, nonce) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const recipients = JSON.parse(fs.readFileSync('recipients.json', 'utf8'));
  const values = recipients.map(() => ethers.parseUnits('1', 'ether'));
  
  try {
    const sendContract = new ethers.Contract(SEND_CA, SEND_ABI, wallet);
    const txSendContract = await sendContract.multicall(recipients, values, { value: ethers.parseUnits('1', 'ether'), gasPrice, nonce });
    const receipt = await txSendContract.wait(1);
    return receipt.hash;
  } catch (error) {
    console.error(`Send Ether transaction failed: ${error.message}`);
    throw error;
  }
}

startTransaction();
