
import React, { useState, useEffect } from 'react';
import { dbService } from './services/db';
import { AppDatabase, ViewMode, Role, Employee, Job, WorkLog, AttendanceRecord, Vehicle, GlobalSettings } from './types';
import AttendanceKiosk from './components/AttendanceKiosk';
import VehicleKiosk from './components/VehicleKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import AdminDashboard from './components/AdminDashboard';
import { Users, Truck, LayoutDashboard, Hammer } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('STARTUP_SELECT');
  const [data, setData] = useState<AppDatabase | null>(null);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dbData = await dbService.getAllData();
        setData(dbData);
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAutoBackup = async () => {
    if (!data || !data.settings) return;
    const settings = data.settings;
    try {
        const exportData = await dbService.exportDatabase();
        
        if (settings.backupWebhookUrl) {
            console.log("Sending backup to Webhook...");
            
            const blob = new Blob([exportData], { type: 'application/json' });
            const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
            
            const formData = new FormData();
            // Invio SOLO il file fisico
            formData.append('file', blob, filename);
            formData.append('type', 'auto_backup');

            await fetch(settings.backupWebhookUrl, {
                method: 'POST',
                body: formData
            });
            console.log("Backup inviato al Cloud con successo.");
        } else {
            // Fallback to Local Download
            const blob = new Blob([exportData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_alea_AUTO_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            console.log("Backup Automatico Locale Eseguito (Nessun Webhook)");
        }
    } catch (e) {
        console.error("Auto Backup Failed", e);
    }
  };

  const updateSettings = async (newSettings: GlobalSettings) => {
    await dbService.saveSettings(newSettings);
    if (data) {
      setData({ ...data, settings: newSettings });
    }
  };

  const handleAttendanceRecord = async (record: AttendanceRecord) => {
    await dbService.saveAttendance(record);
    if(data) {
        setData({...data, attendance: [...data.attendance, record]});
    }
  };

  const handleVehicleAction = async (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => {
      const updatedVehicle = { ...vehicle, status: type === 'CHECK_OUT' ? 'IN_USE' : 'AVAILABLE', currentDriverId: type === 'CHECK_OUT' ? employee.id : undefined } as Vehicle;
      await dbService.saveVehicle(updatedVehicle);
      if(data) {
          const updatedVehicles = data.vehicles.map(v => v.id === vehicle.id ? updatedVehicle : v);
          setData({...data, vehicles: updatedVehicles});
      }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-600 font-bold">Caricamento Sistema...</div>;
  if (!data) return <div className="h-screen flex items-center justify-center text-red-600 font-bold">Errore Caricamento Dati. Controlla connessione.</div>;

  const renderView = () => {
    switch (viewMode) {
      case 'ATTENDANCE_KIOSK':
        return (
          <AttendanceKiosk 
            employees={data.employees}
            onRecord={handleAttendanceRecord}
            onExit={() => setViewMode('STARTUP_SELECT')}
            nfcEnabled={data.settings.nfcEnabled}
          />
        );
      case 'VEHICLE_KIOSK':
         return (
             <VehicleKiosk
                employees={data.employees}
                vehicles={data.vehicles}
                onAction={handleVehicleAction}
                onExit={() => setViewMode('STARTUP_SELECT')}
                nfcEnabled={data.settings.nfcEnabled}
             />
         );
      case 'WORKSHOP_PANEL':
         if (!currentUser) return (
             <div className="h-screen flex flex-col items-center justify-center gap-4">
                 <p className="text-xl">Nessun Utente Loggato</p>
                 <button onClick={() => setViewMode('STARTUP_SELECT')} className="text-blue-500 underline">Torna alla Home</button>
             </div>
         );
         return (
             <WorkshopPanel
                currentUser={currentUser}
                jobs={data.jobs}
                logs={data.logs}
                onAddLog={async (l) => {
                    await dbService.saveWorkLog(l);
                    setData({...data, logs: [...data.logs, l]});
                }}
                onDeleteLog={async (id) => {
                    await dbService.deleteWorkLog(id);
                    setData({...data, logs: data.logs.filter(l => l.id !== id)});
                }}
                onUpdateLog={async (l) => {
                     await dbService.saveWorkLog(l);
                     setData({...data, logs: data.logs.map(log => log.id === l.id ? l : log)});
                }}
                workPhases={data.settings.workPhases}
                onUpdateJobStatus={async (jid, status) => {
                    const job = data.jobs.find(j => j.id === jid);
                    if(job) {
                        const updated = {...job, status};
                        await dbService.saveJob(updated);
                        setData({...data, jobs: data.jobs.map(j => j.id === jid ? updated : j)});
                    }
                }}
             />
         );
      case 'DASHBOARD':
         return (
             <AdminDashboard 
                settings={data.settings}
                onUpdateSettings={updateSettings}
             />
         );
      case 'LOGIN':
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-200">
                    <h2 className="text-2xl font-bold mb-6 text-slate-800 text-center">Login Operatore</h2>
                     <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                         {data.employees
                            .filter(e => e.role !== Role.SYSTEM_ADMIN && e.role !== Role.DIRECTION)
                            .map(e => (
                             <button key={e.id} onClick={() => { setCurrentUser(e); setViewMode('WORKSHOP_PANEL'); }} className="w-full p-4 text-left hover:bg-slate-50 border border-slate-200 rounded-lg transition group">
                                 <span className="font-bold text-slate-700 group-hover:text-[#EC1D25]">{e.name}</span>
                                 <div className="text-xs text-slate-400 uppercase">{e.role}</div>
                             </button>
                         ))}
                     </div>
                     <button onClick={() => setViewMode('STARTUP_SELECT')} className="mt-6 w-full py-3 text-sm text-slate-500 hover:text-slate-800 transition">Indietro</button>
                </div>
            </div>
        );
      case 'STARTUP_SELECT':
      default:
        return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full">
              <button onClick={() => setViewMode('ATTENDANCE_KIOSK')} className="bg-white p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition flex flex-col items-center gap-6 border-b-8 border-blue-500 group">
                <div className="p-6 bg-blue-50 rounded-full group-hover:bg-blue-100 transition">
                    <Users size={64} className="text-blue-500" />
                </div>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-wide">Totem Presenze</span>
              </button>
              
              <button onClick={() => setViewMode('VEHICLE_KIOSK')} className="bg-white p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition flex flex-col items-center gap-6 border-b-8 border-orange-500 group">
                <div className="p-6 bg-orange-50 rounded-full group-hover:bg-orange-100 transition">
                    <Truck size={64} className="text-orange-500" />
                </div>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-wide">Totem Mezzi</span>
              </button>
              
               <button onClick={() => setViewMode('LOGIN')} className="bg-white p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition flex flex-col items-center gap-6 border-b-8 border-green-500 group">
                <div className="p-6 bg-green-50 rounded-full group-hover:bg-green-100 transition">
                    <Hammer size={64} className="text-green-500" />
                </div>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-wide">Pannello Officina</span>
              </button>
              
               <button onClick={() => setViewMode('DASHBOARD')} className="bg-white p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition flex flex-col items-center gap-6 border-b-8 border-purple-500 group">
                <div className="p-6 bg-purple-50 rounded-full group-hover:bg-purple-100 transition">
                    <LayoutDashboard size={64} className="text-purple-500" />
                </div>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-wide">Dashboard Admin</span>
              </button>
            </div>
          </div>
        );
    }
  };

  return renderView();
}

export default App;
