
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, ViewMode, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings, JobStatus, Vehicle, VehicleLog } from './types';
import { dbService } from './services/db';
import AttendanceKiosk from './components/AttendanceKiosk';
import WorkshopPanel from './components/WorkshopPanel';
import VehicleKiosk from './components/VehicleKiosk';
import { AdminDashboard } from './components/AdminDashboard';
import { LayoutDashboard, LogOut, Loader2, Wrench, Scan, KeyRound, Lock, ArrowRight, X, Delete, CheckCircle, Clock, Truck, Play, AlertCircle, Laptop, Wifi, Info } from 'lucide-react';

const getNativeNfc = async () => {
    try {
        const { NFC } = await import('capacitor-nfc');
        return NFC;
    } catch (e) {
        return null;
    }
};

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
  const [viewMode, setViewMode] = useState<ViewMode>('STARTUP_SELECT');
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  
  const [scanValue, setScanValue] = useState('');
  const loginInputRef = useRef<HTMLInputElement>(null);
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [showLoginPinPad, setShowLoginPinPad] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const [showKioskMenu, setShowKioskMenu] = useState(false);
  const [kioskPin, setKioskPin] = useState('');
  const [targetKioskMode, setTargetKioskMode] = useState<'ATTENDANCE' | 'VEHICLE' | null>(null);

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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken === 'ALEASISTEMI') setIsAuthenticated(true);
    const savedKioskMode = localStorage.getItem('kiosk_mode');
    if (savedKioskMode === 'ATTENDANCE') setViewMode('ATTENDANCE_KIOSK');
    else if (savedKioskMode === 'VEHICLE') setViewMode('VEHICLE_KIOSK');
    else {
        const storedUser = localStorage.getItem('current_user_json');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                setCurrentUser(u);
                setViewMode(u.role === Role.WORKSHOP || u.role === Role.EMPLOYEE || u.role === Role.WAREHOUSE ? 'WORKSHOP_PANEL' : 'DASHBOARD');
            } catch(e) { setViewMode('STARTUP_SELECT'); }
        } else { setViewMode('STARTUP_SELECT'); }
    }
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const startNfcScan = async () => {
      if (!settings.nfcEnabled || viewMode !== 'LOGIN') return;
      const nativeNfc = await getNativeNfc();
      if (nativeNfc) {
          try {
              setNfcStatus('LISTENING');
              await nativeNfc.addListener('nfcTagDetected', (tag: any) => {
                  const code = tag.id || (tag.message?.records[0]?.data);
                  if (code) processLoginScan(code.toString());
              });
              await nativeNfc.startScan();
              return;
          } catch (e) { console.warn(e); }
      }
      if ('NDEFReader' in window) {
          try {
              const ndef = new (window as any).NDEFReader();
              await ndef.scan();
              setNfcStatus('LISTENING');
              ndef.onreading = (event: any) => {
                  let readCode = "";
                  for (const record of event.message.records) {
                    if (record.recordType === "text") { readCode = new TextDecoder(record.encoding).decode(record.data); break; }
                  }
                  if (!readCode) readCode = event.serialNumber.replaceAll(':', '').toUpperCase();
                  processLoginScan(readCode);
              };
          } catch (error) { setNfcStatus('ERROR'); }
      } else { setNfcStatus('UNSUPPORTED'); }
  };

  useEffect(() => {
    if (isAuthenticated && viewMode === 'LOGIN' && settings.nfcEnabled && !showLoginPinPad && !showKioskMenu) {
         startNfcScan(); 
         const focusInterval = setInterval(() => { if (document.activeElement !== loginInputRef.current) loginInputRef.current?.focus(); }, 500);
         return () => clearInterval(focusInterval);
    }
  }, [isAuthenticated, viewMode, settings.nfcEnabled, showLoginPinPad, showKioskMenu]);

  const processLoginScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => (e.nfcCode?.toUpperCase() === cleanCode) || (e.nfcCode2?.toUpperCase() === cleanCode) || (e.id.toUpperCase() === cleanCode));
      if (emp) { handleLogin(emp); setScanValue(''); } else { setLoginMessage(`Badge non riconosciuto`); setScanValue(''); setTimeout(() => setLoginMessage(null), 3000); }
  };

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('current_user_json', JSON.stringify(employee));
    setViewMode(employee.role === Role.WORKSHOP || employee.role === Role.EMPLOYEE || employee.role === Role.WAREHOUSE ? 'WORKSHOP_PANEL' : 'DASHBOARD');
    setShowLoginPinPad(false);
    setLoginPin('');
  };

  const handleExitKiosk = () => { localStorage.removeItem('kiosk_mode'); setViewMode('STARTUP_SELECT'); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('current_user_json'); setViewMode('LOGIN'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
           <div className="flex justify-center mb-6"><div className="bg-red-100 p-4 rounded-full"><Lock className="text-[#EC1D25]" size={40} /></div></div>
           <h1 className="text-2xl font-bold mb-6">Accesso Riservato</h1>
           <form onSubmit={(e) => { e.preventDefault(); if(authTokenInput === 'ALEASISTEMI') { localStorage.setItem('auth_token', 'ALEASISTEMI'); setIsAuthenticated(true); } }} className="space-y-4">
             <input type="password" className="w-full text-center text-xl p-4 border rounded-xl outline-none" placeholder="TOKEN" value={authTokenInput} onChange={(e) => setAuthTokenInput(e.target.value)} />
             <button type="submit" className="w-full bg-[#EC1D25] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">Autorizza <ArrowRight size={20} /></button>
           </form>
        </div>
      </div>
    )
  }

  if (viewMode === 'STARTUP_SELECT') {
      return (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
              <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-8">
                  <div className="text-center mb-10"><h1 className="text-4xl font-black text-[#EC1D25] mb-2">ALEA Sistemi</h1><p className="text-slate-500">Seleziona modalità di avvio</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button onClick={() => { setTargetKioskMode('ATTENDANCE'); setShowKioskMenu(true); }} className="p-8 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col items-center gap-4 hover:border-blue-500 transition"><div className="bg-blue-600 text-white p-6 rounded-full"><Clock size={48} /></div><h2 className="text-2xl font-bold">Totem Presenze</h2></button>
                      <button onClick={() => { setTargetKioskMode('VEHICLE'); setShowKioskMenu(true); }} className="p-8 bg-orange-50 border-2 border-orange-200 rounded-2xl flex flex-col items-center gap-4 hover:border-orange-500 transition"><div className="bg-orange-500 text-white p-6 rounded-full"><Truck size={48} /></div><h2 className="text-2xl font-bold">Totem Mezzi</h2></button>
                  </div>
                  <div className="mt-8 border-t pt-8"><button onClick={() => setViewMode('LOGIN')} className="w-full p-4 bg-slate-800 text-white rounded-xl flex items-center justify-center gap-2 font-bold"><Laptop size={20}/> Accedi al Gestionale</button></div>
              </div>
              {showKioskMenu && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-xl font-bold mb-6">PIN Sicurezza</h3>
                        <div className="text-3xl font-mono py-3 bg-slate-100 rounded-lg mb-6">{kioskPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                        <div className="grid grid-cols-3 gap-3">
                            {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setKioskPin(p => p.length < 4 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold">{n}</button>)}
                            <button onClick={() => setKioskPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                            <button onClick={() => setKioskPin(p => p.length < 4 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold">0</button>
                            <button onClick={() => { if(kioskPin==='1409') { localStorage.setItem('kiosk_mode', targetKioskMode!); setViewMode(targetKioskMode === 'ATTENDANCE' ? 'ATTENDANCE_KIOSK' : 'VEHICLE_KIOSK'); setShowKioskMenu(false); } else setKioskPin(''); }} className="p-3 bg-red-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                        </div>
                    </div>
                </div>
           )}
          </div>
      )
  }

  if (viewMode === 'ATTENDANCE_KIOSK') return <AttendanceKiosk employees={employees} onRecord={async (r) => { await dbService.saveAttendance(r); refreshData(); }} onExit={handleExitKiosk} nfcEnabled={settings.nfcEnabled} />;
  if (viewMode === 'VEHICLE_KIOSK') return <VehicleKiosk employees={employees} vehicles={vehicles} onAction={async (v, e, t) => { const timestamp = new Date().toISOString(); if (t === 'CHECK_OUT') { await dbService.saveVehicle({...v, status: 'IN_USE', currentDriverId: e.id, lastCheckOut: timestamp}); await dbService.saveVehicleLog({id: Date.now().toString(), vehicleId: v.id, employeeId: e.id, timestampOut: timestamp}); } else { await dbService.saveVehicle({...v, status: 'AVAILABLE', currentDriverId: undefined, lastCheckOut: undefined}); const log = vehicleLogs.find(l => l.vehicleId === v.id && !l.timestampIn); if(log) await dbService.saveVehicleLog({...log, timestampIn: timestamp}); } refreshData(); }} onExit={handleExitKiosk} nfcEnabled={settings.nfcEnabled} />;

  if (viewMode === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="text-4xl font-black text-[#EC1D25] mb-8">ALEA SISTEMI</div>
          {settings.nfcEnabled ? (
               <div className="flex flex-col items-center py-4 w-full relative">
                  <input ref={loginInputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && processLoginScan(scanValue)} className="absolute inset-0 opacity-0 cursor-default" autoFocus inputMode="none" />
                  <div className="w-48 h-48 relative flex items-center justify-center mb-8 cursor-pointer" onClick={() => loginInputRef.current?.focus()}>
                      <div className="absolute inset-0 bg-blue-50 rounded-full animate-ping opacity-20"></div>
                      <div className="relative bg-white p-6 rounded-full shadow-lg border-2 border-blue-100 text-blue-600"><Scan size={48} className="animate-pulse" /></div>
                  </div>
                  <div className={`px-4 py-1 rounded-full text-xs font-bold border flex items-center gap-2 mb-6 ${nfcStatus === 'LISTENING' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${nfcStatus === 'LISTENING' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      {nfcStatus === 'LISTENING' ? 'Lettore Attivo' : 'Tocca per Attivare'}
                  </div>
                  <button onClick={() => setShowLoginPinPad(true)} className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium"><KeyRound size={16} /> Usa PIN</button>
               </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {employees.map(emp => <button key={emp.id} onClick={() => handleLogin(emp)} className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg text-left border border-transparent hover:border-blue-100"><div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">{emp.name.charAt(0)}</div><div><span className="block font-medium">{emp.name}</span><span className="text-xs text-slate-400 uppercase">{emp.role}</span></div></button>)}
            </div>
          )}
        </div>
        {showLoginPinPad && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                    <h3 className="text-xl font-bold mb-6">Login PIN</h3>
                    <div className="text-3xl font-mono py-3 bg-slate-100 rounded-lg mb-6">{loginPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                    <div className="grid grid-cols-3 gap-3">
                        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setLoginPin(p => p.length < 6 ? p + n : p)} className="p-3 bg-slate-50 rounded font-bold">{n}</button>)}
                        <button onClick={() => setLoginPin('')} className="p-3 bg-red-50 text-red-500 rounded"><Delete size={20} className="mx-auto"/></button>
                        <button onClick={() => setLoginPin(p => p.length < 6 ? p + '0' : p)} className="p-3 bg-slate-50 rounded font-bold">0</button>
                        <button onClick={() => { const e = employees.find(x => x.pin === loginPin); if(e) handleLogin(e); else setLoginPin(''); }} className="p-3 bg-blue-600 text-white rounded"><CheckCircle size={20} className="mx-auto"/></button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b sticky top-0 z-30 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-800"><LayoutDashboard className="text-blue-600" /> {viewMode === 'WORKSHOP_PANEL' ? 'Pannello Operativo' : 'Dashboard'}</div>
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode(viewMode === 'WORKSHOP_PANEL' ? 'DASHBOARD' : 'WORKSHOP_PANEL')} className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border">{viewMode === 'WORKSHOP_PANEL' ? 'Dashboard' : 'Officina'}</button>
          <div className="text-right hidden md:block"><p className="text-sm font-medium">{currentUser?.name}</p><p className="text-xs text-slate-500">{currentUser?.role}</p></div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full"><LogOut size={20} /></button>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto">
        {viewMode === 'WORKSHOP_PANEL' ? (
          <WorkshopPanel currentUser={currentUser!} jobs={jobs} logs={logs} onAddLog={async (l) => { await dbService.saveWorkLog(l); refreshData(); }} onDeleteLog={async (id) => { if(confirm("Eliminare?")) { await dbService.deleteWorkLog(id); refreshData(); } }} onUpdateLog={async (l) => { await dbService.saveWorkLog(l); refreshData(); }} workPhases={settings.workPhases} onUpdateJobStatus={async (id, s) => { const j = jobs.find(x => x.id === id); if(j) { await dbService.saveJob({...j, status: s}); refreshData(); } }} />
        ) : (
          <AdminDashboard jobs={jobs} logs={logs} employees={employees} attendance={attendance} vehicles={vehicles} vehicleLogs={vehicleLogs} justifications={justifications} customPrompts={aiPrompts} permissions={permissions} onSaveJob={async (j) => { await dbService.saveJob(j); refreshData(); }} onSaveEmployee={async (e) => { await dbService.saveEmployee(e); refreshData(); }} onSaveJustification={async (ju) => { await dbService.saveJustification(ju); refreshData(); }} onSaveAiPrompts={async (p) => { await dbService.saveAiPrompts(p); refreshData(); }} onSavePermissions={async (pe) => { await dbService.savePermissions(pe); refreshData(); }} onUpdateLog={async (l) => { await dbService.saveWorkLog(l); refreshData(); }} currentUserRole={currentUser?.role || Role.EMPLOYEE} settings={settings} onSaveSettings={async (s) => { await dbService.saveSettings(s); refreshData(); }} onSaveAttendance={async (r) => { await dbService.saveAttendance(r); refreshData(); }} onDeleteAttendance={async (id) => { await dbService.deleteAttendance(id); refreshData(); }} onSaveVehicle={async (v) => { await dbService.saveVehicle(v); refreshData(); }} onDeleteVehicle={async (id) => { await dbService.deleteVehicle(id); refreshData(); }} />
        )}
      </main>
    </div>
  );
}

export default App;
