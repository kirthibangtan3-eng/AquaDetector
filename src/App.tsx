import React, { useState, useEffect, useMemo } from "react";
import { 
  Droplets, 
  Map as MapIcon, 
  AlertTriangle, 
  Settings, 
  Activity, 
  ShieldAlert,
  Search,
  Plus,
  Bell,
  User,
  ChevronRight,
  BarChart3,
  MapPin,
  Battery,
  Clock,
  LogOut,
  Thermometer,
  Gauge,
  Wind,
  CheckCircle2,
  XCircle,
  Info,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Power,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Sensor, Alert, FlowReading } from "./types";
import { getSensors, getAlerts, triggerPredictiveAnalysis, toggleMaintenanceMode, getSensorReadings } from "./services/sensorService";
import { APP_NAME } from "./constants";
import { auth, db } from "./firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

// Fix Leaflet icon issue
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`${className} bg-white rounded-xl flex items-center justify-center shadow-lg border-2 border-blue-600 relative overflow-hidden group`}>
    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-10"></div>
    <Droplets className="w-6 h-6 text-blue-600 relative z-10" />
    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'map' | 'alerts' | 'settings' | 'history'>('home');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [systemMode, setSystemMode] = useState<'manual-on' | 'manual-off' | 'automatic'>('automatic');
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'info' | 'alert'}[]>([]);

  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setNotifications(prev => [
      { id: Date.now().toString(), message: `Alert ${alertId} resolved.`, type: 'info' },
      ...prev.slice(0, 4)
    ]);
  };

  const handleResolveAllAlerts = () => {
    setAlerts([]);
    setNotifications(prev => [
      { id: Date.now().toString(), message: `All alerts resolved.`, type: 'info' },
      ...prev.slice(0, 4)
    ]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sensorData, alertData] = await Promise.all([
          getSensors(),
          getAlerts()
        ]);
        setSensors(sensorData);
        setAlerts(alertData);
        
        // Add a notification if there are new alerts
        if (alertData.length > 0) {
          const newAlert = alertData[0];
          setNotifications(prev => [
            { id: Date.now().toString(), message: `New alert: ${newAlert.message}`, type: 'alert' },
            ...prev.slice(0, 4)
          ]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('home');
  };

  const handleAnalyze = async (sensorId: string) => {
    setIsAnalyzing(true);
    setPrediction(null);
    try {
      const result = await triggerPredictiveAnalysis(sensorId);
      setPrediction(result.analysis);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleMaintenance = async (sensorId: string, enabled: boolean) => {
    try {
      await toggleMaintenanceMode(sensorId, enabled);
      setSensors(prev => prev.map(s => s.id === sensorId ? { ...s, isMaintenanceMode: enabled } : s));
      if (selectedSensor && selectedSensor.id === sensorId) {
        setSelectedSensor({ ...selectedSensor, isMaintenanceMode: enabled });
      }
    } catch (error) {
      console.error("Failed to toggle maintenance mode:", error);
    }
  };

  const activeAlerts = alerts.filter(alert => {
    const sensor = sensors.find(s => s.id === alert.sensorId);
    return !sensor?.isMaintenanceMode;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-blue-600">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Droplets className="w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <Logo />
          <h1 className="font-bold text-xl tracking-tight text-blue-900">AquaDetector</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavItem 
            icon={<Activity className="w-5 h-5" />} 
            label="Home" 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
          />
          <NavItem 
            icon={<BarChart3 className="w-5 h-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Clock className="w-5 h-5" />} 
            label="History" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <NavItem 
            icon={<MapIcon className="w-5 h-5" />} 
            label="Map View" 
            active={activeTab === 'map'} 
            onClick={() => setActiveTab('map')} 
          />
          <NavItem 
            icon={<AlertTriangle className="w-5 h-5" />} 
            label="Alerts" 
            active={activeTab === 'alerts'} 
            badge={activeAlerts.length}
            onClick={() => setActiveTab('alerts')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          {user ? (
            <>
              <NavItem icon={<Settings className="w-5 h-5" />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-black uppercase tracking-widest text-sm"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 font-black uppercase tracking-widest text-sm"
            >
              <User className="w-5 h-5" />
              <span>Login / Signup</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 w-96">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search sensors, sections, or alerts..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
              <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
              
              {/* Notifications Dropdown */}
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Notifications</h3>
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-3 rounded-xl text-xs flex gap-3 ${n.type === 'alert' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {n.type === 'alert' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
                      <p className="font-medium">{n.message}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-center py-4 text-slate-400 text-xs font-medium">No new notifications</p>
                  )}
                </div>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-900">{user.displayName || user.email}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Operator</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-md">
                  <User className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto space-y-12 py-8"
              >
                {/* Hero Section */}
                <div className="text-center space-y-6">
                  <motion.div 
                    initial={{ scale: 0.8, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="inline-block p-6 bg-white rounded-[2rem] shadow-2xl shadow-blue-100 border-2 border-blue-600 mb-4"
                  >
                    <Droplets className="w-16 h-16 text-blue-600" />
                  </motion.div>
                  <h1 className="text-6xl font-black text-blue-900 tracking-tight">AquaDetector</h1>
                  <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
                    Intelligent water infrastructure monitoring. Real-time pressure, flow, and temperature tracking for a safer tomorrow.
                  </p>
                  
                  {!user && (
                    <div className="flex items-center justify-center gap-4 pt-4">
                      <button 
                        onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                        className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-105 transition-all"
                      >
                        Get Started Free
                      </button>
                      <button 
                        onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                        className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
                      >
                        Sign In
                      </button>
                    </div>
                  )}
                </div>

                {/* System Controls */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-2xl font-black text-blue-900 mb-2">System Operation Mode</h2>
                      <p className="text-slate-400 text-sm font-medium">Control the pipeline network behavior</p>
                    </div>
                    <div className="flex bg-slate-100 p-2 rounded-2xl gap-2">
                      <ModeButton 
                        active={systemMode === 'manual-on'} 
                        onClick={() => setSystemMode('manual-on')}
                        label="Manual ON"
                        icon={<Power className="w-4 h-4" />}
                      />
                      <ModeButton 
                        active={systemMode === 'manual-off'} 
                        onClick={() => setSystemMode('manual-off')}
                        label="Manual OFF"
                        icon={<Power className="w-4 h-4" />}
                      />
                      <ModeButton 
                        active={systemMode === 'automatic'} 
                        onClick={() => setSystemMode('automatic')}
                        label="Automatic"
                        icon={<Zap className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-8">
                    <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center text-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${systemMode === 'manual-on' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}>
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-black text-blue-900 uppercase tracking-widest text-xs">Manual ON</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Force all valves open and bypass automatic sensors.</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center text-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${systemMode === 'manual-off' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}>
                        <XCircle className="w-6 h-6" />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Manual OFF</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Shut down all distribution lines immediately.</p>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col items-center text-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${systemMode === 'automatic' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>
                        <Zap className="w-6 h-6" />
                      </div>
                      <h3 className="font-black text-emerald-900 uppercase tracking-widest text-xs">Automatic</h3>
                      <p className="text-[10px] text-slate-500 font-medium">AI-driven management based on real-time sensor data.</p>
                    </div>
                  </div>
                </div>

                {/* Quick Access */}
                <div className="grid grid-cols-3 gap-8">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-100 hover:scale-105 transition-all text-left group"
                  >
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-blue-900 mb-2">Live Dashboard</h3>
                    <p className="text-xs text-slate-400 font-medium">Real-time network monitoring and analytics.</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('map')}
                    className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-100 hover:scale-105 transition-all text-left group"
                  >
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <MapIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-blue-900 mb-2">Map Interface</h3>
                    <p className="text-xs text-slate-400 font-medium">Geospatial tracking of all sensor nodes.</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-100 hover:scale-105 transition-all text-left group"
                  >
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-blue-900 mb-2">Past Dashboard</h3>
                    <p className="text-xs text-slate-400 font-medium">Historical data and performance trends.</p>
                  </button>
                </div>

                {/* Safety Precautions */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-blue-900">Safety Precautions</h2>
                    <span className="px-4 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest">Critical Guidelines</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <SafetyCard 
                      image="https://picsum.photos/seed/safety1/800/600"
                      title="High Pressure Zones"
                      desc="Never attempt maintenance on active lines without depressurizing. Always check the dashboard pressure readings before field work."
                    />
                    <SafetyCard 
                      image="https://picsum.photos/seed/safety2/800/600"
                      title="PPE Requirements"
                      desc="All field engineers must wear high-visibility vests, hard hats, and insulated gloves when interacting with IoT sensor nodes."
                    />
                  </div>
                </div>

                {/* App Features */}
                <div className="grid grid-cols-3 gap-8">
                  <FeatureCard 
                    icon={<Gauge className="w-8 h-8" />}
                    title="Pressure Tracking"
                    desc="Real-time PSI monitoring across all pipeline segments."
                  />
                  <FeatureCard 
                    icon={<Wind className="w-8 h-8" />}
                    title="Flow Analysis"
                    desc="Precise flow rate measurement in liters per minute."
                  />
                  <FeatureCard 
                    icon={<Thermometer className="w-8 h-8" />}
                    title="Thermal Monitoring"
                    desc="Detect pipe stress through temperature fluctuations."
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              user ? (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-blue-900">Network Overview</h2>
                    <div className="flex gap-4">
                      <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-sm">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600">System Online</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-6">
                    <StatCard 
                      title="Total Sensors" 
                      value={sensors.length} 
                      icon={<Activity className="text-blue-500" />} 
                      trend="+2 this month" 
                    />
                    <StatCard 
                      title="Avg Pressure" 
                      value={`${(sensors.reduce((acc, s) => acc + s.pressure, 0) / sensors.length).toFixed(1)} PSI`} 
                      icon={<Gauge className="text-blue-600" />} 
                      trend="Stable" 
                    />
                    <StatCard 
                      title="Total Flow" 
                      value={`${sensors.reduce((acc, s) => acc + s.flowRate, 0).toFixed(1)} L/m`} 
                      icon={<Droplets className="text-blue-600" />} 
                      trend="Normal" 
                    />
                    <StatCard 
                      title="Active Alerts" 
                      value={activeAlerts.length} 
                      icon={<AlertTriangle className="text-red-500" />} 
                      trend={`${activeAlerts.filter(a => a.severity === 'critical').length} critical`} 
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                    {/* Sensor List */}
                    <div className="col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-blue-900">Pipeline Sensors</h2>
                        <button className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline">
                          <Plus className="w-3 h-3" /> Register New
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {sensors.map(sensor => (
                          <div key={sensor.id}>
                            <SensorRow 
                              sensor={sensor} 
                              onClick={() => setSelectedSensor(sensor)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Alerts */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-blue-900">Recent Alerts</h2>
                      <div className="space-y-3">
                        {activeAlerts.map(alert => (
                          <div key={alert.id}>
                            <AlertCard alert={alert} />
                          </div>
                        ))}
                        {activeAlerts.length === 0 && (
                          <div className="p-12 text-center bg-white rounded-[2rem] border border-slate-200">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">All Systems Normal</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <LoginRequired onLogin={() => { setAuthMode('login'); setShowAuthModal(true); }} />
              )
            )}

            {activeTab === 'history' && (
              user ? (
                <HistoryView sensors={sensors} />
              ) : (
                <LoginRequired onLogin={() => { setAuthMode('login'); setShowAuthModal(true); }} />
              )
            )}

            {activeTab === 'map' && (
              user ? (
                <motion.div 
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full rounded-[3rem] border border-slate-200 bg-white overflow-hidden relative shadow-2xl"
                >
                  <MapContainer 
                    center={[40.72, -74.01]} 
                    zoom={13} 
                    className="h-full w-full"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {sensors.map(sensor => (
                      <Marker 
                        key={sensor.id} 
                        position={[sensor.location.lat, sensor.location.lng]}
                        icon={L.divIcon({
                          className: 'custom-div-icon',
                          html: `<div class="w-8 h-8 rounded-full border-4 border-white shadow-xl flex items-center justify-center ${
                            sensor.status === 'flowing' ? 'bg-emerald-500' : 
                            sensor.status === 'no-flow' ? 'bg-red-500' : 'bg-slate-400'
                          }">
                            <div class="w-2 h-2 bg-white rounded-full animate-ping"></div>
                          </div>`,
                          iconSize: [32, 32],
                          iconAnchor: [16, 16]
                        })}
                      >
                        <Popup>
                          <div className="p-4 min-w-[200px] space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <h3 className="font-black text-blue-900 uppercase tracking-widest text-xs">{sensor.id}</h3>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                sensor.status === 'flowing' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                              }`}>{sensor.status}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-50 p-2 rounded-lg">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Pressure</p>
                                <p className="text-xs font-black text-blue-900">{sensor.pressure.toFixed(1)} PSI</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Flow</p>
                                <p className="text-xs font-black text-blue-900">{sensor.flowRate.toFixed(1)} L/m</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedSensor(sensor)}
                              className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100"
                            >
                              View Details
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>

                  <div className="absolute top-6 right-6 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl space-y-2">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span>Normal Flow</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span>No Flow Detected</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                      <span>Offline</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <LoginRequired onLogin={() => { setAuthMode('login'); setShowAuthModal(true); }} />
              )
            )}

            {activeTab === 'alerts' && (
              user ? (
                <motion.div 
                  key="alerts"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-4xl mx-auto space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-blue-900">System Alerts</h2>
                    <button 
                      onClick={handleResolveAllAlerts}
                      className="px-6 py-2 bg-slate-100 text-slate-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Mark All Resolved
                    </button>
                  </div>

                  <div className="space-y-4">
                    {activeAlerts.map(alert => (
                      <div key={alert.id}>
                        <AlertCard alert={alert} onResolve={() => handleResolveAlert(alert.id)} />
                      </div>
                    ))}
                    {activeAlerts.length === 0 && (
                      <div className="p-20 text-center bg-white rounded-[3rem] border border-slate-200">
                        <ShieldAlert className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-blue-900 mb-2">No Active Alerts</h3>
                        <p className="text-slate-400 font-medium">Your pipeline network is currently secure.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <LoginRequired onLogin={() => { setAuthMode('login'); setShowAuthModal(true); }} />
              )
            )}

            {activeTab === 'settings' && user && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <h2 className="text-3xl font-black text-blue-900">Settings</h2>
                
                <div className="bg-white rounded-[2rem] border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xl shadow-slate-100">
                  <SettingsItem 
                    title="Profile Information" 
                    desc="Update your name and account details"
                    icon={<User className="w-5 h-5" />}
                  />
                  <SettingsItem 
                    title="Notification Preferences" 
                    desc="Configure how you receive system alerts"
                    icon={<Bell className="w-5 h-5" />}
                  />
                  <SettingsItem 
                    title="Security & Privacy" 
                    desc="Manage your password and session"
                    icon={<Lock className="w-5 h-5" />}
                  />
                  <SettingsItem 
                    title="API Integration" 
                    desc="Access keys for third-party hardware"
                    icon={<Zap className="w-5 h-5" />}
                  />
                </div>

                <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 space-y-4">
                  <h3 className="text-red-600 font-black uppercase tracking-widest text-xs">Danger Zone</h3>
                  <button className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-100">
                    Delete Account
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Sensor Detail Modal */}
      <AnimatePresence>
        {selectedSensor && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-8 bg-blue-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <h2 className="text-5xl font-black text-blue-900 tracking-tight">{selectedSensor.id}</h2>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      selectedSensor.status === 'flowing' ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 
                      'bg-red-100 text-red-600 border border-red-200'
                    }`}>
                      {selectedSensor.status}
                    </span>
                  </div>
                  <p className="text-slate-400 flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                    <MapPin className="w-4 h-4 text-blue-600" /> {selectedSensor.section}
                  </p>
                </div>
                <button 
                  onClick={() => { setSelectedSensor(null); setPrediction(null); }}
                  className="p-4 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all shadow-lg border border-slate-200"
                >
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-3 gap-10">
                <div className="col-span-2 space-y-10">
                  {/* Real-time Data Grid */}
                  <div className="grid grid-cols-3 gap-6">
                    <DataCard 
                      label="Pressure" 
                      value={`${selectedSensor.pressure.toFixed(1)} PSI`} 
                      icon={<Gauge className="w-5 h-5" />}
                      color="blue"
                    />
                    <DataCard 
                      label="Flow Rate" 
                      value={`${selectedSensor.flowRate.toFixed(1)} L/m`} 
                      icon={<Wind className="w-5 h-5" />}
                      color="emerald"
                    />
                    <DataCard 
                      label="Temperature" 
                      value={`${selectedSensor.temperature.toFixed(1)}°C`} 
                      icon={<Thermometer className="w-5 h-5" />}
                      color="amber"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-3">Battery Health</p>
                      <div className="flex items-center gap-3">
                        <Battery className={`w-6 h-6 ${selectedSensor.battery < 20 ? 'text-red-500' : 'text-emerald-500'}`} />
                        <span className="text-3xl font-black text-blue-900">{selectedSensor.battery}%</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-3">Last Sync</p>
                      <div className="flex items-center gap-3">
                        <Clock className="w-6 h-6 text-blue-600" />
                        <span className="text-2xl font-black text-blue-900">{new Date(selectedSensor.lastUpdate).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow History Graph Placeholder */}
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-10 h-80 flex flex-col shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">Flow Rate History (24h)</h3>
                      <div className="flex gap-3 items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Liters/min</span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-end gap-2">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-blue-100 rounded-t-xl hover:bg-blue-600 transition-all cursor-help"
                          style={{ height: `${Math.random() * 80 + 10}%` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-200">
                    <h3 className="text-xs font-black mb-8 flex items-center gap-3 uppercase tracking-widest">
                      <ShieldAlert className="w-6 h-6" />
                      AI Predictive Analysis
                    </h3>
                    
                    {!prediction && !isAnalyzing && (
                      <button 
                        onClick={() => handleAnalyze(selectedSensor.id)}
                        className="w-full py-5 bg-white text-blue-600 hover:bg-blue-50 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl"
                      >
                        Run Analysis
                      </button>
                    )}

                    {isAnalyzing && (
                      <div className="flex flex-col items-center gap-6 py-6">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Activity className="w-10 h-10 text-white" />
                        </motion.div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Processing Data...</p>
                      </div>
                    )}

                    {prediction && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Risk Level</span>
                          <span className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase ${
                            prediction.riskLevel === 'high' ? 'bg-red-500 text-white' : 
                            prediction.riskLevel === 'medium' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-white'
                          }`}>
                            {prediction.riskLevel}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Predicted Issue</p>
                          <p className="text-base font-bold leading-relaxed">{prediction.predictedIssue}</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Recommendation</p>
                          <p className="text-sm text-blue-50 font-medium leading-relaxed italic">"{prediction.recommendation}"</p>
                        </div>
                        <div className="pt-8 border-t border-blue-500 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Confidence</span>
                          <span className="text-lg font-black">{(prediction.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-[3rem] p-10 shadow-sm">
                    <h3 className="text-xs font-black text-blue-900 mb-8 uppercase tracking-widest">Maintenance Control</h3>
                    <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Maintenance Mode</span>
                      <div 
                        onClick={() => handleToggleMaintenance(selectedSensor.id, !selectedSensor.isMaintenanceMode)}
                        className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${selectedSensor.isMaintenanceMode ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <motion.div 
                          animate={{ x: selectedSensor.isMaintenanceMode ? 28 : 4 }}
                          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-8 bg-blue-900/60 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-8 right-8 p-3 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              <div className="p-12 space-y-8">
                <div className="text-center space-y-4">
                  <Logo className="w-16 h-16 mx-auto" />
                  <h2 className="text-3xl font-black text-blue-900">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                  <p className="text-slate-400 text-sm font-medium">Access the AquaDetector network</p>
                </div>

                <AuthForm mode={authMode} onSuccess={() => setShowAuthModal(false)} />

                <div className="text-center">
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                  >
                    {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthForm({ mode, onSuccess }: { mode: 'login' | 'signup', onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          email,
          displayName: name,
          role: 'user'
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
      
      {mode === 'signup' && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 transition-colors text-sm font-medium"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 transition-colors text-sm font-medium"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 transition-colors text-sm font-medium"
          />
        </div>
      </div>

      <button 
        disabled={loading}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-[1.02] transition-all disabled:opacity-50"
      >
        {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Create Account'}
      </button>
    </form>
  );
}

function ModeButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: any }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SafetyCard({ image, title, desc }: { image: string, title: string, desc: string }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-lg group">
      <div className="h-48 overflow-hidden relative">
        <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <h3 className="absolute bottom-6 left-6 text-white font-black text-xl uppercase tracking-tight">{title}</h3>
      </div>
      <div className="p-8">
        <p className="text-slate-500 text-sm leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
      <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-black text-blue-900 mb-3 uppercase tracking-tight">{title}</h3>
      <p className="text-slate-400 text-sm font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function DataCard({ label, value, icon, color }: { label: string, value: string, icon: any, color: 'blue' | 'emerald' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };
  
  return (
    <div className={`${colors[color]} p-6 rounded-3xl border flex flex-col gap-3 shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function SettingsItem({ title, desc, icon }: { title: string, desc: string, icon: any }) {
  return (
    <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
          {icon}
        </div>
        <div>
          <h4 className="font-black text-blue-900 text-sm uppercase tracking-widest">{title}</h4>
          <p className="text-xs text-slate-400 font-medium">{desc}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-blue-600 transition-colors" />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${
        active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
      }`}
    >
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-sm font-black uppercase tracking-widest">{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string | number, icon: any, trend: string }) {
  return (
    <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{trend}</span>
      </div>
      <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest">{title}</p>
      <h3 className="text-4xl font-black text-blue-900 tracking-tight">{value}</h3>
    </div>
  );
}

function LoginRequired({ onLogin }: { onLogin: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto py-20 text-center space-y-8"
    >
      <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-blue-100 border-2 border-blue-600">
        <Lock className="w-10 h-10 text-blue-600" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-black text-blue-900 tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 font-medium leading-relaxed">
          Please sign in to your operator account to access real-time monitoring, maps, and system alerts.
        </p>
      </div>
      <button 
        onClick={onLogin}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-105 transition-all"
      >
        Login to Continue
      </button>
    </motion.div>
  );
}

function HistoryView({ sensors }: { sensors: Sensor[] }) {
  const [readings, setReadings] = useState<FlowReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensorId, setSelectedSensorId] = useState(sensors[0]?.id || '');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getSensorReadings(selectedSensorId);
        // Format data for Recharts
        const formattedData = data.map(r => ({
          ...r,
          time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          flow: r.flowRate
        })).reverse();
        setReadings(formattedData);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };
    if (selectedSensorId) fetchHistory();
  }, [selectedSensorId]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-blue-900">Past Dashboard</h2>
          <p className="text-slate-400 font-medium">Historical flow and pressure data</p>
        </div>
        <select 
          value={selectedSensorId}
          onChange={(e) => setSelectedSensorId(e.target.value)}
          className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
        >
          {sensors.map(s => (
            <option key={s.id} value={s.id}>{s.id} - {s.section}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Flow Rate History (L/m)</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Activity className="w-10 h-10 text-blue-600" />
              </motion.div>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={readings}>
                  <defs>
                    <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 900, color: '#1e3a8a' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="flow" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorFlow)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Avg Flow Rate</p>
            <h4 className="text-4xl font-black">
              {readings.length > 0 ? (readings.reduce((acc, r) => acc + r.flow, 0) / readings.length).toFixed(1) : '0.0'}
              <span className="text-sm ml-2 opacity-70">L/m</span>
            </h4>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Peak Flow</p>
            <h4 className="text-4xl font-black text-blue-900">
              {readings.length > 0 ? Math.max(...readings.map(r => r.flow)).toFixed(1) : '0.0'}
              <span className="text-sm ml-2 text-slate-400">L/m</span>
            </h4>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Detailed Log</h3>
        <div className="grid grid-cols-1 divide-y divide-slate-100">
          {readings.map((r, i) => (
            <div key={i} className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-blue-900">{new Date(r.timestamp).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Recorded Reading</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-blue-600">{r.flow.toFixed(2)} L/m</p>
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Flow Rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SensorRow({ sensor, onClick }: { sensor: Sensor, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-slate-200 p-6 rounded-[2.5rem] flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer group shadow-sm ${
        sensor.isMaintenanceMode ? 'opacity-75 grayscale-[0.2]' : ''
      }`}
    >
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          sensor.isMaintenanceMode ? 'bg-blue-50 text-blue-500' :
          sensor.status === 'flowing' ? 'bg-emerald-50 text-emerald-500' : 
          sensor.status === 'no-flow' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400'
        }`}>
          {sensor.isMaintenanceMode ? <Settings className="w-8 h-8" /> : <Droplets className="w-8 h-8" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-black text-blue-900 text-lg group-hover:text-blue-600 transition-colors tracking-tight">{sensor.id}</h4>
            {sensor.isMaintenanceMode && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black uppercase rounded tracking-widest">Maintenance</span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sensor.section}</p>
        </div>
      </div>

      <div className="flex items-center gap-12">
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Pressure</p>
          <p className="text-xs font-black text-blue-900">{sensor.pressure.toFixed(1)} PSI</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Flow</p>
          <p className="text-xs font-black text-blue-900">{sensor.flowRate.toFixed(1)} L/m</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Status</p>
          <p className={`text-xs font-black uppercase tracking-widest ${
            sensor.isMaintenanceMode ? 'text-blue-500' :
            sensor.status === 'flowing' ? 'text-emerald-500' : 
            sensor.status === 'no-flow' ? 'text-red-500' : 'text-slate-400'
          }`}>{sensor.isMaintenanceMode ? 'Maintenance' : sensor.status}</p>
        </div>
        <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-blue-600 transition-colors" />
      </div>
    </div>
  );
}

function AlertCard({ alert, onResolve }: { alert: Alert, onResolve?: () => void }) {
  return (
    <div className={`p-6 rounded-[2.5rem] border flex gap-6 shadow-sm ${
      alert.severity === 'high' || alert.severity === 'critical' 
        ? 'bg-red-50 border-red-100' 
        : 'bg-amber-50 border-amber-100'
    }`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
        alert.severity === 'high' || alert.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
      }`}>
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{alert.sensorId}</h4>
          <span className="text-[10px] font-bold text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-xs font-bold text-slate-700 leading-relaxed">{alert.message}</p>
        <div className="flex items-center gap-4 pt-2">
          <button className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest">
            View Details
          </button>
          {onResolve && (
            <button 
              onClick={onResolve}
              className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-widest"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
