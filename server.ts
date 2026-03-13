import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeFlowPatterns } from "./src/services/predictiveService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "AquaGuard Backend Running" });
  });

  // Predictive maintenance endpoint
  app.post("/api/analyze-flow", async (req, res) => {
    const { sensorId } = req.body;
    
    // In a real app, we would fetch historical data from Firestore here
    // For now, we'll generate some mock historical data to pass to Gemini
    const mockHistoricalData = Array.from({ length: 15 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 86400000).toISOString(),
      flowRate: 100 - (i * 2) + (Math.random() * 5) // Simulating a slow decline
    }));

    try {
      const analysis = await analyzeFlowPatterns(sensorId, mockHistoricalData);
      
      res.json({
        sensorId,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to perform predictive analysis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
