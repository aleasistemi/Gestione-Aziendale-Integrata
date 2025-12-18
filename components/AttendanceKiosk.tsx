import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, Role } from '../types';
import { Clock, CheckCircle, LogIn, LogOut, ArrowLeft, KeyRound, Delete, X, RefreshCcw, Wifi, CloudOff, Info, Play } from 'lucide-react';
import { dbService } from '../services/db';

const getNativeNfc = async () => {
    try {
        const { NFC } = await import('capacitor-nfc');
        return NFC;
    } catch (e) {
        return null;
    }
};

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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [scanValue, setScanValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleOnline = () => { setIsOnline(true); handleSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        clearInterval(timer);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
      setIsSyncing(true);
      const count = await dbService.syncOfflineAttendance();
      if (count > 0) alert(`Sincronizzate ${count} timbrature!`);
      setIsSyncing(false);
  };

  const startNfcScan = async () => {
      if (!nfcEnabled) return;
      const nativeNfc = await getNativeNfc();
      if (nativeNfc) {
          try {
              setNfcStatus('LISTENING');
              setDebugInfo("Utilizzo NFC Nativo (Capacitor)");
              await nativeNfc.addListener('nfcTagDetected', (tag: any) => {
                  const code = tag.id || (tag.message?.records[0]?.data);
                  if (code) processScan(code.toString());
              });
              // Fixed: startScan does not exist on type 'NFCPluginWeb', using scan() and casting to any.
              await (nativeNfc as any).scan();
              return;
          } catch (e) {
              console.error("Native NFC failed", e);
          }
      }

      if ('NDEFReader' in window) {
          try {
              const ndef = new (window as any).NDEFReader();
              await ndef.scan();
              setNfcStatus('LISTENING');
              setDebugInfo("Utilizzo Web NFC (Chrome)");
              ndef.onreading = (event: any) => {
                  let readCode = "";
                  for (const record of event.message.records) {
                      if (record.recordType === "text") {
                          readCode = new TextDecoder(record.encoding).decode(record.data);
                          break;
                      }
                  }
                  if (!readCode) readCode = event.serialNumber.replaceAll(':', '').toUpperCase();
                  processScan(readCode);
              };
          } catch (error: any) {
              setNfcStatus('ERROR');
              setDebugInfo(`Errore Web NFC: ${error.message}`);
          }
      } else {
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
          setMessage(`Badge non riconosciuto: ${cleanCode}`);
          setScanValue('');
          setTimeout(() => setMessage(null), 3000);
      }
  };

  const handleAction = (type: 'ENTRATA' | 'USCITA') => {
    if (!selectedEmp) return;
    const record: AttendanceRecord = { id: Date.now().toString(), employeeId: selectedEmp.id, timestamp: new Date().toISOString(), type };
    onRecord(record);
    setMessage(`Timbrata ${type} per ${selectedEmp.name}`);
    setTimeout(() => { setMessage(null); setSelectedEmp(null); }, 3000);
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center p-6 relative">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-4 left-4 p-2 bg-slate-100 rounded-full text-slate-400 z-50 opacity-10 hover:opacity-100"><ArrowLeft size={24} /></button>
      <div className="absolute top-4 right-4 z-50">
          {!isOnline ? <div className="bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold shadow-md animate-pulse" onClick={handleSync}><CloudOff size={20} /><span>OFFLINE</span></div> : <div className="text-green-500 opacity-50 text-sm">{isSyncing ? <RefreshCcw size={16} className="animate-spin"/> : <Wifi size={16} />}</div>}
      </div>
      <div className="mb-10 text-center"><div className="text-4xl font-black text-[#EC1D25] mb-4">ALEA SISTEMI</div><div className="text-6xl font-mono text-slate-800 flex items-center justify-center gap-3"><Clock size={48} className="text-[#EC1D25]" />{currentTime.toLocaleTimeString('it-IT')}</div></div>
      {!selectedEmp ? (
        <div className="w-full max-w-5xl flex flex-col items-center">
          {message && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg font-bold animate-bounce shadow-lg">{message}</div>}
          {nfcEnabled ? (
              <div className="flex flex-col items-center w-full max-w-md relative">
                  <input ref={inputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && processScan(scanValue)} className="absolute inset-0 opacity-0 cursor-default z-0" autoFocus inputMode="none" />
                  <div className="relative w-64 h-64 mb-8 flex items-center justify-center cursor-pointer z-10" onClick={() => inputRef.current?.focus()}>
                       <div className="absolute inset-0 bg-[#EC1D25] rounded-full animate-ping opacity-10"></div>
                       <div className="relative bg-white p-8 rounded-full shadow-2xl border-4 border-slate-50 text-[#EC1D25]"><Wifi size={64} className="animate-pulse" /></div>
                  </div>
                  <div className={`flex items-center justify-center gap-3 mb-4 px-6 py-2 rounded-full border transition-colors ${nfcStatus === 'LISTENING' ? 'bg-green-50' : 'bg-slate-100'}`}>
                      <div className={`w-3 h-3 rounded-full ${nfcStatus === 'LISTENING' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      <span className="text-slate-600 font-bold uppercase tracking-wider text-sm">{nfcStatus === 'LISTENING' ? 'Lettore Attivo' : 'Attesa Lettore...'}</span>
                  </div>
                  {debugInfo && <div className="mb-8 p-3 bg-slate-50 rounded-lg text-[10px] text-slate-400 flex items-start gap-2 max-w-xs"><Info size={14} /><span>{debugInfo}</span></div>}
                  <button onClick={() => setShowPinPad(true)} className="flex items-center gap-2 text-slate-400 hover:text-[#EC1D25] transition border border-slate-200 px-8 py-3 rounded-full z-20 bg-white"><KeyRound size={20} /> Usa PIN</button>
              </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{employees.map(emp => <button key={emp.id} onClick={() => setSelectedEmp(emp)} className="p-6 bg-white rounded-xl border hover:border-[#EC1D25] flex flex-col items-center gap-3 shadow-sm"><div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold">{emp.name.charAt(0)}</div><span className="font-bold text-slate-700">{emp.name}</span></button>)}</div>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl border-t-4 border-[#EC1D25]">
           {message ? <div className="flex flex-col items-center justify-center py-10 gap-4 text-green-600"><CheckCircle size={80} /><p className="text-2xl font-bold">{message}</p></div> : 
             <><div className="flex justify-between items-center mb-8 border-b pb-4"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-[#EC1D25] text-white flex items-center justify-center text-2xl font-bold">{selectedEmp.name.charAt(0)}</div><div><h2 className="text-2xl font-bold text-slate-800">{selectedEmp.name}</h2><p className="text-slate-500 text-sm uppercase">{selectedEmp.role}</p></div></div><button onClick={() => setSelectedEmp(null)} className="text-sm text-slate-400 underline">Annulla</button></div>
             <div className="grid grid-cols-2 gap-6"><button onClick={() => handleAction('ENTRATA')} className="h-48 bg-green-50 border-2 border-green-500 rounded-xl flex flex-col items-center justify-center gap-4"><LogIn size={64} className="text-green-600" /><span className="text-3xl font-bold text-green-700">ENTRATA</span></button><button onClick={() => handleAction('USCITA')} className="h-48 bg-red-50 border-2 border-[#EC1D25] rounded-xl flex flex-col items-center justify-center gap-4"><LogOut size={64} className="text-[#EC1D25]" /><span className="text-3xl font-bold text-[#EC1D25]">USCITA</span></button></div></>}
        </div>
      )}

      {showPinPad && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">PIN</h3><button onClick={() => {setShowPinPad(false); setEnteredPin('');}}><X size={24}/></button></div><div className="text-center text-4xl font-mono py-4 bg-slate-100 rounded-lg mb-6">{enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setEnteredPin(p => p.length < 6 ? p + n : p)} className="p-4 bg-slate-50 rounded-lg font-bold">{n}</button>)}<button onClick={() => setEnteredPin('')} className="p-4 bg-red-50 text-red-500 rounded-lg"><Delete size={24} className="mx-auto"/></button><button onClick={() => setEnteredPin(p => p.length < 6 ? p + '0' : p)} className="p-4 bg-slate-50 rounded-lg font-bold">0</button><button onClick={() => {const e = employees.find(x => x.pin === enteredPin); if(e){setSelectedEmp(e);setShowPinPad(false);}else{alert("PIN Errato");setEnteredPin('');}}} className="p-4 bg-blue-600 text-white rounded-lg"><CheckCircle size={24} className="mx-auto"/></button></div></div></div>}
      {showExitPinPad && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center"><h3 className="text-xl font-bold mb-6">Uscita</h3><div className="text-3xl font-mono py-4 bg-slate-100 rounded-lg mb-6">{exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setExitPin(p => p.length < 4 ? p + n : p)} className="p-4 bg-slate-50 rounded-lg font-bold">{n}</button>)}<button onClick={() => setExitPin('')} className="p-4"><X size={24} className="mx-auto"/></button><button onClick={() => setExitPin(p => p.length < 4 ? p + '0' : p)} className="p-4 bg-slate-50 rounded-lg font-bold">0</button><button onClick={() => {if(exitPin === '1409') onExit(); else setExitPin('');}} className="p-4 bg-red-600 text-white rounded-lg"><CheckCircle size={24} className="mx-auto"/></button></div></div></div>}
    </div>
  );
};

export default AttendanceKiosk;