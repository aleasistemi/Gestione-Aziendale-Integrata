
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, Role } from '../types';
import { Clock, CheckCircle, LogIn, LogOut, ArrowLeft, Scan, KeyRound, Delete, X, RefreshCcw, Wifi, AlertCircle, Play } from 'lucide-react';

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
  
  // Scanner Input State (Legacy / USB Reader)
  const [scanValue, setScanValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Web NFC State (Mobile)
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const ndefRef = useRef<any>(null);

  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Exit PIN State
  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');

  // Filter out non-operational roles (Unless they use PIN)
  const visibleEmployees = employees.filter(e => 
    e.role !== Role.SYSTEM_ADMIN && 
    e.role !== Role.DIRECTION
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startNfcScan = async () => {
      if (nfcEnabled && 'NDEFReader' in window) {
          try {
              const ndef = new window.NDEFReader();
              ndefRef.current = ndef;
              await ndef.scan();
              setNfcStatus('LISTENING');
              console.log("NFC Scan started successfully");

              ndef.onreading = (event: any) => {
                  const serialNumber = event.serialNumber;
                  console.log("NFC Read:", serialNumber);
                  
                  // Strategy 1: Try Serial Number
                  const cleanSerial = serialNumber.replaceAll(':', '').toUpperCase();
                  processScan(cleanSerial);
              };

              ndef.onreadingerror = () => {
                  setMessage("Errore lettura NFC. Riprova.");
              };

          } catch (error) {
              console.error("NFC Error:", error);
              setNfcStatus('ERROR');
          }
      } else if (!('NDEFReader' in window)) {
          setNfcStatus('UNSUPPORTED');
      }
  };

  // --- WEB NFC LOGIC (MOBILE) ---
  useEffect(() => {
      if(nfcEnabled && !selectedEmp) {
          startNfcScan();
      }
  }, [nfcEnabled, selectedEmp]);


  // --- USB READER LOGIC (FALLBACK) ---
  // Force focus on the scanner input continuously if not in a modal
  useEffect(() => {
      if (nfcEnabled && !showPinPad && !showExitPinPad && !selectedEmp) {
          const focusInterval = setInterval(() => {
              if (document.activeElement !== inputRef.current) {
                  inputRef.current?.focus();
              }
          }, 500);
          return () => clearInterval(focusInterval);
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, selectedEmp]);

  const processScan = (code: string) => {
      if (code.length < 2) return;
      
      const cleanCode = code.trim().toUpperCase();
      console.log("Checking code:", cleanCode); 
      
      const emp = employees.find(e => 
          (e.nfcCode && e.nfcCode.trim().toUpperCase() === cleanCode) ||
          (e.nfcCode2 && e.nfcCode2.trim().toUpperCase() === cleanCode)
      );
                
      if (emp) {
          setSelectedEmp(emp);
          setScanValue('');
          if (navigator.vibrate) navigator.vibrate(200);
      } else {
          setMessage(`Badge non riconosciuto: ${cleanCode}`);
          setScanValue('');
          setTimeout(() => setMessage(null), 3000);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          processScan(scanValue);
      }
  };

  const handleAction = (type: 'ENTRATA' | 'USCITA') => {
    if (!selectedEmp) return;

    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      employeeId: selectedEmp.id,
      timestamp: new Date().toISOString(),
      type
    };

    onRecord(newRecord);
    setMessage(`Timbratura ${type} registrata per ${selectedEmp.name}`);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setMessage(null);
      setSelectedEmp(null);
      setShowPinPad(false);
      setEnteredPin('');
      // Refocus scanner
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 3000);
  };

  const handlePinSubmit = () => {
      const emp = employees.find(e => e.pin === enteredPin);
      if (emp) {
          setSelectedEmp(emp);
          setShowPinPad(false);
          setEnteredPin('');
      } else {
          setMessage("PIN non valido");
          setEnteredPin('');
          setTimeout(() => setMessage(null), 2000);
      }
  }

  const handleExitVerify = () => {
      if (exitPin === '1409') {
          onExit();
      } else {
          alert("PIN Errato");
          setExitPin('');
      }
  }

  const handlePinInput = (num: string) => {
      if (enteredPin.length < 6) setEnteredPin(prev => prev + num);
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={() => setShowExitPinPad(true)} 
        className="absolute top-4 left-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition text-slate-500 z-50 opacity-10 hover:opacity-100"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Header Logo Area */}
      <div className="mb-10 text-center">
        <div className="mb-6 flex justify-center">
            {/* Logo Placeholder - Alea Style */}
            <div className="flex flex-col items-center">
                <div className="text-4xl font-black text-[#EC1D25] tracking-tighter" style={{fontFamily: 'Arial, sans-serif'}}>ALEA</div>
                <div className="text-sm font-bold text-slate-500 tracking-[0.3em] uppercase">Sistemi</div>
            </div>
        </div>
        
        <div className="text-6xl font-mono font-light text-slate-800 flex items-center justify-center gap-3">
            <Clock size={48} className="text-[#EC1D25]" />
            {currentTime.toLocaleTimeString('it-IT')}
        </div>
        <p className="text-slate-500 mt-2 font-medium">{currentTime.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Main Content Area */}
      {!selectedEmp ? (
        <div className="w-full max-w-5xl flex flex-col items-center">
          
          {message && (
             <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg font-bold animate-bounce text-center shadow-lg">
                 {message}
             </div>
          )}

          {nfcEnabled ? (
              <div className="flex flex-col items-center animate-fade-in w-full max-w-md relative">
                  
                  {/* INVISIBLE SCANNER INPUT (Legacy/USB) */}
                  <input 
                      ref={inputRef}
                      type="text" 
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="absolute inset-0 opacity-0 cursor-default z-0"
                      autoComplete="off"
                      autoFocus
                  />
                  
                  {/* VISUAL SCANNING ANIMATION */}
                  <div className="relative w-64 h-64 mb-8 flex items-center justify-center cursor-pointer z-10" onClick={() => inputRef.current?.focus()}>
                       {/* Ripples */}
                       <div className="absolute inset-0 bg-[#EC1D25] rounded-full animate-ping opacity-10"></div>
                       <div className="absolute inset-4 bg-[#EC1D25] rounded-full animate-pulse opacity-5 delay-75"></div>
                       <div className="absolute inset-8 bg-[#EC1D25] rounded-full animate-pulse opacity-5 delay-150"></div>
                       
                       {/* Central Icon */}
                       <div className="relative bg-white p-8 rounded-full shadow-2xl border-4 border-slate-50 text-[#EC1D25]">
                           <Wifi size={64} className="animate-pulse" />
                       </div>
                  </div>
                  
                  <div className={`flex items-center justify-center gap-3 mb-8 px-6 py-2 rounded-full shadow-inner border border-slate-200 transition-colors ${nfcStatus === 'LISTENING' ? 'bg-green-50' : 'bg-slate-100'}`}>
                      <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)] ${nfcStatus === 'LISTENING' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                      <span className="text-slate-600 font-bold uppercase tracking-wider text-sm">
                          {nfcStatus === 'LISTENING' ? 'NFC Attivo (Appoggia Badge)' : 'Lettore USB Pronto'}
                      </span>
                  </div>
                  
                  {/* Explicit Start Button if failed */}
                  {nfcStatus !== 'LISTENING' && nfcStatus !== 'UNSUPPORTED' && (
                      <button onClick={startNfcScan} className="mb-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 transition">
                          <Play size={16}/> ATTIVA LETTORE NFC
                      </button>
                  )}

                  {nfcStatus === 'ERROR' && (
                      <div className="mb-4 text-xs text-red-500 flex items-center gap-1 text-center max-w-xs">
                          <AlertCircle size={12}/> Errore accesso NFC Mobile. Clicca "Attiva" o usa il PIN.
                      </div>
                  )}

                  <button 
                    onClick={() => setShowPinPad(true)}
                    className="flex items-center gap-2 text-slate-400 hover:text-[#EC1D25] transition border border-slate-200 px-8 py-3 rounded-full hover:bg-slate-50 hover:shadow-md z-20 bg-white"
                  >
                      <KeyRound size={20} /> Usa Codice PIN
                  </button>
              </div>
          ) : (
            <>
                <h2 className="text-xl mb-6 text-center text-slate-400 uppercase tracking-widest font-semibold">Seleziona Operatore</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {visibleEmployees.map(emp => (
                    <button
                        key={emp.id}
                        onClick={() => setSelectedEmp(emp)}
                        className="p-6 bg-white rounded-xl hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-[#EC1D25] flex flex-col items-center gap-3 group shadow-sm"
                    >
                        <div className="w-20 h-20 rounded-full bg-slate-100 group-hover:bg-[#EC1D25] group-hover:text-white flex items-center justify-center text-2xl font-bold text-slate-600 transition-colors">
                        {emp.name.charAt(0)}
                        </div>
                        <span className="font-bold text-lg text-center text-slate-700 group-hover:text-[#EC1D25]">{emp.name}</span>
                        <span className="text-xs text-slate-400 font-semibold uppercase">{emp.department}</span>
                    </button>
                    ))}
                </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl border-t-4 border-[#EC1D25] animate-fade-in">
           {message && !message.includes('non valido') ? (
             <div className="flex flex-col items-center justify-center py-10 gap-4 text-green-600">
               <CheckCircle size={80} />
               <p className="text-2xl font-bold">{message}</p>
             </div>
           ) : (
             <>
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-full bg-[#EC1D25] text-white flex items-center justify-center text-2xl font-bold">
                        {selectedEmp.name.charAt(0)}
                     </div>
                     <div>
                       <h2 className="text-2xl font-bold text-slate-800">{selectedEmp.name}</h2>
                       <p className="text-slate-500 font-medium uppercase text-sm">{selectedEmp.role} - {selectedEmp.department}</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedEmp(null)} className="text-sm text-slate-400 hover:text-[#EC1D25] underline font-medium">
                    Annulla
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <button 
                    onClick={() => handleAction('ENTRATA')}
                    className="h-48 bg-green-50 hover:bg-green-100 border-2 border-green-500 rounded-xl flex flex-col items-center justify-center gap-4 transition group"
                  >
                    <LogIn size={64} className="text-green-600 group-hover:scale-110 transition-transform" />
                    <span className="text-3xl font-bold text-green-700">ENTRATA</span>
                  </button>
                  <button 
                    onClick={() => handleAction('USCITA')}
                    className="h-48 bg-red-50 hover:bg-red-100 border-2 border-[#EC1D25] rounded-xl flex flex-col items-center justify-center gap-4 transition group"
                  >
                    <LogOut size={64} className="text-[#EC1D25] group-hover:scale-110 transition-transform" />
                    <span className="text-3xl font-bold text-[#EC1D25]">USCITA</span>
                  </button>
                </div>
             </>
           )}
        </div>
      )}

      {/* USER PIN PAD MODAL */}
      {showPinPad && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800">Inserisci PIN</h3>
                      <button onClick={() => {setShowPinPad(false); setEnteredPin('');}}><X size={24} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="mb-8">
                      <div className="text-center text-4xl font-mono tracking-widest py-4 bg-slate-100 rounded-lg">
                          {enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => handlePinInput(num.toString())} className="p-4 bg-slate-50 rounded-lg text-xl font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition shadow-sm border border-slate-200">
                              {num}
                          </button>
                      ))}
                      <button onClick={() => setEnteredPin('')} className="p-4 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition"><Delete size={24} className="mx-auto"/></button>
                      <button onClick={() => handlePinInput('0')} className="p-4 bg-slate-50 rounded-lg text-xl font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition shadow-sm border border-slate-200">0</button>
                      <button onClick={handlePinSubmit} className="p-4 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition"><CheckCircle size={24} className="mx-auto"/></button>
                  </div>
              </div>
          </div>
      )}

      {/* EXIT PIN PAD MODAL */}
      {showExitPinPad && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800">Conferma Uscita</h3>
                      <button onClick={() => {setShowExitPinPad(false); setExitPin('');}}><X size={24} className="text-slate-400"/></button>
                  </div>
                   <p className="text-center text-slate-500 mb-2">PIN Amministratore</p>
                  <div className="mb-8">
                      <div className="text-center text-4xl font-mono tracking-widest py-4 bg-slate-100 rounded-lg">
                          {exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => setExitPin(p => p.length < 4 ? p + num : p)} className="p-4 bg-slate-50 rounded-lg text-xl font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition shadow-sm border border-slate-200">
                              {num}
                          </button>
                      ))}
                      <button onClick={() => setExitPin('')} className="p-4 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition"><Delete size={24} className="mx-auto"/></button>
                      <button onClick={() => setExitPin(p => p.length < 4 ? p + '0' : p)} className="p-4 bg-slate-50 rounded-lg text-xl font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition shadow-sm border border-slate-200">0</button>
                      <button onClick={handleExitVerify} className="p-4 bg-red-600 rounded-lg text-white hover:bg-red-700 transition"><LogOut size={24} className="mx-auto"/></button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AttendanceKiosk;
