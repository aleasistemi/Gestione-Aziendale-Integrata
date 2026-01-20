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

  // Rilevamento altezza per ottimizzazione display 7"
  const [isShortScreen, setIsShortScreen] = useState(window.innerHeight <= 650);

  useEffect(() => {
    const handleResize = () => setIsShortScreen(window.innerHeight <= 650);
    window.addEventListener('resize', handleResize);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(timer);
    };
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
      if (nfcEnabled && !showPinPad && !showExitPinPad && !selectedEmp) {
          const focusInterval = setInterval(() => {
              if (document.activeElement !== inputRef.current) {
                  inputRef.current?.focus();
              }
          }, 1000);
          return () => clearInterval(focusInterval);
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
    <div className={`min-h-screen bg-slate-100 flex flex-col items-center justify-center ${isShortScreen ? 'p-2' : 'p-6'} relative no-select overflow-hidden`}>
      {/* Back Button */}
      <button onClick={() => setShowExitPinPad(true)} className={`absolute ${isShortScreen ? 'top-2 left-2 p-2' : 'top-6 left-6 p-3'} bg-white shadow-md rounded-full text-slate-400 hover:text-[#EC1D25] transition-colors z-50`}>
          <ArrowLeft size={isShortScreen ? 20 : 28} />
      </button>
      
      {/* Header Section */}
      <div className={`${isShortScreen ? 'mb-4' : 'mb-12'} text-center`}>
          <div className={`${isShortScreen ? 'text-2xl' : 'text-5xl'} font-black text-[#EC1D25] ${isShortScreen ? 'mb-1' : 'mb-4'} uppercase tracking-tighter`}>ALEA SISTEMI</div>
          <div className={`${isShortScreen ? 'text-4xl' : 'text-7xl'} font-mono text-slate-800 flex items-center justify-center ${isShortScreen ? 'gap-2' : 'gap-4'}`}>
              <Clock size={isShortScreen ? 32 : 56} className="text-[#EC1D25]" />
              {currentTime.toLocaleTimeString('it-IT')}
          </div>
      </div>

      {!selectedEmp ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          {message && <div className={`${isShortScreen ? 'mb-4 p-3 text-sm' : 'mb-8 p-6'} bg-green-100 text-green-700 border border-green-200 rounded-2xl font-bold shadow-sm animate-bounce`}>{message}</div>}
          
          <div className={`flex flex-col items-center relative ${isShortScreen ? 'py-1' : 'py-6'}`}>
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
              
              <div className={`relative ${isShortScreen ? 'w-32 h-32 mb-4' : 'w-56 h-56 mb-12'} flex items-center justify-center bg-white rounded-3xl shadow-xl border-2 border-slate-50 text-[#EC1D25] z-10`} onClick={() => inputRef.current?.focus()}>
                   <Wifi size={isShortScreen ? 48 : 80} className={nfcStatus === 'LISTENING' ? 'animate-pulse' : ''} />
              </div>
              
              <div className={`${isShortScreen ? 'px-6 py-2 mb-4 text-[10px]' : 'px-10 py-4 mb-10 text-sm'} rounded-full border border-slate-200 bg-white font-bold uppercase tracking-widest text-slate-400 shadow-sm`}>
                  Avvicina il badge al lettore
              </div>
              
              <button 
                  onClick={() => setShowPinPad(true)} 
                  className={`flex items-center gap-3 text-slate-600 hover:text-white hover:bg-[#EC1D25] transition-all bg-white ${isShortScreen ? 'px-8 py-3 rounded-xl text-xs' : 'px-12 py-5 rounded-2xl'} border border-slate-200 font-black uppercase tracking-widest shadow-md z-20`}
              >
                  <KeyRound size={isShortScreen ? 18 : 24} /> Digita PIN Personale
              </button>
          </div>
        </div>
      ) : (
        <div className={`bg-white ${isShortScreen ? 'p-6' : 'p-12'} rounded-3xl shadow-2xl w-full max-w-2xl border-t-[8px] border-[#EC1D25] animate-in fade-in zoom-in duration-300`}>
             <div className={`flex justify-between items-center ${isShortScreen ? 'mb-4 pb-2' : 'mb-12 pb-6'} border-b border-slate-100`}>
                 <div className="flex items-center gap-4">
                     <div className={`${isShortScreen ? 'w-12 h-12 text-xl' : 'w-20 h-20 text-4xl'} rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black`}>{selectedEmp.name.charAt(0)}</div>
                     <div>
                         <h2 className={`${isShortScreen ? 'text-lg' : 'text-3xl'} font-black text-slate-900`}>{selectedEmp.name}</h2>
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{selectedEmp.role}</p>
                     </div>
                 </div>
                 <button onClick={() => setSelectedEmp(null)} className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest">Annulla</button>
             </div>
             
             <div className={`grid grid-cols-2 ${isShortScreen ? 'gap-4' : 'gap-10'}`}>
                 <button onClick={() => handleAction('ENTRATA')} className={`${isShortScreen ? 'h-40' : 'h-64'} bg-green-500 text-white rounded-3xl flex flex-col items-center justify-center ${isShortScreen ? 'gap-2' : 'gap-6'} hover:bg-green-600 transition-all shadow-xl shadow-green-100 group`}>
                     <LogIn size={isShortScreen ? 50 : 90} className="group-hover:scale-110 transition-transform" />
                     <span className={`${isShortScreen ? 'text-lg' : 'text-3xl'} font-black tracking-tighter uppercase`}>Entrata</span>
                 </button>
                 <button onClick={() => handleAction('USCITA')} className={`${isShortScreen ? 'h-40' : 'h-64'} bg-[#EC1D25] text-white rounded-3xl flex flex-col items-center justify-center ${isShortScreen ? 'gap-2' : 'gap-6'} hover:bg-red-700 transition-all shadow-xl shadow-red-100 group`}>
                     <LogOut size={isShortScreen ? 50 : 90} className="group-hover:scale-110 transition-transform" />
                     <span className={`${isShortScreen ? 'text-lg' : 'text-3xl'} font-black tracking-tighter uppercase`}>Uscita</span>
                 </button>
             </div>
        </div>
      )}

      {/* PIN Pad Modals */}
      {showPinPad && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] p-4">
              <div className={`bg-white ${isShortScreen ? 'p-4' : 'p-8'} rounded-3xl w-full max-w-sm text-center shadow-2xl`}>
                  <h3 className={`${isShortScreen ? 'text-xl mb-4' : 'text-2xl mb-8'} font-black text-slate-800 uppercase tracking-tight`}>PIN Personale</h3>
                  <div className={`${isShortScreen ? 'text-3xl py-3 mb-6' : 'text-5xl py-6 mb-10'} font-mono bg-slate-100 rounded-2xl tracking-[0.5em] text-slate-900 font-black`}>
                      {enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className={`grid grid-cols-3 ${isShortScreen ? 'gap-2' : 'gap-5'}`}>
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                          <button key={n} onClick={() => setEnteredPin(p => p.length < 6 ? p + n : p)} className={`${isShortScreen ? 'h-14 text-xl' : 'h-20 text-3xl'} bg-slate-50 rounded-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all`}>{n}</button>
                      ))}
                      <button onClick={() => setEnteredPin('')} className={`${isShortScreen ? 'h-14' : 'h-20'} bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100`}><Delete size={isShortScreen ? 24 : 32}/></button>
                      <button onClick={() => setEnteredPin(p => p.length < 6 ? p + '0' : p)} className={`${isShortScreen ? 'h-14 text-xl' : 'h-20 text-3xl'} bg-slate-50 rounded-2xl font-black text-slate-700 hover:bg-slate-200`}>0</button>
                      <button 
                          onClick={() => {
                              const e = employees.find(x => x.pin === enteredPin); 
                              if(e) { setSelectedEmp(e); setShowPinPad(false); setEnteredPin(''); } 
                              else { setEnteredPin(''); }
                          }} 
                          className={`${isShortScreen ? 'h-14' : 'h-20'} bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700`}
                      >
                          <CheckCircle size={isShortScreen ? 24 : 32}/>
                      </button>
                  </div>
                  <button onClick={() => {setShowPinPad(false); setEnteredPin('');}} className={`${isShortScreen ? 'mt-4' : 'mt-10'} text-slate-400 font-bold uppercase tracking-widest text-xs`}>Chiudi</button>
              </div>
          </div>
      )}

      {showExitPinPad && (
          <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-[110] p-4">
              <div className={`bg-white ${isShortScreen ? 'p-4' : 'p-8'} rounded-3xl w-full max-w-sm text-center shadow-2xl`}>
                  <h3 className={`${isShortScreen ? 'text-xl mb-4' : 'text-2xl mb-8'} font-black text-slate-800 uppercase tracking-tight`}>Uscita Amministratore</h3>
                  <div className={`${isShortScreen ? 'text-3xl py-3 mb-6' : 'text-5xl py-6 mb-10'} font-mono bg-slate-100 rounded-2xl tracking-[0.5em] text-slate-900 font-black`}>
                      {exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className={`grid grid-cols-3 ${isShortScreen ? 'gap-2' : 'gap-5'}`}>
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                          <button key={n} onClick={() => setExitPin(p => p.length < 4 ? p + n : p)} className={`${isShortScreen ? 'h-14 text-xl' : 'h-20 text-3xl'} bg-slate-50 rounded-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all`}>{n}</button>
                      ))}
                      <button onClick={() => setExitPin('')} className={`${isShortScreen ? 'h-14' : 'h-20'} bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100`}><X size={isShortScreen ? 24 : 32}/></button>
                      <button onClick={() => setExitPin(p => p.length < 4 ? p + '0' : p)} className={`${isShortScreen ? 'h-14 text-xl' : 'h-20 text-3xl'} bg-slate-50 rounded-2xl font-black text-slate-700 hover:bg-slate-200`}>0</button>
                      <button 
                          onClick={() => { if(exitPin === '1409') onExit(); else { setExitPin(''); } }} 
                          className={`${isShortScreen ? 'h-14' : 'h-20'} bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700`}
                      >
                          <CheckCircle size={isShortScreen ? 24 : 32}/>
                      </button>
                  </div>
                  <button onClick={() => {setShowExitPinPad(false); setExitPin('');}} className={`${isShortScreen ? 'mt-4' : 'mt-10'} text-slate-400 font-bold uppercase tracking-widest text-xs`}>Annulla</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default AttendanceKiosk;