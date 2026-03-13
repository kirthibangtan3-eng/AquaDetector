import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FlowDataPoint {
  timestamp: string;
  flowRate: number;
}

export interface PredictionResult {
  riskLevel: 'low' | 'medium' | 'high';
  predictedIssue: string;
  recommendation: string;
  confidence: number;
}

export async function analyzeFlowPatterns(sensorId: string, historicalData: FlowDataPoint[]): Promise<PredictionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = `
    Analyze the following historical water flow data for sensor ${sensorId}.
    Identify patterns that might indicate future pipe blockages, leaks, or mechanical failures.
    
    Data (Timestamp, FlowRate):
    ${historicalData.map(d => `${d.timestamp}: ${d.flowRate}`).join('\n')}
    
    Provide a JSON response with the following fields:
    - riskLevel: "low", "medium", or "high"
    - predictedIssue: A brief description of the potential problem (e.g., "Gradual decrease in flow suggests sediment buildup")
    - recommendation: Actionable advice for maintenance
    - confidence: A number between 0 and 1
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      riskLevel: result.riskLevel || 'low',
      predictedIssue: result.predictedIssue || 'No issues detected',
      recommendation: result.recommendation || 'Continue normal monitoring',
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("Error analyzing flow patterns:", error);
    return {
      riskLevel: 'low',
      predictedIssue: 'Analysis failed',
      recommendation: 'Manual inspection recommended',
      confidence: 0,
    };
  }
}
