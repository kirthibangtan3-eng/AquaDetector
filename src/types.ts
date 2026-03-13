export type FlowStatus = 'flowing' | 'no-flow' | 'offline';
export type AlertType = 'no-flow' | 'predictive-maintenance' | 'offline';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Location {
  lat: number;
  lng: number;
}

export interface Sensor {
  id: string;
  location: Location;
  status: FlowStatus;
  lastUpdate: string;
  battery: number;
  section: string;
  isMaintenanceMode: boolean;
  pressure: number;
  flowRate: number;
  temperature: number;
}

export interface FlowReading {
  sensorId: string;
  flowRate: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  sensorId: string;
  type: AlertType;
  severity: Severity;
  message: string;
  location: Location;
  timestamp: string;
  resolved: boolean;
  predictionDetails?: {
    riskLevel: string;
    recommendation: string;
    confidence: number;
  };
}
