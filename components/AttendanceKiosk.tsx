
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { Clock, LogIn, LogOut, ArrowLeft, KeyRound, Delete, X, Wifi, CheckCircle } from 'lucide-react';

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
                  const code = tag.id || (tag.message?.records?.[0]?.data);
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
      // Focus persistente per lettori USB
      if (nfcEnabled && !showPinPad && !showExitPinPad && !selectedEmp) {
          const interval = setInterval(() => {
              if (document.activeElement !== inputRef.current) {
                  inputRef.current?.focus();
              }
          }, 500);
          return () => clearInterval(interval);
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, selectedEmp]);

  const processScan = (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => 
          (e.nfcCode?.toUpperCase() === cleanCode) || 
          (e.nfcCode2?.toUpperCase() === cleanCode) || 
          (e.id.toUpperCase() === cleanCode)
      );
      if (emp) setSelectedEmp(emp);
      setScanValue('');
  };

  const handleAction = (type: 'ENTRATA' | 'USCITA') => {
    if (!selectedEmp) return;
    onRecord({ id: Date.now().toString(), employeeId: selectedEmp.id, timestamp: new Date().toISOString(), type });
    setMessage(`Timbrata ${type} registrata per ${selectedEmp.name}`);
    setSelectedEmp(null);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 relative no-select">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-6 left-6 p-3 bg-white shadow-md rounded-full text-slate-400 hover:text-[#EC1D25] transition-colors z-50">
          <ArrowLeft size={28} />
      </button>
      
      <div className="mb-12 text-center">
          <div className="text-5xl font-black text-[#EC1D25] mb-4 uppercase tracking-tighter">ALEA SISTEMI</div>
          <div className="text-7xl font-mono text-slate-800 flex items-center justify-center gap-4">
              <Clock size={56} className="text-[#EC1D25]" />
              {currentTime.toLocaleTimeString('it-IT')}
          </div>
      </div>

      {!selectedEmp ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          {message && <div className="mb-8 p-6 bg-green-100 text-green-700 border border-green-200 rounded-2xl font-bold shadow-sm animate-bounce">{message}</div>}
          
          <div className="flex flex-col items-center relative py-6">
              {/* Input invisibile per lettori USB HID */}
              <input 
                  ref={inputRef} 
                  type="text" 
                  value={scanValue} 
                  onChange={(e) => setScanValue(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && processScan(scanValue)} 
                  className="absolute inset-0 opacity-0 z-0 pointer-events-none" 
                  autoFocus 
                  inputMode="none"
              />
              
              <div className="relative w-56 h-56 mb-12 flex items-center justify-center bg-white rounded-3xl shadow-xl border-2 border-slate-50 text-[#EC1D25] z-10" onClick={() => inputRef.current?.focus()}>
                   <Wifi size={80} className={nfcStatus === 'LISTENING' ? 'animate-pulse' : ''} />
              </div>
              
              <div className="px-10 py-4 rounded-full border border-slate-200 bg-white text-sm font-bold uppercase tracking-widest text-slate-400 mb-10 shadow-sm">
                  Avvicina il badge al lettore
              </div>
              
              <button 
                  onClick={() => setShowPinPad(true)} 
                  className="flex items-center gap-3 text-slate-600 hover:text-white hover:bg-[#EC1D25] transition-all bg-white px-12 py-5 rounded-2xl border border-slate-200 font-black uppercase tracking-widest shadow-md z-20"
              >
                  <KeyRound size={24} /> Digita PIN Personale
              </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl shadow-2xl w-full max-w-2xl border-t-[12px] border-[#EC1D25] animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-center mb-12 pb-6 border-b border-slate-100">
                 <div className="flex items-center gap-6">
                     <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-4xl font-black">{selectedEmp.name.charAt(0)}</div>
                     <div>
                         <h2 className="text-3xl font-black text-slate-900">{selectedEmp.name}</h2>
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{selectedEmp.role}</p>
                     </div>
                 </div>
                 <button onClick={() => setSelectedEmp(null)} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest">Annulla</button>
             </div>
             
             <div className="grid grid-cols-2 gap-10">
                 <button onClick={() => handleAction('ENTRATA')} className="h-64 bg-green-500 text-white rounded-3xl flex flex-col items-center justify-center gap-6 hover:bg-green-600 transition-all shadow-xl shadow-green-100 group">
                     <LogIn size={90} className="group-hover:scale-110 transition-transform" />
                     <span className="text-3xl font-black tracking-tighter">ENTRATA</span>
                 </button>
                 <button onClick={() => handleAction('USCITA')} className="h-64 bg-[#EC1D25] text-white rounded-3xl flex flex-col items-center justify-center gap-6 hover:bg-red-700 transition-all shadow-xl shadow-red-100 group">
                     <LogOut size={90} className="group-hover:scale-110 transition-transform" />
                     <span className="text-3xl font-black tracking-tighter">USCITA</span>
                 </button>
             </div>
        </div>
      )}

      {/* PIN PAD PERSONALE */}
      {showPinPad && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
                  <h3 className="text-2xl font-black mb-8 text-slate-800 tracking-tight">Accesso con PIN</h3>
                  <div className="text-5xl font-mono py-6 bg-slate-100 rounded-2xl mb-10 tracking-[0.5em] text-slate-900 font-black">
                      {enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                          <button key={n} onClick={() => setEnteredPin(p => p.length < 6 ? p + n : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{n}</button>
                      ))}
                      <button onClick={() => setEnteredPin('')} className="h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"><Delete size={32}/></button>
                      <button onClick={() => setEnteredPin(p => p.length < 6 ? p + '0' : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">0</button>
                      <button 
                          onClick={() => {
                              const e = employees.find(x => x.pin === enteredPin); 
                              if(e) { setSelectedEmp(e); setShowPinPad(false); setEnteredPin(''); } 
                              else { setEnteredPin(''); alert("PIN Errato"); }
                          }} 
                          className="h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
                      >
                          <CheckCircle size={32}/>
                      </button>
                  </div>
                  <button onClick={() => {setShowPinPad(false); setEnteredPin('');}} className="mt-10 text-slate-400 font-bold uppercase tracking-widest hover:text-slate-600 transition-colors">Chiudi</button>
              </div>
          </div>
      )}

      {/* PIN PAD USCITA TOTEM */}
      {showExitPinPad && (
          <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-[110] p-4">
              <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
                  <h3 className="text-2xl font-black mb-8 text-slate-800">Uscita Amministratore</h3>
                  <div className="text-5xl font-mono py-6 bg-slate-100 rounded-2xl mb-10 tracking-[0.5em] text-slate-900 font-black">
                      {exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                          <button key={n} onClick={() => setExitPin(p => p.length < 4 ? p + n : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{n}</button>
                      ))}
                      <button onClick={() => setExitPin('')} className="h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"><X size={32}/></button>
                      <button onClick={() => setExitPin(p => p.length < 4 ? p + '0' : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">0</button>
                      <button 
                          onClick={() => { if(exitPin === '1409') onExit(); else { setExitPin(''); alert("PIN Errato"); } }} 
                          className="h-20 bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700 active:scale-95 transition-all shadow-lg"
                      >
                          <CheckCircle size={32}/>
                      </button>
                  </div>
                  <button onClick={() => {setShowExitPinPad(false); setExitPin('');}} className="mt-10 text-slate-400 font-bold uppercase tracking-widest hover:text-slate-600">Annulla</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default AttendanceKiosk;
