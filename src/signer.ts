import dotenv from "dotenv";
dotenv.config();

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC!);
const RECIPIENT = new PublicKey(process.env.RECIPIENT_WALLET!);
const DEFAULT_FEE = (parseFloat(process.env.SERVICE_FEE!) * LAMPORTS_PER_SOL);

export async function addFeeToTransaction(
    transactionBase64: string,
    walletPublicKey: string,
    feeAmount: number = DEFAULT_FEE
): Promise<string> {
    const tx = Transaction.from(Buffer.from(transactionBase64, "base64"));
    
    // Добавляем комиссию ТОЛЬКО если feeAmount > 0
    if (feeAmount > 0) {
        const feeInstruction = SystemProgram.transfer({
            fromPubkey: new PublicKey(walletPublicKey),
            toPubkey: RECIPIENT,
            lamports: feeAmount
        });
        tx.add(feeInstruction);
    }
    
    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return serialized;
}