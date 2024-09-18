import TelegramBot from "node-telegram-bot-api";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { savePrivateKey, getPrivateKey } from "./dbUtils"; // Import the db utils
import "dotenv/config";


const botToken = process.env.BOT_TOKEN!;
const bot = new TelegramBot(botToken, { polling: true });

// Solana setup
const network = "https://api.devnet.solana.com"; // or use https://api.devnet.solana.com for development
const connection = new Connection(network, "confirmed");

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome to the Solana custodial wallet bot! Use /createwallet to create a wallet."
  );
});

// Create wallet command
bot.onText(/\/createwallet/, async (msg) => {
  const chatId = msg.chat.id.toString();

  const existingPrivateKey = await getPrivateKey(chatId);
  if (existingPrivateKey) {
    bot.sendMessage(chatId, "You already have a wallet created.");
  } else {
    const newWallet = Keypair.generate();
    await savePrivateKey(chatId, newWallet.secretKey); // Save the private key to the JSON DB
    bot.sendMessage(
      chatId,
      `Wallet created! Your public key is: ${newWallet.publicKey.toBase58()}`
    );
  }
});

// Check balance command
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id.toString();

  const privateKey = await getPrivateKey(chatId);
  if (!privateKey) {
    bot.sendMessage(
      chatId,
      "You don't have a wallet yet. Use /createwallet to create one."
    );
    return;
  }

  const wallet = Keypair.fromSecretKey(privateKey);
  const balance = await connection.getBalance(wallet.publicKey);

  // Get the minimum balance required for rent exemption
  const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(
    0
  ); // 0 size is for a standard account

  // Calculate the spendable balance
  const spendableBalance =
    balance > rentExemptBalance ? balance - rentExemptBalance : 0;

  bot.sendMessage(
    chatId,
    `Your spendable balance is: ${spendableBalance / LAMPORTS_PER_SOL} SOL`
  );
});

// Send SOL command
bot.onText(/\/send (\S+)? (\d*\.?\d+)?/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  // Check if recipient or amount is missing
  if (!match || !match[1] || !match[2]) {
    bot.sendMessage(
      chatId,
      "Please provide a valid recipient address and amount. Example: /send <recipient> <amount>"
    );
    return;
  }

  const recipient = match[1];
  const amount = parseFloat(match[2]);

  // Check if amount is a valid number
  if (isNaN(amount) || amount <= 0) {
    bot.sendMessage(chatId, "Please enter a valid amount greater than 0.");
    return;
  }

  const privateKey = await getPrivateKey(chatId);
  if (!privateKey) {
    bot.sendMessage(
      chatId,
      "You don’t have a wallet yet. Use /createwallet to create one."
    );
    return;
  }

  try {
    const recipientPublicKey = new PublicKey(recipient);
    const senderWallet = Keypair.fromSecretKey(privateKey);

    const balance = await connection.getBalance(senderWallet.publicKey);

    // Get the minimum balance required for rent exemption
    const rentExemptBalance =
      await connection.getMinimumBalanceForRentExemption(0);

    // Calculate the spendable balance
    const spendableBalance =
      balance > rentExemptBalance ? balance - rentExemptBalance - 5000 : 0;

    // Check if the user is trying to send more than the spendable balance
    if (amount * LAMPORTS_PER_SOL > spendableBalance) {
      bot.sendMessage(
        chatId,
        `Insufficient funds. You only have ${
          spendableBalance / LAMPORTS_PER_SOL
        } SOL available to send.`
      );
      return;
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderWallet.publicKey,
        toPubkey: recipientPublicKey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await connection.sendTransaction(transaction, [
      senderWallet,
    ]);
    await connection.confirmTransaction(signature);

    bot.sendMessage(
      chatId,
      `Successfully sent ${amount} SOL to ${recipient}. Transaction signature: ${signature}`
    );
  } catch (error) {
    if (error instanceof Error) {
      bot.sendMessage(chatId, `Error sending SOL: ${error.message}`);
    } else {
      bot.sendMessage(chatId, "An unknown error occurred");
    }
  }
});

// Export private key command
bot.onText(/\/exportkey/, async (msg) => {
  const chatId = msg.chat.id.toString();

  const privateKey = await getPrivateKey(chatId);
  if (!privateKey) {
    bot.sendMessage(
      chatId,
      "You don't have a wallet yet. Use /createwallet to create one."
    );
    return;
  }

  const privateKeyBase58 = bs58.encode(privateKey);
  bot.sendMessage(
    chatId,
    `Your private key (keep it safe!): ${privateKeyBase58}`
  );
});

// Receive tokens command
bot.onText(/\/receive/, async (msg) => {
  const chatId = msg.chat.id.toString();

  const privateKey = await getPrivateKey(chatId);
  if (!privateKey) {
    bot.sendMessage(
      chatId,
      "You don't have a wallet yet. Use /createwallet to create one."
    );
    return;
  }

  const wallet = Keypair.fromSecretKey(privateKey);
  bot.sendMessage(
    chatId,
    `You can receive SOL or tokens using this public key: ${wallet.publicKey.toBase58()}`
  );
});
