const fs = require("fs").promises;
const path = require("path");
const bs58 = require("bs58"); // Import bs58 for base58 encoding/decoding

// Path to the JSON database file
const dbFilePath = path.join(__dirname, "wallets.json");

// Load the database file or create an empty one if it doesn't exist
async function loadDb() {
  try {
    const data = await fs.readFile(dbFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      // File doesn't exist, return an empty object
      return {};
    } else {
      throw error;
    }
  }
}

// Save the database back to the file
async function saveDb(db) {
  const data = JSON.stringify(db, null, 2); // Pretty-print the JSON
  await fs.writeFile(dbFilePath, data, "utf-8");
}

// Save the private key for a given chatId
async function savePrivateKey(chatId, privateKey) {
  const db = await loadDb();
  db[chatId] = bs58.encode(Buffer.from(privateKey)); // Use bs58 encoding for storage
  await saveDb(db);
}

// Retrieve the private key for a given chatId
async function getPrivateKey(chatId) {
  const db = await loadDb();
  const privateKeyBase58 = db[chatId];

  if (!privateKeyBase58) {
    return null; // No key found for this chatId
  }

  return bs58.decode(privateKeyBase58); // Decode base58 to Uint8Array
}

module.exports = { savePrivateKey, getPrivateKey };
