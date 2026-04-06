let wallet = null;
let freeCredits = 0;

// Load free credits from localStorage
function loadFreeCredits(walletAddress) {
    const key = `bedolagichsigner_free_credits_${walletAddress}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
        freeCredits = parseInt(saved, 10);
    } else {
        freeCredits = 50;
        localStorage.setItem(key, freeCredits);
    }
    updateFreeCreditsUI();
}

// Save free credits to localStorage
function saveFreeCredits(walletAddress) {
    const key = `bedolagichsigner_free_credits_${walletAddress}`;
    localStorage.setItem(key, freeCredits);
}

// Update UI with remaining free credits
function updateFreeCreditsUI() {
    const giftValue = document.getElementById('giftValue');
    const giftLabel = document.getElementById('giftLabel');
    const priceDisplay = document.getElementById('priceDisplay');
    const footerFee = document.getElementById('footerFee');
    
    if (giftValue) {
        giftValue.innerText = freeCredits;
    }
    
    if (freeCredits > 0) {
        if (giftLabel) giftLabel.innerText = 'free left';
        if (priceDisplay) priceDisplay.innerText = '0';
        if (footerFee) footerFee.innerText = 'FREE (first 50)';
    } else {
        if (giftLabel) giftLabel.innerText = 'no free left';
        if (priceDisplay) priceDisplay.innerText = '0.0003';
        if (footerFee) footerFee.innerText = '0.0003 SOL';
    }
}

// Split transactions into batches (max 25 per batch to be safe)
function splitIntoBatches(transactions, batchSize = 25) {
    const batches = [];
    for (let i = 0; i < transactions.length; i += batchSize) {
        batches.push(transactions.slice(i, i + batchSize));
    }
    return batches;
}

window.onload = () => {
    console.log('BedolagichSigner ready');

    const connectBtn = document.getElementById('connectBtn');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const signBtn = document.getElementById('signBtn');
    const walletAddressSpan = document.getElementById('walletAddress');
    const resultDiv = document.getElementById('result');
    const statusDot = document.getElementById('statusDot');
    const walletStatusSpan = document.getElementById('walletStatus');

    if (!connectBtn || !uploadArea || !fileInput || !signBtn) {
        console.error('Error: elements not found on page');
        return;
    }

    function setDisconnected() {
        statusDot.classList.remove('connected');
        walletStatusSpan.innerText = 'Not connected';
        walletAddressSpan.innerText = '';
        connectBtn.innerText = 'Connect Phantom';
        signBtn.disabled = true;
        wallet = null;
        freeCredits = 0;
        updateFreeCreditsUI();
    }

    connectBtn.onclick = async () => {
        if (!window.solana || !window.solana.isPhantom) {
            alert('Please install Phantom wallet!');
            window.open('https://phantom.app/', '_blank');
            return;
        }

        try {
            const resp = await window.solana.connect();
            wallet = resp.publicKey.toString();
            walletAddressSpan.innerText = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
            connectBtn.innerText = '✅ Connected';
            signBtn.disabled = false;
            statusDot.classList.add('connected');
            walletStatusSpan.innerText = 'Connected';
            
            loadFreeCredits(wallet);
        } catch (err) {
            console.error('Connection error:', err);
            alert('Failed to connect: ' + err.message);
            setDisconnected();
        }
    };

    if (window.solana) {
        window.solana.on('disconnect', () => setDisconnected());
        window.solana.on('accountChanged', (newAccount) => {
            if (!newAccount) setDisconnected();
        });
    }

    uploadArea.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadArea.innerHTML = `<div class="upload-icon">📄</div><p class="upload-text">${file.name}</p><p class="upload-hint">Click to change file</p>`;
            uploadArea.onclick = () => fileInput.click();
        }
    };

    signBtn.onclick = async () => {
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a transaction file (JSON)');
            return;
        }

        if (!wallet) {
            alert('Please connect your wallet first');
            return;
        }

        // Disable button to prevent double-click
        signBtn.disabled = true;
        signBtn.innerText = 'Processing...';

        try {
            const allTransactions = JSON.parse(await file.text());
            resultDiv.innerHTML = '<p class="processing">⏳ Preparing transactions...</p>';
            
            const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=894dd732-280f-4fe9-b8de-c73f7f65fbc5');

            // FIRST: Calculate how many would be free WITHOUT deducting yet
            let wouldBeFree = Math.min(freeCredits, allTransactions.length);
            let wouldBePaid = allTransactions.length - wouldBeFree;
            
            // Prepare transactions with appropriate fees
            const preparedTransactions = [];
            let freeCount = 0;
            let paidCount = 0;
            
            resultDiv.innerHTML += `<div class="processing">📊 ${wouldBeFree} free + ${wouldBePaid} paid</div>`;
            
            for (let i = 0; i < allTransactions.length; i++) {
                const isFree = freeCount < wouldBeFree;
                const fee = isFree ? 0 : (0.0003 * 1000000000);
                
                const res = await fetch('/api/sign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        transaction: allTransactions[i], 
                        wallet,
                        fee: fee
                    })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                
                const binaryString = atob(data.transaction);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                }
                const tx = solanaWeb3.Transaction.from(bytes);
                preparedTransactions.push(tx);
                
                if (isFree) {
                    freeCount++;
                } else {
                    paidCount++;
                }
            }
            
            // Split into batches
            const batches = splitIntoBatches(preparedTransactions, 25);
            resultDiv.innerHTML += `<div class="processing">📦 ${allTransactions.length} txs → ${batches.length} batch(es)</div>`;
            
            let totalConfirmed = 0;
            let success = true;
            
            // Process each batch
            for (let b = 0; b < batches.length; b++) {
                const batch = batches[b];
                resultDiv.innerHTML += `<div class="processing">🔄 Signing batch ${b + 1}/${batches.length} (${batch.length} txs)...</div>`;
                
                try {
                    const { blockhash } = await connection.getLatestBlockhash();
                    
                    const batchTx = new solanaWeb3.Transaction();
                    for (const tx of batch) {
                        batchTx.add(tx.instructions[0]);
                    }
                    batchTx.recentBlockhash = blockhash;
                    batchTx.feePayer = new solanaWeb3.PublicKey(wallet);
                    
                    const signed = await window.solana.signTransaction(batchTx);
                    const signature = await connection.sendRawTransaction(signed.serialize());
                    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
                    
                    if (confirmation.value.err) {
                        throw new Error(`Batch ${b + 1} failed`);
                    }
                    
                    totalConfirmed += batch.length;
                    resultDiv.innerHTML += `<div class="success">✅ Batch ${b + 1} confirmed (${signature.slice(0, 8)}...)</div>`;
                } catch (err) {
                    // If user cancelled or error occurred, don't deduct credits
                    success = false;
                    let errorMsg = err.message;
                    if (errorMsg.includes('User rejected')) {
                        errorMsg = 'Transaction cancelled in wallet — no credits were deducted';
                    }
                    resultDiv.innerHTML += `<div class="error">❌ Batch ${b + 1}: ${errorMsg}</div>`;
                    break;
                }
            }
            
            // ONLY deduct credits if ALL batches succeeded
            if (success && totalConfirmed === allTransactions.length) {
                // Deduct free credits only after successful confirmation
                const newFreeCredits = freeCredits - wouldBeFree;
                freeCredits = Math.max(0, newFreeCredits);
                saveFreeCredits(wallet);
                updateFreeCreditsUI();
                
                const freeText = wouldBeFree > 0 ? ` (${wouldBeFree} free, ${wouldBePaid} paid)` : ` (${wouldBePaid} paid)`;
                resultDiv.innerHTML += `<div class="success">🎉 Complete! ${totalConfirmed} transactions confirmed${freeText}</div>`;
            } else if (!success) {
                resultDiv.innerHTML += `<div class="error">⚠️ No credits were deducted. Please try again.</div>`;
            }
            
            if (freeCredits > 0) {
                resultDiv.innerHTML += `<div class="processing">🎁 Remaining free credits: ${freeCredits}</div>`;
            }
            
        } catch (err) {
            let errorMsg = err.message;
            resultDiv.innerHTML += `<div class="error">❌ Error: ${errorMsg}</div>`;
        } finally {
            // Re-enable button
            signBtn.disabled = false;
            signBtn.innerText = 'Sign All Transactions';
        }
    };
};