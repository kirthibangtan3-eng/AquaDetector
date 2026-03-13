export const APP_NAME = "AquaDetector";
export const REFRESH_INTERVAL = 5000; // 5 seconds

export const SECTIONS = [
  "Main Supply Line A",
  "Secondary Distribution B",
  "Residential Zone C",
  "Industrial Sector D",
  "Agricultural Feed E"
];

export const MOCK_SENSORS = [
  {
    id: "SN-001",
    location: { lat: 40.7128, lng: -74.0060 },
    status: "flowing",
    lastUpdate: new Date().toISOString(),
    battery: 85,
    section: "Main Supply Line A",
    isMaintenanceMode: false,
    pressure: 45.2,
    flowRate: 12.5,
    temperature: 18.4
  },
  {
    id: "SN-002",
    location: { lat: 40.7228, lng: -74.0160 },
    status: "no-flow",
    lastUpdate: new Date().toISOString(),
    battery: 92,
    section: "Secondary Distribution B",
    isMaintenanceMode: false,
    pressure: 12.1,
    flowRate: 0.0,
    temperature: 19.2
  },
  {
    id: "SN-003",
    location: { lat: 40.7328, lng: -74.0260 },
    status: "offline",
    lastUpdate: new Date().toISOString(),
    battery: 45,
    section: "Residential Zone C",
    isMaintenanceMode: false,
    pressure: 0.0,
    flowRate: 0.0,
    temperature: 17.8
  }
];
