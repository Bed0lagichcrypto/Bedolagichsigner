const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');

async function main() {
    const connection = new Connection('https://api.testnet.solana.com');
    const walletAddress = '9QaAC6xK5iqkNpLE12ghNtTXM89FkQwx2V2VthB47vrv';
    const fromPubkey = new PublicKey(walletAddress);
    const toPubkey = new PublicKey(walletAddress);
    
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fromPubkey,
            toPubkey: toPubkey,
            lamports: 1000
        })
    );
    transaction.feePayer = fromPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    const serialized = transaction.serialize({ requireAllSignatures: false }).toString('base64');
    console.log(serialized);
}

main();