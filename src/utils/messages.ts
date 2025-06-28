import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from './algod';

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  subject: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  passId?: number;
}

// Helper function to validate and format Algorand address
const validateAddress = (address: string | undefined): string => {
  if (!address) {
    throw new Error('Address must not be null or undefined');
  }

  try {
    // Try to decode and re-encode to ensure valid format
    const decoded = algosdk.decodeAddress(address);
    return algosdk.encodeAddress(decoded.publicKey);
  } catch (error: any) {
    throw new Error(`Invalid Algorand address: ${error.message}`);
  }
};

/**
 * Sends a message to a loyalty pass holder
 * @param senderAddress The sender's Algorand address
 * @param receiverAddress The receiver's Algorand address
 * @param subject Message subject
 * @param content Message content
 * @param passId Optional loyalty pass ID associated with the message
 * @param signTransactions Function to sign transactions with the wallet
 * @param networkType The network type ('mainnet' or 'testnet')
 * @returns Transaction ID
 */
export const sendMessage = async (
  senderAddress: string,
  receiverAddress: string,
  subject: string,
  content: string,
  passId: number | undefined,
  signTransactions: (transactions: Uint8Array[]) => Promise<Uint8Array[]>,
  networkType: 'mainnet' | 'testnet'
): Promise<string> => {
  try {
    // Validate addresses
    const validatedSender = validateAddress(senderAddress);
    const validatedReceiver = validateAddress(receiverAddress);

    // Validate other required fields
    if (!subject.trim()) {
      throw new Error('Message subject is required');
    }
    if (!content.trim()) {
      throw new Error('Message content is required');
    }
    if (!signTransactions) {
      throw new Error('Transaction signing function is required');
    }

    const algodClient = getAlgodClient(networkType);
    
    // Create message data
    const messageData = {
      type: 'loyalty_message',
      sender: validatedSender,
      receiver: validatedReceiver,
      subject: subject.trim(),
      content: content.trim(),
      timestamp: Date.now(),
      passId,
      isRead: false
    };

    // Convert message to note
    const noteBytes = new Uint8Array(Buffer.from(JSON.stringify(messageData)));
    
    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();
    
    // Create payment transaction with message in note field
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: validatedSender,
      receiver: validatedReceiver,
      amount: 1000, // 0.001 Algos
      note: noteBytes,
      suggestedParams
    });

    // Sign transaction
    const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
    const signedTxns = await signTransactions([encodedTxn]);
    
    if (!signedTxns?.[0]) {
      throw new Error('Failed to sign transaction');
    }

    // Send transaction
    const response = await algodClient.sendRawTransaction(signedTxns).do();
    
    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, response.txId, 4);
    
    return response.txId;
  } catch (error: any) {
    console.error('Error sending message:', error);
    throw new Error(error.message || 'Failed to send message');
  }
};

/**
 * Fetches messages for a loyalty pass holder
 * @param address The Algorand address to fetch messages for
 * @param networkType The network type ('mainnet' or 'testnet')
 * @returns Array of messages
 */
export const fetchMessages = async (
  address: string,
  networkType: 'mainnet' | 'testnet'
): Promise<Message[]> => {
  try {
    // Validate address
    const validatedAddress = validateAddress(address);

    const networkConfig = getNetworkConfig(networkType);
    
    // Create indexer client
    const indexerClient = new algosdk.Indexer(
      networkConfig.algodToken,
      networkConfig.indexerUrl,
      networkConfig.algodPort
    );
    
    // Search for transactions with message notes
    const searchPrefix = '{"type":"loyalty_message"';
    const transactions = await indexerClient.searchForTransactions()
      .address(validatedAddress)
      .notePrefix(new Uint8Array(Buffer.from(searchPrefix)))
      .do();
    
    const messages: Message[] = [];
    
    // Process transactions
    for (const txn of transactions.transactions) {
      try {
        if (!txn.note || !txn.id) continue;
        
        // Decode note
        const noteBytes = Buffer.from(txn.note, 'base64');
        const noteStr = noteBytes.toString('utf8');
        const noteData = JSON.parse(noteStr);
        
        if (noteData.type === 'loyalty_message') {
          messages.push({
            id: txn.id,
            sender: noteData.sender,
            receiver: noteData.receiver,
            subject: noteData.subject,
            content: noteData.content,
            timestamp: noteData.timestamp,
            isRead: noteData.isRead || false,
            passId: noteData.passId
          });
        }
      } catch (error) {
        console.warn('Error processing message transaction:', error);
      }
    }
    
    // Sort messages by timestamp (newest first)
    return messages.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    throw new Error(error.message || 'Failed to fetch messages');
  }
}; 