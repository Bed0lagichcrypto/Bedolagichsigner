import express from "express";
import cors from "cors";
import { addFeeToTransaction } from "./signer";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Эндпоинт для пинга (чтобы сервер не засыпал)
app.get("/ping", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/sign", async (req, res) => {
    const { transaction, wallet, fee } = req.body;

    try {
        const txWithFee = await addFeeToTransaction(transaction, wallet, fee);
        res.json({ success: true, transaction: txWithFee });
    } catch (error) {
        res.json({ success: false, error: String(error) });
    }
});

// Функция для авто-пинга (каждые 4 минуты 50 секунд)
function startAutoPing() {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`🤖 Auto-ping enabled for: ${url}/ping`);

    setInterval(async () => {
        try {
            const response = await fetch(`${url}/ping`);
            if (response.ok) {
                console.log(`✅ Ping successful at ${new Date().toISOString()}`);
            } else {
                console.log(`⚠️ Ping failed with status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Ping error: ${error.message}`);
        }
    }, 4 * 60 * 1000 + 50 * 1000);
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    startAutoPing();
});