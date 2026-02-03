
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, Role } from '../types';
import { Clock, CheckCircle, LogIn, LogOut, ArrowLeft, Scan, KeyRound, Delete, X, RefreshCcw, Wifi, AlertCircle, Play, Laptop, CloudOff, CheckCircle2 } from 'lucide-react';
import { dbService } from '../services/db';

interface Props {
  employees: Employee[];
  onRecord: (record: AttendanceRecord) => void;
  onExit: () => void;
  nfcEnabled: boolean;
}

const AttendanceKiosk: React.FC<Props> = ({ employees, onRecord, onExit, nfcEnabled }) => {
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<'ENTRATA' | 'USCITA' | null>(null);
  
  const [scanValue, setScanValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const ndefRef = useRef<any>(null);

  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Rilevamento altezza per display 7"
  const [isShortScreen, setIsShortScreen] = useState(window.innerHeight <= 600);

  const visibleEmployees = employees.filter(e => 
    e.role !== Role.SYSTEM_ADMIN && 
    e.role !== Role.DIRECTION
  );

  useEffect(() => {
    const handleResize = () => setIsShortScreen(window.innerHeight <= 600);
    window.addEventListener('resize', handleResize);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleOnline = () => { setIsOnline(true); handleSync(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    requestWakeLock();

    return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(timer);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
          try {
              const wakeLock = await (navigator as any).wakeLock.request('screen');
              wakeLock.addEventListener('release', () => {
                  if (document.visibilityState === 'visible') requestWakeLock();
              });
          } catch (err: any) {
              console.error(`${err.name}, ${err.message}`);
          }
      }
  }

  const handleSync = async () => {
      setIsSyncing(true);
      const count = await dbService.syncOfflineAttendance();
      if (count > 0) setMessage(`Sincronizzate ${count} timbrature!`);
      setIsSyncing(false);
  }

  const hasNfcSupport = 'NDEFReader' in window;

  const startNfcScan = async () => {
      if (nfcEnabled && hasNfcSupport) {
          try {
              const ndef = new (window as any).NDEFReader();
              ndefRef.current = ndef;
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
                  if (!readCode) {
                      readCode = event.serialNumber.replaceAll(':', '').toUpperCase();
                  }
                  processScan(readCode);
              };

              ndef.onreadingerror = () => setMessage("Errore lettura NFC.");
          } catch (error) { setNfcStatus('ERROR'); }
      } else if (!hasNfcSupport) {
          setNfcStatus('UNSUPPORTED');
      }
  };

  useEffect(() => {
      if(nfcEnabled && !selectedEmp) startNfcScan();
  }, [nfcEnabled, selectedEmp]);

  useEffect(() => {
      if (nfcEnabled && !showPinPad && !showExitPinPad && !selectedEmp) {
          const focusInterval = setInterval(() => {
              if (document.activeElement !== inputRef.current) inputRef.current?.focus();
          }, 500);
          return () => clearInterval(focusInterval);
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, selectedEmp]);

  const processScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => 
          (e.nfcCode?.toUpperCase() === cleanCode) ||
          (e.nfcCode2?.toUpperCase() === cleanCode) ||
          (e.id.toUpperCase() === cleanCode)
      );
      if (emp) {
          setSelectedEmp(emp);
          setScanValue('');
          if (navigator.vibrate) navigator.vibrate(200);
      } else {
          setMessage(`Badge non riconosciuto`);
          setScanValue('');
          setTimeout(() => setMessage(null), 3000);
      }
  };

  const handleAction = (type: 'ENTRATA' | 'USCITA') => {
    if (!selectedEmp) return;
    
    // Feedback istantaneo
    setIsSuccess(type);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Registrazione
    onRecord({ id: Date.now().toString(), employeeId: selectedEmp.id, timestamp: new Date().toISOString(), type });
    
    setTimeout(() => {
      setIsSuccess(null);
      setSelectedEmp(null);
      setShowPinPad(false);
      setEnteredPin('');
      setMessage(null);
    }, 2500);
  };

  return (
    <div className={`min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center ${isShortScreen ? 'p-2' : 'p-6'} relative no-select overflow-hidden`}>
      <button onClick={() => setShowExitPinPad(true)} className={`absolute ${isShortScreen ? 'top-2 left-2 p-2' : 'top-4 left-4 p-2'} bg-slate-100 rounded-full text-slate-400 opacity-20 hover:opacity-100 transition-opacity z-50`}>
        <ArrowLeft size={isShortScreen ? 20 : 24} />
      </button>

      <div className="absolute top-4 right-4 z-50">
          {!isOnline && (
              <div className="flex items-center gap-2 bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold shadow-md animate-pulse">
                  <CloudOff size={20} /> <span className="text-xs">OFFLINE</span>
              </div>
          )}
      </div>

      {/* Header */}
      <div className={`${isShortScreen ? 'mb-4' : 'mb-10'} text-center`}>
        <div className={`${isShortScreen ? 'mb-1' : 'mb-6'} flex flex-col items-center`}>
            <div className={`${isShortScreen ? 'text-2xl' : 'text-4xl'} font-black text-[#EC1D25] tracking-tighter`}>ALEA</div>
            <div className={`${isShortScreen ? 'text-[8px]' : 'text-sm'} font-bold text-slate-500 tracking-[0.3em] uppercase`}>Sistemi</div>
        </div>
        
        <div className={`${isShortScreen ? 'text-4xl' : 'text-6xl'} font-mono font-light text-slate-800 flex items-center justify-center gap-2`}>
            <Clock size={isShortScreen ? 32 : 48} className="text-[#EC1D25]" />
            {currentTime.toLocaleTimeString('it-IT')}
        </div>
      </div>

      {!selectedEmp ? (
        <div className="w-full max-w-4xl flex flex-col items-center">
          {message && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg font-bold shadow-lg text-sm">{message}</div>}

          {nfcEnabled ? (
              <div className="flex flex-col items-center w-full max-w-md relative">
                  <input ref={inputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' && processScan(scanValue))} className="absolute inset-0 opacity-0 cursor-default z-0" inputMode="none" autoFocus />
                  
                  <div className={`relative ${isShortScreen ? 'w-40 h-40 mb-4' : 'w-64 h-64 mb-8'} flex items-center justify-center cursor-pointer z-10`} onClick={() => inputRef.current?.focus()}>
                       <div className="absolute inset-0 bg-[#EC1D25] rounded-full animate-ping opacity-5"></div>
                       <div className="relative bg-white p-6 rounded-full shadow-2xl border-4 border-slate-50 text-[#EC1D25]">
                           <Wifi size={isShortScreen ? 48 : 64} className="animate-pulse" />
                       </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 ${isShortScreen ? 'mb-4 px-4 py-1.5' : 'mb-8 px-6 py-2'} rounded-full border bg-slate-50`}>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${nfcStatus === 'LISTENING' || nfcStatus === 'UNSUPPORTED' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                      <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          {nfcStatus === 'LISTENING' ? 'NFC Mobile Attivo' : 'Lettore USB Pronto'}
                      </span>
                  </div>

                  <button onClick={() => setShowPinPad(true)} className={`flex items-center gap-2 text-slate-400 hover:text-[#EC1D25] transition border border-slate-200 ${isShortScreen ? 'px-6 py-2 text-xs' : 'px-8 py-3'} rounded-full bg-white z-20`}>
                      <KeyRound size={isShortScreen ? 16 : 20} /> Usa PIN
                  </button>
              </div>
          ) : (
            <div className={`grid grid-cols-2 md:grid-cols-4 ${isShortScreen ? 'gap-2' : 'gap-4'}`}>
                {visibleEmployees.map(emp => (
                <button key={emp.id} onClick={() => setSelectedEmp(emp)} className={`p-4 bg-white rounded-xl border border-slate-200 hover:border-[#EC1D25] flex flex-col items-center gap-2 group shadow-sm transition-all`}>
                    <div className={`${isShortScreen ? 'w-12 h-12 text-sm' : 'w-16 h-16 text-xl'} rounded-full bg-slate-100 group-hover:bg-[#EC1D25] group-hover:text-white flex items-center justify-center font-bold text-slate-600`}>{emp.name.charAt(0)}</div>
                    <span className={`font-bold ${isShortScreen ? 'text-xs' : 'text-sm'} text-slate-700`}>{emp.name}</span>
                </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className={`bg-white ${isShortScreen ? 'p-4' : 'p-8'} rounded-2xl shadow-2xl w-full max-w-xl border-t-4 border-[#EC1D25] animate-in fade-in`}>
           <div className={`flex justify-between items-center ${isShortScreen ? 'mb-4 pb-2' : 'mb-8 pb-4'} border-b border-slate-100`}>
              <div className="flex items-center gap-4">
                 <div className={`${isShortScreen ? 'w-12 h-12 text-lg' : 'w-16 h-16 text-xl'} rounded-full bg-[#EC1D25] text-white flex items-center justify-center font-bold`}>{selectedEmp.name.charAt(0)}</div>
                 <div>
                   <h2 className={`${isShortScreen ? 'text-lg' : 'text-xl'} font-bold text-slate-800`}>{selectedEmp.name}</h2>
                   <p className="text-slate-500 text-[10px] font-medium uppercase">{selectedEmp.department}</p>
                 </div>
              </div>
              {!isSuccess && <button onClick={() => setSelectedEmp(null)} className="text-xs text-slate-400 hover:text-[#EC1D25] underline">Annulla</button>}
           </div>

           {isSuccess ? (
               <div className="flex flex-col items-center justify-center py-8 animate-in zoom-in duration-300">
                   <div className="bg-green-100 p-6 rounded-full mb-6">
                        <CheckCircle2 size={80} className="text-green-600" />
                   </div>
                   <h2 className="text-3xl font-black text-green-700 uppercase tracking-tighter">
                       {isSuccess} REGISTRATA
                   </h2>
                   <p className="text-slate-400 mt-2 font-bold uppercase tracking-widest text-xs">Arrivederci!</p>
               </div>
           ) : (
               <div className={`grid grid-cols-2 ${isShortScreen ? 'gap-4' : 'gap-6'}`}>
                  <button onClick={() => handleAction('ENTRATA')} className={`${isShortScreen ? 'h-32' : 'h-48'} bg-green-50 hover:bg-green-100 border-2 border-green-500 rounded-xl flex flex-col items-center justify-center gap-2 transition group`}>
                    <LogIn size={isShortScreen ? 48 : 64} className="text-green-600 group-hover:scale-110 transition-transform" />
                    <span className={`${isShortScreen ? 'text-xl' : 'text-2xl'} font-bold text-green-700`}>ENTRATA</span>
                  </button>
                  <button onClick={() => handleAction('USCITA')} className={`${isShortScreen ? 'h-32' : 'h-48'} bg-red-50 hover:bg-red-100 border-2 border-[#EC1D25] rounded-xl flex flex-col items-center justify-center gap-2 transition group`}>
                    <LogOut size={isShortScreen ? 48 : 64} className="text-[#EC1D25] group-hover:scale-110 transition-transform" />
                    <span className={`${isShortScreen ? 'text-xl' : 'text-2xl'} font-bold text-[#EC1D25]`}>USCITA</span>
                  </button>
               </div>
           )}
        </div>
      )}

      {/* PIN PAD MODALS - Ottimizzate per 7" */}
      {(showPinPad || showExitPinPad) && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-2">
              <div className={`bg-white ${isShortScreen ? 'p-3' : 'p-6'} rounded-2xl w-full max-w-xs shadow-2xl`}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{showExitPinPad ? 'Esci' : 'Inserisci PIN'}</h3>
                      <button onClick={() => {setShowPinPad(false); setShowExitPinPad(false); setEnteredPin(''); setExitPin('');}}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className={`${isShortScreen ? 'text-2xl py-2 mb-4' : 'text-4xl py-4 mb-6'} text-center font-mono tracking-widest bg-slate-100 rounded-lg`}>
                      {(showExitPinPad ? exitPin : enteredPin).padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className={`grid grid-cols-3 ${isShortScreen ? 'gap-1.5' : 'gap-3'}`}>
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => showExitPinPad ? setExitPin(p => p.length < 4 ? p + num : p) : setEnteredPin(p => p.length < 6 ? p + num : p)} className={`${isShortScreen ? 'h-12' : 'h-16'} bg-slate-50 rounded-lg text-xl font-bold text-slate-700 hover:bg-blue-50 transition border border-slate-200`}>{num}</button>
                      ))}
                      <button onClick={() => showExitPinPad ? setExitPin('') : setEnteredPin('')} className={`${isShortScreen ? 'h-12' : 'h-16'} bg-red-50 text-red-600 rounded-lg`}><Delete size={20} className="mx-auto"/></button>
                      <button onClick={() => showExitPinPad ? setExitPin(p => p.length < 4 ? p + '0' : p) : setEnteredPin(p => p.length < 6 ? p + '0' : p)} className={`${isShortScreen ? 'h-12' : 'h-16'} bg-slate-50 rounded-lg text-xl font-bold`}>0</button>
                      <button onClick={() => showExitPinPad ? handleExitVerify() : handlePinSubmit()} className={`${isShortScreen ? 'h-12' : 'h-16'} bg-blue-600 text-white rounded-lg`}><CheckCircle size={20} className="mx-auto"/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );

  function handlePinSubmit() {
      const emp = employees.find(e => e.pin === enteredPin);
      if (emp) { setSelectedEmp(emp); setShowPinPad(false); setEnteredPin(''); }
      else { setMessage("PIN non valido"); setEnteredPin(''); setTimeout(() => setMessage(null), 2000); }
  }

  function handleExitVerify() {
      if (exitPin === '1409') onExit();
      else { alert("PIN Errato"); setExitPin(''); }
  }
};

export default AttendanceKiosk;
