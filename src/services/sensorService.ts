import { Sensor, FlowReading, Alert } from "../types";
import { MOCK_SENSORS } from "../constants";

// This service will eventually use Firebase
// For now, it provides mock data and simulation logic

export async function getSensors(): Promise<Sensor[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Simulate real-time status changes for demo purposes
  return MOCK_SENSORS.map(sensor => {
    if (sensor.isMaintenanceMode) return sensor;
    
    // Simulate slight fluctuations in pressure, flow, and temp
    const pressureDelta = (Math.random() - 0.5) * 2;
    const flowDelta = (Math.random() - 0.5) * 1;
    const tempDelta = (Math.random() - 0.5) * 0.5;

    // 10% chance to change status randomly
    let status = sensor.status;
    if (Math.random() > 0.9) {
      const statuses: Sensor['status'][] = ['flowing', 'no-flow', 'offline'];
      status = statuses[Math.floor(Math.random() * statuses.length)];
    }

    return {
      ...sensor,
      status,
      pressure: Math.max(0, sensor.pressure + pressureDelta),
      flowRate: status === 'flowing' ? Math.max(0, sensor.flowRate + flowDelta) : 0,
      temperature: sensor.temperature + tempDelta,
      lastUpdate: new Date().toISOString()
    };
  }) as Sensor[];
}

export async function getSensorReadings(sensorId: string): Promise<FlowReading[]> {
  // Generate some random historical data
  const readings: FlowReading[] = [];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    readings.push({
      sensorId,
      flowRate: Math.random() * 100 + 50,
      timestamp: new Date(now - i * 3600000).toISOString()
    });
  }
  return readings;
}

export async function getAlerts(): Promise<Alert[]> {
  return [
    {
      id: "AL-001",
      sensorId: "SN-002",
      type: "no-flow",
      severity: "high",
      message: "No water flow detected for over 2 minutes",
      location: { lat: 40.7228, lng: -74.0160 },
      timestamp: new Date().toISOString(),
      resolved: false
    }
  ];
}

export async function triggerPredictiveAnalysis(sensorId: string) {
  const response = await fetch('/api/analyze-flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensorId })
  });
  return response.json();
}

export async function toggleMaintenanceMode(sensorId: string, enabled: boolean): Promise<void> {
  // In a real app, this would update Firestore
  // For now, we just simulate the API call
  console.log(`Setting maintenance mode for ${sensorId} to ${enabled}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
