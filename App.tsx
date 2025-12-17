
import React, { useState, useEffect } from 'react';
import { dbService } from './services/db';
import { AppDatabase, ViewMode, Employee, AttendanceRecord, WorkLog, Vehicle, JobStatus, GlobalSettings } from './types';
import AttendanceKiosk from './components/AttendanceKiosk';
import VehicleKiosk from './components/VehicleKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import AdminDashboard from './components/AdminDashboard';
import { Users, Truck, LayoutDashboard, Wrench, RefreshCw, Power } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<AppDatabase | null>(null);
  const [view, setView] = useState<ViewMode>('STARTUP_SELECT');
  const [loading, setLoading] = useState(true);
  
  // Workshop User Session
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const dbData = await dbService.getAllData();
        setData(dbData);
    } catch (e) {
        console.error("Init failed", e);
    } finally {
        setLoading(false);
    }
  };

  const handleAutoBackup = async () => {
      if (!data?.settings) return;
      const settings = data.settings;

      try {
          const exportData = await dbService.exportDatabase();
          
          if (settings.backupWebhookUrl) {
              console.log("Sending backup to Webhook...");
              
              // FOR PABBLY: Send as text/plain Blob AND as a raw string field ('json_content')
              const blob = new Blob([exportData], { type: 'text/plain' });
              const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
              
              const formData = new FormData();
              formData.append('file', blob, filename);
              formData.append('filename', filename);
              formData.append('json_content', exportData); // CAMPO CHIAVE PER PABBLY
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

  const handleAttendance = async (record: AttendanceRecord) => {
    await dbService.saveAttendance(record);
    await loadData(); // Refresh to update logs/state if needed
  };

  const handleVehicleAction = async (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => {
      const updatedVehicle = { ...vehicle };
      if (type === 'CHECK_OUT') {
          updatedVehicle.status = 'IN_USE';
          updatedVehicle.currentDriverId = employee.id;
          updatedVehicle.lastCheckOut = new Date().toISOString();
      } else {
          updatedVehicle.status = 'AVAILABLE';
          updatedVehicle.currentDriverId = undefined;
      }
      
      const log = {
          id: Date.now().toString(),
          vehicleId: vehicle.id,
          employeeId: employee.id,
          timestampOut: type === 'CHECK_OUT' ? new Date().toISOString() : vehicle.lastCheckOut || new Date().toISOString(),
          timestampIn: type === 'CHECK_IN' ? new Date().toISOString() : undefined
      };

      await dbService.saveVehicle(updatedVehicle);
      await dbService.saveVehicleLog(log);
      await loadData();
  };

  const handleWorkLog = async (log: WorkLog) => {
      await dbService.saveWorkLog(log);
      await loadData();
      // Trigger backup on work log if needed, or just periodically
  };

  const handleJobStatusUpdate = async (jobId: string, status: JobStatus) => {
      const job = data?.jobs.find(j => j.id === jobId);
      if (job) {
          await dbService.saveJob({ ...job, status });
          await loadData();
      }
  };

  const handleSettingsUpdate = async (newSettings: GlobalSettings) => {
      await dbService.saveSettings(newSettings);
      await loadData();
  }

  // Workshop User Login (Simplified for Fix)
  const handleWorkshopLogin = (emp: Employee) => {
      setCurrentUser(emp);
  };

  if (loading || !data) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
              <RefreshCw className="animate-spin text-[#EC1D25]" size={48} />
              <p className="text-slate-500 font-medium">Caricamento Sistema...</p>
          </div>
      );
  }

  // --- VIEW ROUTING ---

  if (view === 'STARTUP_SELECT') {
      return (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
              <div className="mb-12 text-center">
                  <h1 className="text-4xl font-black text-[#EC1D25] mb-2 tracking-tighter">ALEA SISTEMI</h1>
                  <p className="text-slate-500 font-bold tracking-widest uppercase">Portale Aziendale</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                  <button onClick={() => setView('ATTENDANCE_KIOSK')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition border-b-4 border-blue-500 flex flex-col items-center gap-4 group">
                      <div className="bg-blue-50 p-6 rounded-full group-hover:bg-blue-100 transition">
                          <Users size={48} className="text-blue-600"/>
                      </div>
                      <span className="text-2xl font-bold text-slate-700">Totem Presenze</span>
                  </button>

                  <button onClick={() => setView('VEHICLE_KIOSK')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition border-b-4 border-orange-500 flex flex-col items-center gap-4 group">
                      <div className="bg-orange-50 p-6 rounded-full group-hover:bg-orange-100 transition">
                          <Truck size={48} className="text-orange-600"/>
                      </div>
                      <span className="text-2xl font-bold text-slate-700">Gestione Mezzi</span>
                  </button>

                  <button onClick={() => setView('DASHBOARD')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition border-b-4 border-slate-700 flex flex-col items-center gap-4 group">
                       <div className="bg-slate-100 p-6 rounded-full group-hover:bg-slate-200 transition">
                          <LayoutDashboard size={48} className="text-slate-700"/>
                      </div>
                      <span className="text-2xl font-bold text-slate-700">Amministrazione</span>
                  </button>

                  <button onClick={() => setView('WORKSHOP_PANEL')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition border-b-4 border-[#EC1D25] flex flex-col items-center gap-4 group">
                       <div className="bg-red-50 p-6 rounded-full group-hover:bg-red-100 transition">
                          <Wrench size={48} className="text-[#EC1D25]"/>
                      </div>
                      <span className="text-2xl font-bold text-slate-700">Pannello Operativo</span>
                  </button>
              </div>
              
              <div className="mt-12 text-slate-400 text-sm font-mono">
                  v2.5.0 - Connected to Firebase
              </div>
          </div>
      );
  }

  if (view === 'ATTENDANCE_KIOSK') {
      return (
          <AttendanceKiosk 
            employees={data.employees} 
            onRecord={handleAttendance} 
            onExit={() => setView('STARTUP_SELECT')}
            nfcEnabled={data.settings.nfcEnabled}
          />
      );
  }

  if (view === 'VEHICLE_KIOSK') {
      return (
          <VehicleKiosk 
            employees={data.employees} 
            vehicles={data.vehicles}
            onAction={handleVehicleAction}
            onExit={() => setView('STARTUP_SELECT')}
            nfcEnabled={data.settings.nfcEnabled}
          />
      );
  }

  if (view === 'DASHBOARD') {
      return (
          <div className="relative">
              <button onClick={() => setView('STARTUP_SELECT')} className="absolute top-4 right-4 z-50 p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700">
                  <Power size={20} />
              </button>
              <AdminDashboard 
                data={data}
                onRefresh={loadData}
                onUpdateSettings={handleSettingsUpdate}
              />
          </div>
      );
  }

  if (view === 'WORKSHOP_PANEL') {
      if (!currentUser) {
          // Simple User Selection for Workshop
          return (
             <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
                 <button onClick={() => setView('STARTUP_SELECT')} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-slate-700"><Power size={24}/></button>
                 <h2 className="text-2xl font-bold mb-8 text-slate-700">Chi sta usando questo dispositivo?</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {data.employees.filter(e => e.role !== 'Sistemista').map(emp => (
                         <button key={emp.id} onClick={() => setCurrentUser(emp)} className="p-6 bg-white shadow rounded-xl border border-slate-200 hover:border-[#EC1D25] hover:shadow-lg transition">
                             <div className="font-bold text-lg">{emp.name}</div>
                             <div className="text-xs text-slate-500 uppercase">{emp.role}</div>
                         </button>
                     ))}
                 </div>
             </div>
          );
      }
      return (
          <div className="relative">
              <div className="absolute top-4 right-4 z-50 flex gap-2">
                 <button onClick={() => setCurrentUser(null)} className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">Cambia Utente</button>
                 <button onClick={() => setView('STARTUP_SELECT')} className="p-2 bg-slate-800 text-white rounded-lg"><Power size={18} /></button>
              </div>
              <WorkshopPanel 
                currentUser={currentUser}
                jobs={data.jobs}
                logs={data.logs}
                onAddLog={handleWorkLog}
                onDeleteLog={async (id) => { await dbService.deleteWorkLog(id); loadData(); }}
                onUpdateLog={async (log) => { await dbService.saveWorkLog(log); loadData(); }}
                workPhases={data.settings.workPhases}
                onUpdateJobStatus={handleJobStatusUpdate}
              />
          </div>
      );
  }

  return null;
}
