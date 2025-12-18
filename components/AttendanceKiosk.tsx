
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { Clock, LogIn, LogOut, ArrowLeft, KeyRound, Delete, X, Wifi, CloudOff, CheckCircle } from 'lucide-react';
import { dbService } from '../services/db';

const getNativeNfc = async () => {
    try {
        const { NFC } = await import('capacitor-nfc');
        return NFC;
    } catch { return null; }
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
  const [scanValue, setScanValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startNfcScan = async () => {
      if (!nfcEnabled || selectedEmp) return;
      const nativeNfc = await getNativeNfc();
      if (nativeNfc) {
          try {
              setNfcStatus('LISTENING');
              await nativeNfc.addListener('nfcTagDetected', (tag: any) => {
                  const code = tag.id || (tag.message?.records[0]?.data);
                  if (code) processScan(code.toString());
              });
              await (nativeNfc as any).scan();
          } catch { setNfcStatus('ERROR'); }
      }
  };

  useEffect(() => {
      if(nfcEnabled && !selectedEmp) startNfcScan();
  }, [nfcEnabled, selectedEmp]);

  useEffect(() => {
      if (nfcEnabled && !showPinPad && !showExitPinPad && !selectedEmp) {
          inputRef.current?.focus();
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, selectedEmp]);

  const processScan = (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => (e.nfcCode?.toUpperCase() === cleanCode) || (e.nfcCode2?.toUpperCase() === cleanCode) || (e.id.toUpperCase() === cleanCode));
      if (emp) setSelectedEmp(emp);
      setScanValue('');
  };

  const handleAction = (type: 'ENTRATA' | 'USCITA') => {
    if (!selectedEmp) return;
    onRecord({ id: Date.now().toString(), employeeId: selectedEmp.id, timestamp: new Date().toISOString(), type });
    setMessage(`Timbrata ${type} registrata`);
    setTimeout(() => { setMessage(null); setSelectedEmp(null); }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 relative">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-4 left-4 p-2 bg-slate-200 rounded-full text-slate-500 z-10"><ArrowLeft size={24} /></button>
      
      <div className="mb-10 text-center">
          <div className="text-4xl font-black text-[#EC1D25] mb-2 uppercase tracking-tighter">ALEA SISTEMI</div>
          <div className="text-6xl font-mono text-slate-800 flex items-center justify-center gap-3"><Clock size={48} className="text-[#EC1D25]" />{currentTime.toLocaleTimeString('it-IT')}</div>
      </div>

      {!selectedEmp ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          {message && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg font-bold shadow-lg">{message}</div>}
          
          <div className="flex flex-col items-center relative py-6">
              <input ref={inputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && processScan(scanValue)} className="absolute inset-0 opacity-0 z-0" autoFocus />
              <div className="relative w-48 h-48 mb-10 flex items-center justify-center bg-white rounded-full shadow-lg border-2 border-slate-100 text-[#EC1D25] z-10" onClick={() => inputRef.current?.focus()}>
                   <Wifi size={64} />
              </div>
              <div className="px-6 py-2 rounded-full border border-slate-200 bg-white text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">Passa il badge per timbrare</div>
              <button onClick={() => setShowPinPad(true)} className="flex items-center gap-2 text-slate-500 hover:text-[#EC1D25] transition bg-white px-8 py-3 rounded-xl border border-slate-200 font-bold z-20"><KeyRound size={20} /> Usa Codice PIN</button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl border-t-8 border-[#EC1D25]">
             <div className="flex justify-between items-center mb-10 pb-4 border-b">
                 <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center text-2xl font-black">{selectedEmp.name.charAt(0)}</div>
                     <div><h2 className="text-2xl font-bold text-slate-900">{selectedEmp.name}</h2><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{selectedEmp.role}</p></div>
                 </div>
                 <button onClick={() => setSelectedEmp(null)} className="text-sm font-bold text-slate-400 hover:text-red-500 transition">Annulla</button>
             </div>
             <div className="grid grid-cols-2 gap-6">
                 <button onClick={() => handleAction('ENTRATA')} className="h-48 bg-green-500 text-white rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-green-600 transition shadow-lg">
                     <LogIn size={64} /><span className="text-2xl font-black">ENTRATA</span>
                 </button>
                 <button onClick={() => handleAction('USCITA')} className="h-48 bg-[#EC1D25] text-white rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-red-700 transition shadow-lg">
                     <LogOut size={64} /><span className="text-2xl font-black">USCITA</span>
                 </button>
             </div>
        </div>
      )}

      {showPinPad && <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100]"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl"><h3 className="text-xl font-bold mb-6 text-slate-800">Inserisci PIN</h3><div className="text-3xl font-mono py-4 bg-slate-100 rounded-xl mb-6 tracking-widest text-slate-900">{enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setEnteredPin(p => p.length < 6 ? p + n : p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">{n}</button>)}<button onClick={() => setEnteredPin('')} className="h-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition"><Delete size={24}/></button><button onClick={() => setEnteredPin(p => p.length < 6 ? p + '0' : p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">0</button><button onClick={() => {const e = employees.find(x => x.pin === enteredPin); if(e){setSelectedEmp(e);setShowPinPad(false);}else{setEnteredPin('');}}} className="h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition"><CheckCircle size={24}/></button></div><button onClick={() => setShowPinPad(false)} className="mt-6 text-slate-400 font-bold">Chiudi</button></div></div>}
      {showExitPinPad && <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[110]"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl"><h3 className="text-xl font-bold mb-6 text-slate-800">Uscita Totem</h3><div className="text-3xl font-mono py-4 bg-slate-100 rounded-xl mb-6 tracking-widest text-slate-900">{exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setExitPin(p => p.length < 4 ? p + n : p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">{n}</button>)}<button onClick={() => setExitPin('')} className="h-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition"><X size={24}/></button><button onClick={() => setExitPin(p => p.length < 4 ? p + '0' : p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">0</button><button onClick={() => {if(exitPin === '1409') onExit(); else setExitPin('');}} className="h-16 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition"><CheckCircle size={24}/></button></div><button onClick={() => setShowExitPinPad(false)} className="mt-6 text-slate-400 font-bold">Annulla</button></div></div>}
    </div>
  );
};

export default AttendanceKiosk;
