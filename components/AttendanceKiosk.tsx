
import React, { useState, useEffect, useCallback } from 'react';
import { Employee, AttendanceRecord, Role } from '../types';
import { Clock, CheckCircle, LogIn, LogOut, ArrowLeft, Scan, KeyRound, Delete, X } from 'lucide-react';

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
  
  // NFC / PIN States
  const [nfcBuffer, setNfcBuffer] = useState('');
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

  // Auto-clear NFC buffer if idle for 2 seconds (cleans up partial scans)
  useEffect(() => {
    if (nfcBuffer.length > 0) {
        const timer = setTimeout(() => setNfcBuffer(''), 2000);
        return () => clearTimeout(timer);
    }
  }, [nfcBuffer]);

  // NFC Listener
  useEffect(() => {
    if (!nfcEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (selectedEmp || showExitPinPad || showPinPad) return; // Don't scan if user already selected/acting or entering PIN

        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault(); // Prevent default navigation
            if (nfcBuffer.length > 2) { // Minimum length check
                // Normalize to Uppercase for comparison
                const scannedCode = nfcBuffer.trim().toUpperCase();
                const emp = employees.find(e => e.nfcCode?.trim().toUpperCase() === scannedCode);
                
                if (emp) {
                    setSelectedEmp(emp);
                    setNfcBuffer('');
                } else {
                   setMessage("Badge non riconosciuto");
                   setTimeout(() => setMessage(null), 2000);
                   setNfcBuffer('');
                }
            } else {
                setNfcBuffer('');
            }
        } else {
            // Only capture alphanumeric chars (ignore Shift, Control, etc.)
            if (e.key.length === 1) {
                setNfcBuffer(prev => prev + e.key);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nfcEnabled, nfcBuffer, employees, selectedEmp, showExitPinPad, showPinPad]);

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
             <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg font-bold animate-bounce">
                 {message}
             </div>
          )}

          {nfcEnabled ? (
              <div className="flex flex-col items-center animate-fade-in">
                  <div className="w-64 h-64 rounded-full bg-slate-50 border-8 border-slate-100 flex flex-col items-center justify-center mb-8 relative overflow-hidden">
                      <div className="absolute inset-0 border-t-4 border-[#EC1D25] animate-spin rounded-full opacity-20"></div>
                      <Scan size={80} className="text-slate-400 mb-4" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Avvicinare Badge</p>
                  </div>
                  
                  <button 
                    onClick={() => setShowPinPad(true)}
                    className="flex items-center gap-2 text-slate-500 hover:text-[#EC1D25] transition border px-6 py-2 rounded-full hover:bg-slate-50"
                  >
                      <KeyRound size={18} /> Usa Codice PIN
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
