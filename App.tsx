
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, ViewMode, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings, JobStatus } from './types';
import { dbService } from './services/db';
import AttendanceKiosk from './components/AttendanceKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import AdminDashboard from './components/AdminDashboard';
import { LayoutDashboard, LogOut, TerminalSquare, Loader2, Wrench, Scan, KeyRound, Lock, ArrowRight, X, Delete, CheckCircle, Clock, Settings, Wifi } from 'lucide-react';

function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [justifications, setJustifications] = useState<DayJustification[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AIQuickPrompt[]>([]);
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [settings, setSettings] = useState<GlobalSettings>({ nfcEnabled: false, workPhases: [] });
  const [loading, setLoading] = useState(true);

  // Auth & Navigation
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenInput, setAuthTokenInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('LOGIN');
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  
  // Login NFC State
  const [scanValue, setScanValue] = useState('');
  const loginInputRef = useRef<HTMLInputElement>(null);

  const [showLoginPinPad, setShowLoginPinPad] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  // Clock State for Login Screen
  const [currentTime, setCurrentTime] = useState(new Date());

  // Kiosk Mode Protection
  const [showKioskPinPad, setShowKioskPinPad] = useState(false);
  const [kioskPin, setKioskPin] = useState('');

  // Load Data
  const refreshData = async () => {
    try {
      const data = await dbService.getAllData();
      setEmployees(data.employees);
      setJobs(data.jobs);
      setLogs(data.logs);
      setAttendance(data.attendance);
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
    // Check local storage for auth token
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken === 'ALEASISTEMI') {
      setIsAuthenticated(true);
    }

    refreshData();
    const handleStorageChange = () => refreshData();
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(refreshData, 5000);
    
    // Clock interval
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  // Force focus on login scanner input
  useEffect(() => {
    if (isAuthenticated && viewMode === 'LOGIN' && settings.nfcEnabled && !showLoginPinPad && !showKioskPinPad) {
         const focusInterval = setInterval(() => {
              if (document.activeElement !== loginInputRef.current) {
                  loginInputRef.current?.focus();
              }
          }, 500);
          return () => clearInterval(focusInterval);
    }
  }, [isAuthenticated, viewMode, settings.nfcEnabled, showLoginPinPad, showKioskPinPad]);

  const processLoginScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      
      const emp = employees.find(e => 
          (e.nfcCode && e.nfcCode.trim().toUpperCase() === cleanCode) ||
          (e.nfcCode2 && e.nfcCode2.trim().toUpperCase() === cleanCode)
      );
      
      if (emp) {
          handleLogin(emp);
          setScanValue('');
      } else {
          setLoginMessage(`Badge non riconosciuto`);
          setScanValue('');
          setTimeout(() => setLoginMessage(null), 3000);
      }
  };

  const handleLoginKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          processLoginScan(scanValue);
      }
  };

  const verifyAuthToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (authTokenInput === 'ALEASISTEMI') {
      localStorage.setItem('auth_token', 'ALEASISTEMI');
      setIsAuthenticated(true);
    } else {
      setAuthError(true);
    }
  };

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    // Determine view based on role
    if (employee.role === Role.WORKSHOP || employee.role === Role.EMPLOYEE) {
      setViewMode('WORKSHOP_PANEL');
    } else {
      setViewMode('DASHBOARD');
    }
    // Clear login states
    setShowLoginPinPad(false);
    setLoginPin('');
    setLoginMessage(null);
  };

  const handlePinLoginSubmit = () => {
    const emp = employees.find(e => e.pin === loginPin);
    if (emp) {
        handleLogin(emp);
    } else {
        setLoginMessage("PIN non valido");
        setLoginPin('');
        setTimeout(() => setLoginMessage(null), 2000);
    }
  }

  const handleKioskEntry = () => {
      if (kioskPin === '1409') {
          setViewMode('ATTENDANCE_KIOSK');
          setShowKioskPinPad(false);
          setKioskPin('');
      } else {
          alert('PIN Errato');
          setKioskPin('');
      }
  }

  const handleLogout = () => {
    setCurrentUser(null);
    setViewMode('LOGIN');
  };

  const addWorkLog = async (newLog: WorkLog) => {
    await dbService.saveWorkLog(newLog);
    refreshData();
  };

  const updateWorkLog = async (log: WorkLog) => {
      await dbService.saveWorkLog(log);
      refreshData();
  }

  const deleteWorkLog = async (logId: string) => {
      if (window.confirm("Sei sicuro di voler eliminare questa registrazione?")) {
          await dbService.deleteWorkLog(logId);
          refreshData();
      }
  }

  const addAttendanceRecord = async (record: AttendanceRecord) => {
    await dbService.saveAttendance(record);
    refreshData();
  };

  const deleteAttendanceRecord = async (recordId: string) => {
      await dbService.deleteAttendance(recordId);
      refreshData();
  }

  const handleSaveJob = async (job: Job) => {
    await dbService.saveJob(job);
    refreshData();
  };

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
          await dbService.saveJob({ ...job, status });
          refreshData();
      }
  }

  const handleSaveEmployee = async (emp: Employee) => {
    await dbService.saveEmployee(emp);
    refreshData();
  };

  const handleSaveJustification = async (just: DayJustification) => {
    await dbService.saveJustification(just);
    refreshData();
  }

  const handleSaveAiPrompts = async (prompts: AIQuickPrompt[]) => {
      await dbService.saveAiPrompts(prompts);
      refreshData();
  }

  const handleSavePermissions = async (perms: RolePermissions) => {
      await dbService.savePermissions(perms);
      refreshData();
  }

  const handleSaveSettings = async (newSettings: GlobalSettings) => {
      await dbService.saveSettings(newSettings);
      refreshData();
  }

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  // Security Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
           <div className="flex justify-center mb-6">
             <div className="bg-red-100 p-4 rounded-full">
               <Lock className="text-[#EC1D25]" size={40} />
             </div>
           </div>
           <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Accesso Riservato</h1>
           <p className="text-center text-slate-500 mb-8">Inserisci il Token Aziendale per autorizzare questo dispositivo.</p>
           
           <form onSubmit={verifyAuthToken} className="space-y-4">
             <input 
               type="password" 
               className={`w-full text-center text-xl tracking-widest p-4 border rounded-xl outline-none focus:ring-2 ${authError ? 'border-red-500 ring-red-200' : 'border-slate-300 focus:ring-[#EC1D25]'}`}
               placeholder="TOKEN"
               value={authTokenInput}
               onChange={(e) => {setAuthTokenInput(e.target.value); setAuthError(false);}}
             />
             {authError && <p className="text-center text-red-500 text-sm font-bold">Token non valido</p>}
             <button type="submit" className="w-full bg-[#EC1D25] text-white font-bold py-4 rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2">
               Autorizza Dispositivo <ArrowRight size={20} />
             </button>
           </form>
        </div>
      </div>
    )
  }

  if (viewMode === 'ATTENDANCE_KIOSK') {
    return (
      <AttendanceKiosk 
        employees={employees} 
        onRecord={addAttendanceRecord}
        onExit={() => setViewMode('LOGIN')}
        nfcEnabled={settings.nfcEnabled}
      />
    );
  }

  if (viewMode === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        
        {/* Header Alea Style */}
        <div className="absolute top-10 text-center z-10">
            <div className="mb-2 flex justify-center">
                <div className="flex flex-col items-center">
                    <div className="text-3xl font-black text-[#EC1D25] tracking-tighter" style={{fontFamily: 'Arial, sans-serif'}}>ALEA</div>
                    <div className="text-xs font-bold text-slate-500 tracking-[0.3em] uppercase">Sistemi</div>
                </div>
            </div>
            <div className="text-4xl font-mono font-light text-slate-800 flex items-center justify-center gap-2">
                <Clock size={32} className="text-[#EC1D25]" />
                {currentTime.toLocaleTimeString('it-IT')}
            </div>
            <p className="text-slate-500 mt-1 font-medium">{currentTime.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md relative z-10 mt-20">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800">Portale Aziendale</h1>
            <p className="text-slate-500 text-sm">Seleziona utente per accedere</p>
          </div>
          
          <div className="space-y-4">
            
            <div className="pt-2">
              
              {settings.nfcEnabled ? (
                   <div className="flex flex-col items-center py-4 w-full relative">
                      
                      {/* INVISIBLE SCANNER INPUT FOR LOGIN */}
                      <input 
                          ref={loginInputRef}
                          type="text" 
                          value={scanValue}
                          onChange={(e) => setScanValue(e.target.value)}
                          onKeyDown={handleLoginKeyDown}
                          className="absolute inset-0 opacity-0 cursor-default"
                          autoFocus
                          autoComplete="off"
                      />

                      {/* VISUAL ANIMATION */}
                      <div className="w-48 h-48 relative flex items-center justify-center mb-4 cursor-pointer" onClick={() => loginInputRef.current?.focus()}>
                          <div className="absolute inset-0 bg-blue-50 rounded-full animate-ping opacity-20"></div>
                          <div className="absolute inset-4 bg-blue-100 rounded-full animate-pulse opacity-30"></div>
                          <div className="relative z-10 bg-white p-6 rounded-full shadow-lg border-2 border-blue-100">
                             <Scan size={48} className="text-blue-600" />
                          </div>
                          {/* Status Indicator */}
                          <div className="absolute bottom-0 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1 shadow-sm">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                             Lettore Attivo
                          </div>
                      </div>
                      
                      <p className="text-slate-500 font-medium mb-2 mt-2">Avvicina il Badge al lettore...</p>
                      
                      {loginMessage && <p className="text-red-500 font-bold mb-4 animate-bounce bg-red-50 px-4 py-2 rounded-lg">{loginMessage}</p>}
                      <button onClick={() => setShowLoginPinPad(true)} className="relative z-10 flex items-center gap-2 text-blue-600 hover:underline mt-4 text-sm font-medium">
                          <KeyRound size={16} /> Oppure usa Codice PIN
                      </button>
                   </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {employees.map(emp => (
                    <button 
                        key={emp.id}
                        onClick={() => handleLogin(emp)}
                        className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg transition text-left border border-transparent hover:border-blue-100"
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0
                        ${emp.role === Role.SYSTEM_ADMIN ? 'bg-black' : 
                            emp.role === Role.DIRECTION ? 'bg-red-600' : 
                            (emp.role === Role.ADMIN || emp.role === Role.ACCOUNTING) ? 'bg-purple-600' : 
                            (emp.role === Role.SALES || emp.role === Role.TECHNICAL) ? 'bg-green-600' :
                            'bg-blue-500'}`}
                        >
                        {emp.role.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                        <span className="block font-medium text-slate-700">{emp.name}</span>
                        <span className="text-xs text-slate-400 uppercase">{emp.department} - {emp.role}</span>
                        </div>
                    </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          
           {/* LOGIN PIN PAD */}
           {showLoginPinPad && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Login con PIN</h3>
                            <button onClick={() => {setShowLoginPinPad(false); setLoginPin('');}}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="text-center text-3xl font-mono tracking-widest py-3 bg-slate-100 rounded-lg mb-6">
                                {loginPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[1,2,3,4,5,6,7,8,9].map(n => (
                                    <button key={n} onClick={() => setLoginPin(p => p.length < 6 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">{n}</button>
                                ))}
                                <button onClick={() => setLoginPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                                <button onClick={() => setLoginPin(p => p.length < 6 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">0</button>
                                <button onClick={handlePinLoginSubmit} className="p-3 bg-blue-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                            </div>
                        </div>
                    </div>
                </div>
           )}

            {/* KIOSK MODE PIN PAD */}
           {showKioskPinPad && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Attiva Totem</h3>
                            <button onClick={() => {setShowKioskPinPad(false); setKioskPin('');}}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                            <p className="text-center text-slate-500 mb-2">Inserisci PIN Sicurezza</p>
                            <div className="text-center text-3xl font-mono tracking-widest py-3 bg-slate-100 rounded-lg mb-6">
                                {kioskPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[1,2,3,4,5,6,7,8,9].map(n => (
                                    <button key={n} onClick={() => setKioskPin(p => p.length < 4 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">{n}</button>
                                ))}
                                <button onClick={() => setKioskPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                                <button onClick={() => setKioskPin(p => p.length < 4 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold hover:bg-blue-50">0</button>
                                <button onClick={handleKioskEntry} className="p-3 bg-red-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                            </div>
                        </div>
                    </div>
                </div>
           )}

        </div>

        {/* Bottom Right Tools */}
        <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
                onClick={() => setShowKioskPinPad(true)}
                className="p-2 bg-white/50 hover:bg-white text-slate-400 hover:text-slate-800 rounded-full transition shadow-sm"
                title="Attiva Modalità Totem"
            >
                <TerminalSquare size={16} />
            </button>
        </div>

      </div>
    );
  }

  const isWorkshopPanel = viewMode === 'WORKSHOP_PANEL';
  
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="text-blue-600" />
              <span className="font-bold text-xl text-slate-800">
                {isWorkshopPanel ? 'Pannello Operativo' : 'Dashboard Gestionale'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* Button to switch views for Admin/Office roles */}
              {!isWorkshopPanel && (currentUser?.role !== Role.WORKSHOP && currentUser?.role !== Role.EMPLOYEE) && (
                 <button 
                    onClick={() => setViewMode('WORKSHOP_PANEL')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                 >
                    <Wrench size={16} /> Pannello Operativo
                 </button>
              )}
               {isWorkshopPanel && (currentUser?.role !== Role.WORKSHOP && currentUser?.role !== Role.EMPLOYEE) && (
                 <button 
                    onClick={() => setViewMode('DASHBOARD')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                 >
                    <LayoutDashboard size={16} /> Torna alla Dashboard
                 </button>
              )}

              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-900">{currentUser?.name}</p>
                <p className="text-xs text-slate-500">{currentUser?.department} ({currentUser?.role})</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 transition bg-slate-50 hover:bg-red-50 rounded-full"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        {!isWorkshopPanel ? (
          <AdminDashboard 
            jobs={jobs} 
            logs={logs} 
            employees={employees}
            attendance={attendance}
            justifications={justifications}
            customPrompts={aiPrompts}
            permissions={permissions}
            onSaveJob={handleSaveJob}
            onSaveEmployee={handleSaveEmployee}
            onSaveJustification={handleSaveJustification}
            onSaveAiPrompts={handleSaveAiPrompts}
            onSavePermissions={handleSavePermissions}
            onUpdateLog={updateWorkLog}
            currentUserRole={currentUser?.role || Role.EMPLOYEE}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onSaveAttendance={addAttendanceRecord}
            onDeleteAttendance={deleteAttendanceRecord}
          />
        ) : (
          <WorkshopPanel 
            currentUser={currentUser!}
            jobs={jobs}
            logs={logs}
            onAddLog={addWorkLog}
            onDeleteLog={deleteWorkLog}
            onUpdateLog={updateWorkLog}
            workPhases={settings.workPhases}
            onUpdateJobStatus={handleUpdateJobStatus}
          />
        )}
      </main>
    </div>
  );
}

export default App;
