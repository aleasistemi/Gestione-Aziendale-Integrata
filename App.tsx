import React, { useState, useEffect } from 'react';
import { AppDatabase, Employee, Job, WorkLog, AttendanceRecord, Vehicle, VehicleLog, GlobalSettings, Role, ViewMode, JobStatus } from './types';
import { dbService } from './services/db';
import AttendanceKiosk from './components/AttendanceKiosk';
import VehicleKiosk from './components/VehicleKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import AdminDashboard from './components/AdminDashboard';
import { Users, Truck, Wrench, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('STARTUP_SELECT');
  
  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  
  // Auth State for Panels
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
         const data = await dbService.getAllData();
         setEmployees(data.employees);
         setJobs(data.jobs);
         setLogs(data.logs);
         setVehicles(data.vehicles);
         setSettings(data.settings);
      } catch (e) {
         console.error("Failed to load data", e);
      } finally {
         setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAutoBackup = async () => {
      if (!settings) return;
      try {
          const data = await dbService.exportDatabase();
          
          if (settings.backupWebhookUrl) {
              console.log("Sending backup to Webhook...");
              
              // Use FormData to send as a file attachment
              const blob = new Blob([data], { type: 'application/json' });
              const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
              const formData = new FormData();
              formData.append('file', blob, filename);
              formData.append('filename', filename);
              formData.append('json_content', data); 
              formData.append('type', 'auto_backup');

              await fetch(settings.backupWebhookUrl, {
                  method: 'POST',
                  body: formData
              });
              console.log("Backup inviato al Cloud con successo.");
          } else {
              // Fallback to Local Download
              const blob = new Blob([data], { type: "application/json" });
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

  const handleAttendanceRecord = async (record: AttendanceRecord) => {
      await dbService.saveAttendance(record);
  };

  const handleVehicleAction = async (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => {
      const updatedVehicle = {
          ...vehicle,
          status: type === 'CHECK_OUT' ? 'IN_USE' : 'AVAILABLE',
          currentDriverId: type === 'CHECK_OUT' ? employee.id : undefined,
          lastCheckOut: type === 'CHECK_OUT' ? new Date().toISOString() : vehicle.lastCheckOut
      } as Vehicle;
      
      await dbService.saveVehicle(updatedVehicle);
      
      const log: VehicleLog = {
          id: Date.now().toString(),
          vehicleId: vehicle.id,
          employeeId: employee.id,
          timestampOut: type === 'CHECK_OUT' ? new Date().toISOString() : vehicle.lastCheckOut || new Date().toISOString(),
          timestampIn: type === 'CHECK_IN' ? new Date().toISOString() : undefined
      };
      await dbService.saveVehicleLog(log);

      // Update local state
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? updatedVehicle : v));
  };
  
  const handleWorkshopLog = async (log: WorkLog) => {
      await dbService.saveWorkLog(log);
      setLogs(prev => [...prev, log]);
  };
  
  const handleJobUpdate = async (jobId: string, status: JobStatus) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
         const updated = { ...job, status };
         await dbService.saveJob(updated);
         setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
      }
  };

  const handleUpdateSettings = async (newSettings: GlobalSettings) => {
      await dbService.saveSettings(newSettings);
      setSettings(newSettings);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Caricamento Sistema...</div>;

  // Simple Login for Admin/Workshop
  if ((view === 'DASHBOARD' || view === 'WORKSHOP_PANEL') && !currentUser) {
       return (
           <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
               <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                   <h2 className="text-xl font-bold mb-4">Seleziona Utente</h2>
                   <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                       {employees.filter(e => view === 'DASHBOARD' ? (e.role === Role.SYSTEM_ADMIN || e.role === Role.DIRECTION) : true).map(e => (
                           <button key={e.id} onClick={() => setCurrentUser(e)} className="p-3 border rounded hover:bg-slate-50 text-left">
                               <div className="font-bold">{e.name}</div>
                               <div className="text-xs text-slate-500">{e.role}</div>
                           </button>
                       ))}
                   </div>
                   <button onClick={() => setView('STARTUP_SELECT')} className="mt-4 w-full py-2 text-slate-500 hover:bg-slate-50 rounded">Indietro</button>
               </div>
           </div>
       );
  }

  if (view === 'ATTENDANCE_KIOSK') {
      return <AttendanceKiosk 
          employees={employees} 
          onRecord={handleAttendanceRecord} 
          onExit={() => setView('STARTUP_SELECT')}
          nfcEnabled={settings?.nfcEnabled || false} 
      />;
  }

  if (view === 'VEHICLE_KIOSK') {
      return <VehicleKiosk 
          employees={employees} 
          vehicles={vehicles}
          onAction={handleVehicleAction}
          onExit={() => setView('STARTUP_SELECT')}
          nfcEnabled={settings?.nfcEnabled || false}
      />;
  }

  if (view === 'WORKSHOP_PANEL' && currentUser) {
      return <WorkshopPanel 
          currentUser={currentUser}
          jobs={jobs}
          logs={logs}
          workPhases={settings?.workPhases || []}
          onAddLog={handleWorkshopLog}
          onDeleteLog={async (id) => { await dbService.deleteWorkLog(id); setLogs(prev => prev.filter(l => l.id !== id)); }}
          onUpdateLog={async (l) => { await dbService.saveWorkLog(l); setLogs(prev => prev.map(log => log.id === l.id ? l : log)); }}
          onUpdateJobStatus={handleJobUpdate}
      />;
  }

  if (view === 'DASHBOARD' && settings) {
      return <AdminDashboard settings={settings} onUpdateSettings={handleUpdateSettings} />;
  }

  // Default: Startup Select
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
            <button onClick={() => setView('ATTENDANCE_KIOSK')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition flex flex-col items-center gap-4 group">
                <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 text-blue-600 transition"><Users size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-800">Totem Presenze</h2>
                <p className="text-slate-500 text-center">Interfaccia timbratura ingresso/uscita personale</p>
            </button>
            
            <button onClick={() => setView('VEHICLE_KIOSK')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition flex flex-col items-center gap-4 group">
                <div className="p-4 bg-orange-50 rounded-full group-hover:bg-orange-100 text-orange-600 transition"><Truck size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-800">Totem Mezzi</h2>
                <p className="text-slate-500 text-center">Gestione ritiro e riconsegna flotta aziendale</p>
            </button>

            <button onClick={() => setView('WORKSHOP_PANEL')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition flex flex-col items-center gap-4 group">
                <div className="p-4 bg-red-50 rounded-full group-hover:bg-red-100 text-[#EC1D25] transition"><Wrench size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-800">Pannello Operativo</h2>
                <p className="text-slate-500 text-center">Gestione commesse, ore lavoro e rapportini</p>
            </button>

            <button onClick={() => setView('DASHBOARD')} className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition flex flex-col items-center gap-4 group">
                <div className="p-4 bg-slate-50 rounded-full group-hover:bg-slate-100 text-slate-600 transition"><ShieldCheck size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-800">Amministrazione</h2>
                <p className="text-slate-500 text-center">Configurazione, HR, Paghe e Analisi AI</p>
            </button>
        </div>
        
        <div className="absolute bottom-4 text-slate-400 text-sm font-mono">
            v2.0.0 - ALEA System
        </div>
    </div>
  );
};

export default App;