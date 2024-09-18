import { promises as fs } from "fs";
import path from "path";
import bs58 from "bs58"; // Import bs58 for base58 encoding/decoding

// Path to the JSON database file
const dbFilePath = path.join(__dirname, "wallets.json");

// Type definition for the stored wallets
type WalletsDb = {
  [chatId: string]: string; // chatId mapped to base58 encoded private key
};

// Load the database file or create an empty one if it doesn't exist
async function loadDb(): Promise<WalletsDb> {
  try {
    const data = await fs.readFile(dbFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Error && (error as any).code === "ENOENT") {
      // File doesn't exist, return an empty object
      return {};
    } else {
      throw error;
    }
  }
}

// Save the database back to the file
async function saveDb(db: WalletsDb): Promise<void> {
  const data = JSON.stringify(db, null, 2); // Pretty-print the JSON
  await fs.writeFile(dbFilePath, data, "utf-8");
}

// Save the private key for a given chatId
export async function savePrivateKey(
  chatId: string,
  privateKey: Uint8Array
): Promise<void> {
  const db = await loadDb();
  db[chatId] = bs58.encode(Buffer.from(privateKey)); // Use bs58 encoding for storage
  await saveDb(db);
}

// Retrieve the private key for a given chatId
export async function getPrivateKey(
  chatId: string
): Promise<Uint8Array | null> {
  const db = await loadDb();
  const privateKeyBase58 = db[chatId];

  if (!privateKeyBase58) {
    return null; // No key found for this chatId
  }

  return bs58.decode(privateKeyBase58); // Decode base58 to Uint8Array
}
