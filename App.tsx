
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, ViewMode, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings, JobStatus, Vehicle, VehicleLog } from './types';
import { dbService } from './services/db';
import { APP_CONFIG } from './appConfig';
import AttendanceKiosk from './components/AttendanceKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import VehicleKiosk from './components/VehicleKiosk';
import MobileVehicleKiosk from './components/MobileVehicleKiosk';
import { AdminDashboard } from './components/AdminDashboard';
import { LayoutDashboard, LogOut, Loader2, Wrench, Scan, KeyRound, Lock, ArrowRight, X, Delete, CheckCircle, Clock, Truck, Smartphone, Laptop } from 'lucide-react';

function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([]);
  const [justifications, setJustifications] = useState<DayJustification[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AIQuickPrompt[]>([]);
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [settings, setSettings] = useState<GlobalSettings>({ nfcEnabled: false, workPhases: [] });
  const [loading, setLoading] = useState(true);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenInput, setAuthTokenInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('STARTUP_SELECT');
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  
  const [scanValue, setScanValue] = useState('');
  const loginInputRef = useRef<HTMLInputElement>(null);
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');

  const [showLoginPinPad, setShowLoginPinPad] = useState(false);
  const [loginPin, setLoginPin] = useState('');

  const [currentTime, setCurrentTime] = useState(new Date());

  const [showKioskMenu, setShowKioskMenu] = useState(false);
  const [kioskPin, setKioskPin] = useState('');
  const [targetKioskMode, setTargetKioskMode] = useState<'ATTENDANCE' | 'VEHICLE' | 'MOBILE_VEHICLE' | null>(null);

  const refreshData = async () => {
    try {
      const data = await dbService.getAllData();
      setEmployees(data.employees);
      setJobs(data.jobs);
      setLogs(data.logs);
      setAttendance(data.attendance);
      setVehicles(data.vehicles);
      setVehicleLogs(data.vehicleLogs);
      setJustifications(data.justifications);
      setAiPrompts(data.customPrompts);
      setPermissions(data.permissions);
      setSettings(data.settings);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Gestione Token di autorizzazione (rimane per sicurezza)
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken === 'ALEASISTEMI') {
      setIsAuthenticated(true);
    } else if (APP_CONFIG.MODE === 'MOBILE_TOTEM') {
      // Per il totem mezzi saltiamo la protezione token se necessario, 
      // o la forziamo a true se vogliamo che l'APK sia "aperto"
      setIsAuthenticated(true);
      localStorage.setItem('auth_token', 'ALEASISTEMI');
    }

    // LOGICA DI BOOT DIRETTO
    if (APP_CONFIG.MODE === 'MOBILE_TOTEM') {
        setViewMode('MOBILE_VEHICLE_KIOSK');
    } else {
        const savedKioskMode = localStorage.getItem('kiosk_mode');
        if (savedKioskMode === 'ATTENDANCE') setViewMode('ATTENDANCE_KIOSK');
        else if (savedKioskMode === 'VEHICLE') setViewMode('VEHICLE_KIOSK');
        else if (savedKioskMode === 'MOBILE_VEHICLE') setViewMode('MOBILE_VEHICLE_KIOSK');
        else {
            const storedUser = localStorage.getItem('current_user_json');
            if (storedUser) {
                try {
                    const u = JSON.parse(storedUser);
                    setCurrentUser(u);
                    if (u.role === Role.WORKSHOP || u.role === Role.EMPLOYEE || u.role === Role.WAREHOUSE) {
                        setViewMode('WORKSHOP_PANEL');
                    } else {
                        setViewMode('DASHBOARD');
                    }
                } catch(e) { setViewMode('STARTUP_SELECT'); }
            } else {
                setViewMode('STARTUP_SELECT');
            }
        }
    }

    refreshData();
    const interval = setInterval(refreshData, 5000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clockInterval); };
  }, []);

  const startNfcScan = async () => {
      if (settings.nfcEnabled && 'NDEFReader' in window && viewMode === 'LOGIN') {
          try {
              const ndef = new (window as any).NDEFReader();
              await ndef.scan();
              setNfcStatus('LISTENING');
              ndef.onreading = (event: any) => {
                  let readCode = "";
                  const message = event.message;
                  for (const record of message.records) {
                    if (record.recordType === "text") {
                        const textDecoder = new TextDecoder(record.encoding);
                        readCode = textDecoder.decode(record.data);
                        break;
                    }
                  }
                  if (!readCode) readCode = event.serialNumber.replaceAll(':', '').toUpperCase();
                  processLoginScan(readCode);
              };
          } catch (error) { setNfcStatus('ERROR'); }
      }
  };

  useEffect(() => {
    if (isAuthenticated && viewMode === 'LOGIN' && settings.nfcEnabled && !showLoginPinPad && !showKioskMenu) {
         startNfcScan(); 
         const focusInterval = setInterval(() => {
              if (document.activeElement !== loginInputRef.current) loginInputRef.current?.focus();
          }, 500);
          return () => clearInterval(focusInterval);
    }
  }, [isAuthenticated, viewMode, settings.nfcEnabled, showLoginPinPad, showKioskMenu]);

  const processLoginScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => 
          (e.nfcCode && e.nfcCode.trim().toUpperCase() === cleanCode) ||
          (e.nfcCode2 && e.nfcCode2.trim().toUpperCase() === cleanCode) ||
          (e.id && e.id.trim().toUpperCase() === cleanCode)
      );
      if (emp) { handleLogin(emp); setScanValue(''); }
  };

  const handleLoginKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); processLoginScan(scanValue); }
  };

  const verifyAuthToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (authTokenInput === 'ALEASISTEMI') { localStorage.setItem('auth_token', 'ALEASISTEMI'); setIsAuthenticated(true); } else { setAuthError(true); }
  };

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('current_user_json', JSON.stringify(employee));
    if (employee.role === Role.WORKSHOP || employee.role === Role.EMPLOYEE || employee.role === Role.WAREHOUSE) {
      setViewMode('WORKSHOP_PANEL');
    } else {
      setViewMode('DASHBOARD');
    }
    setShowLoginPinPad(false);
    setLoginPin('');
  };

  const handlePinLoginSubmit = () => {
    const emp = employees.find(e => e.pin === loginPin);
    if (emp) handleLogin(emp); else setLoginPin('');
  }

  const handleKioskEntry = () => {
      if (kioskPin === '1409') {
          if (targetKioskMode === 'ATTENDANCE') {
              setViewMode('ATTENDANCE_KIOSK');
              localStorage.setItem('kiosk_mode', 'ATTENDANCE'); 
          } else if (targetKioskMode === 'VEHICLE') {
              setViewMode('VEHICLE_KIOSK');
              localStorage.setItem('kiosk_mode', 'VEHICLE'); 
          } else if (targetKioskMode === 'MOBILE_VEHICLE') {
              setViewMode('MOBILE_VEHICLE_KIOSK');
              localStorage.setItem('kiosk_mode', 'MOBILE_VEHICLE');
          }
          setShowKioskMenu(false); setKioskPin(''); setTargetKioskMode(null);
      } else { alert('PIN Errato'); setKioskPin(''); }
  }

  const handleExitKiosk = () => { 
      if (APP_CONFIG.MODE === 'MOBILE_TOTEM') {
          // In modalità totem mobile, l'uscita non fa nulla o ricarica l'app
          window.location.reload();
      } else {
          localStorage.removeItem('kiosk_mode'); 
          setViewMode('STARTUP_SELECT'); 
      }
  }

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('current_user_json'); setViewMode('LOGIN'); };

  const addWorkLog = async (newLog: WorkLog) => { await dbService.saveWorkLog(newLog); refreshData(); };
  const updateWorkLog = async (log: WorkLog) => { await dbService.saveWorkLog(log); refreshData(); }
  const deleteWorkLog = async (logId: string) => { if (window.confirm("Sei sicuro?")) { await dbService.deleteWorkLog(logId); refreshData(); } }
  const addAttendanceRecord = async (record: AttendanceRecord) => { await dbService.saveAttendance(record); refreshData(); };
  const deleteAttendanceRecord = async (recordId: string) => { await dbService.deleteAttendance(recordId); refreshData(); }
  const handleSaveJob = async (job: Job) => { await dbService.saveJob(job); refreshData(); };
  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) { await dbService.saveJob({ ...job, status }); refreshData(); }
  }
  const handleSaveEmployee = async (emp: Employee) => { await dbService.saveEmployee(emp); refreshData(); };
  const handleSaveJustification = async (just: DayJustification) => { await dbService.saveJustification(just); refreshData(); }
  const handleSaveAiPrompts = async (prompts: AIQuickPrompt[]) => { await dbService.saveAiPrompts(prompts); refreshData(); }
  const handleSavePermissions = async (perms: RolePermissions) => { await dbService.savePermissions(perms); refreshData(); }
  const handleSaveSettings = async (newSettings: GlobalSettings) => { await dbService.saveSettings(newSettings); refreshData(); }
  const handleSaveVehicle = async (vehicle: Vehicle) => { await dbService.saveVehicle(vehicle); refreshData(); }
  const handleDeleteVehicle = async (id: string) => { await dbService.deleteVehicle(id); refreshData(); }

  const handleVehicleAction = async (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => {
      const timestamp = new Date().toISOString();
      if (type === 'CHECK_OUT') {
          const updatedVehicle: Vehicle = { ...vehicle, status: 'IN_USE', currentDriverId: employee.id, lastCheckOut: timestamp };
          await dbService.saveVehicle(updatedVehicle);
          const newLog: VehicleLog = { id: Date.now().toString(), vehicleId: vehicle.id, employeeId: employee.id, timestampOut: timestamp };
          await dbService.saveVehicleLog(newLog);
      } else {
          const updatedVehicle: Vehicle = {
              id: vehicle.id,
              name: vehicle.name,
              plate: vehicle.plate,
              status: 'AVAILABLE'
          };
          await dbService.saveVehicle(updatedVehicle);
          const openLog = vehicleLogs.find(l => l.vehicleId === vehicle.id && !l.timestampIn);
          if (openLog) await dbService.saveVehicleLog({ ...openLog, timestampIn: timestamp });
      }
      refreshData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
           <div className="flex justify-center mb-6"><div className="bg-red-100 p-4 rounded-full"><Lock className="text-[#EC1D25]" size={40} /></div></div>
           <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Accesso Riservato</h1>
           <form onSubmit={verifyAuthToken} className="space-y-4">
             <input type="password" autoFocus className={`w-full text-center text-xl tracking-widest p-4 border rounded-xl outline-none focus:ring-2 ${authError ? 'border-red-500 ring-red-200' : 'border-slate-300 focus:ring-[#EC1D25]'}`} placeholder="TOKEN" value={authTokenInput} onChange={(e) => {setAuthTokenInput(e.target.value); setAuthError(false);}} />
             <button type="submit" className="w-full bg-[#EC1D25] text-white font-bold py-4 rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2">Autorizza Dispositivo <ArrowRight size={20} /></button>
           </form>
        </div>
      </div>
    )
  }

  if (viewMode === 'STARTUP_SELECT') {
      return (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
              <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl overflow-hidden p-10 flex flex-col items-center">
                  <div className="text-center mb-12">
                      <div className="text-5xl font-black text-[#EC1D25] tracking-tighter mb-2">ALEA SISTEMI</div>
                      <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Sistemi di Gestione Aziendale</p>
                  </div>
                  
                  <div className="flex justify-center gap-6 mb-16">
                      <button onClick={() => { setTargetKioskMode('ATTENDANCE'); setShowKioskMenu(true); }} className="flex flex-col items-center gap-2 group">
                          <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Clock size={28} /></div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Presenze</span>
                      </button>
                      <button onClick={() => { setTargetKioskMode('VEHICLE'); setShowKioskMenu(true); }} className="flex flex-col items-center gap-2 group">
                          <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Truck size={28} /></div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mezzi</span>
                      </button>
                      <button onClick={() => { setTargetKioskMode('MOBILE_VEHICLE'); setShowKioskMenu(true); }} className="flex flex-col items-center gap-2 group">
                          <div className="w-16 h-16 bg-[#EC1D25] text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Smartphone size={28} /></div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Smart</span>
                      </button>
                  </div>

                  <button 
                    onClick={() => setViewMode('LOGIN')} 
                    className="w-full max-w-sm p-5 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest shadow-xl"
                  >
                      <Laptop size={24} className="text-[#EC1D25]"/>
                      Accedi al Gestionale
                  </button>
              </div>
              
              {showKioskMenu && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Accesso Protetto</h3>
                            <button onClick={() => {setShowKioskMenu(false); setKioskPin(''); setTargetKioskMode(null);}}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="text-center text-3xl font-mono tracking-widest py-3 bg-slate-100 rounded-lg mb-6">{kioskPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                        <div className="grid grid-cols-3 gap-3">
                            {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setKioskPin(p => p.length < 4 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">{n}</button>)}
                            <button onClick={() => setKioskPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                            <button onClick={() => setKioskPin(p => p.length < 4 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">0</button>
                            <button onClick={handleKioskEntry} className="p-3 bg-red-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                        </div>
                    </div>
                </div>
              )}
          </div>
      )
  }

  if (viewMode === 'ATTENDANCE_KIOSK') return <AttendanceKiosk employees={employees} onRecord={addAttendanceRecord} onExit={handleExitKiosk} nfcEnabled={settings.nfcEnabled} />;
  if (viewMode === 'VEHICLE_KIOSK') return <VehicleKiosk employees={employees} vehicles={vehicles} onAction={handleVehicleAction} onExit={handleExitKiosk} nfcEnabled={settings.nfcEnabled} />;
  if (viewMode === 'MOBILE_VEHICLE_KIOSK') return <MobileVehicleKiosk employees={employees} vehicles={vehicles} onAction={handleVehicleAction} onExit={handleExitKiosk} />;

  if (viewMode === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-10 text-center z-10">
            <div className="mb-2 flex justify-center"><div className="flex flex-col items-center"><div className="text-3xl font-black text-[#EC1D25] tracking-tighter">ALEA SISTEMI</div></div></div>
            <div className="text-4xl font-mono font-light text-slate-800 flex items-center justify-center gap-2"><Clock size={32} className="text-[#EC1D25]" />{currentTime.toLocaleTimeString('it-IT')}</div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md relative z-10 mt-20">
          <div className="text-center mb-6"><h1 className="text-xl font-bold text-slate-800">Portale Aziendale</h1><p className="text-slate-500 text-sm">Seleziona utente per accedere</p></div>
          <div className="space-y-4">
              {settings.nfcEnabled ? (
                   <div className="flex flex-col items-center py-4 w-full relative">
                      <input ref={loginInputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={handleLoginKeyDown} className="absolute inset-0 opacity-0 cursor-default" autoFocus autoComplete="off" inputMode="none" />
                      <div className="w-48 h-48 relative flex items-center justify-center mb-4 cursor-pointer" onClick={() => loginInputRef.current?.focus()}><div className="relative z-10 bg-white p-6 rounded-full shadow-lg border-2 border-blue-100"><Scan size={48} className="text-blue-600" /></div></div>
                      <button onClick={() => setShowLoginPinPad(true)} className="relative z-10 text-blue-600 hover:underline mt-4 text-sm font-medium"><KeyRound size={16} /> PIN Utente</button>
                   </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {employees.map(emp => (
                    <button key={emp.id} onClick={() => handleLogin(emp)} className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg transition text-left border border-transparent hover:border-blue-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${emp.role === Role.SYSTEM_ADMIN ? 'bg-black' : emp.role === Role.DIRECTION ? 'bg-red-600' : 'bg-blue-500'}`}>{emp.role.substring(0, 2).toUpperCase()}</div>
                        <div><span className="block font-medium text-slate-700">{emp.name}</span><span className="text-xs text-slate-400 uppercase">{emp.department}</span></div>
                    </button>
                    ))}
                </div>
              )}
          </div>
           {showLoginPinPad && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Login con PIN</h3><button onClick={() => setShowLoginPinPad(false)}><X size={24} className="text-slate-400"/></button></div>
                        <div className="text-center text-3xl font-mono tracking-widest py-3 bg-slate-100 rounded-lg mb-6">{loginPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                        <div className="grid grid-cols-3 gap-3">
                            {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setLoginPin(p => p.length < 6 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold">{n}</button>)}
                            <button onClick={() => setLoginPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                            <button onClick={() => setLoginPin(p => p.length < 6 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold">0</button>
                            <button onClick={handlePinLoginSubmit} className="p-3 bg-blue-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                        </div>
                    </div>
                </div>
           )}
        </div>
        <div className="absolute bottom-4 right-4"><button onClick={() => setViewMode('STARTUP_SELECT')} className="p-2 bg-white/50 rounded-full shadow-sm"><ArrowRight size={16} className="rotate-180"/></button></div>
      </div>
    );
  }

  const isWorkshopPanel = viewMode === 'WORKSHOP_PANEL';
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex justify-between h-16">
          <div className="flex items-center gap-2">
              <LayoutDashboard className="text-blue-600" />
              <span className="font-black text-xl text-slate-800 tracking-tighter uppercase">ALEA SISTEMI</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utente</span>
                <span className="text-sm font-black text-slate-800">Ciao, {currentUser?.name}</span>
            </div>
            
            {!isWorkshopPanel ? (
                <button onClick={() => setViewMode('WORKSHOP_PANEL')} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                    <Wrench size={18} className="text-[#EC1D25]"/>
                    <span>Pannello Operativo</span>
                </button>
            ) : (
                <button onClick={() => setViewMode('DASHBOARD')} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                    <LayoutDashboard size={18} className="text-blue-600"/>
                    <span>Dashboard Amministrativa</span>
                </button>
            )}
            
            <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full transition-colors border border-slate-100"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto">
        {!isWorkshopPanel ? (
          <AdminDashboard 
            jobs={jobs} logs={logs} employees={employees} attendance={attendance} 
            vehicles={vehicles} vehicleLogs={vehicleLogs} justifications={justifications} 
            customPrompts={aiPrompts} permissions={permissions} onSaveJob={handleSaveJob} 
            onSaveEmployee={handleSaveEmployee} onSaveJustification={handleSaveJustification} 
            onSaveAiPrompts={handleSaveAiPrompts} onSavePermissions={handleSavePermissions} 
            onUpdateLog={updateWorkLog} currentUserRole={currentUser?.role || Role.EMPLOYEE} 
            settings={settings} onSaveSettings={handleSaveSettings} 
            onSaveAttendance={addAttendanceRecord} onDeleteAttendance={deleteAttendanceRecord} 
            onSaveVehicle={handleSaveVehicle} onDeleteVehicle={handleDeleteVehicle} 
          />
        ) : (
          <WorkshopPanel 
            currentUser={currentUser!} jobs={jobs} logs={logs} 
            onAddLog={addWorkLog} onDeleteLog={deleteWorkLog} onUpdateLog={updateWorkLog} 
            workPhases={settings.workPhases} onUpdateJobStatus={handleUpdateJobStatus} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
