
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Vehicle } from '../types';
import { Clock, Truck, ArrowLeft, KeyRound, Wifi, Delete, CheckCircle, X } from 'lucide-react';

const getNativeNfc = async () => {
    try {
        const { NFC } = await import('capacitor-nfc');
        return NFC;
    } catch { return null; }
};

interface Props {
  employees: Employee[];
  vehicles: Vehicle[];
  onAction: (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => void;
  onExit: () => void;
  nfcEnabled: boolean;
}

const VehicleKiosk: React.FC<Props> = ({ employees, vehicles, onAction, onExit, nfcEnabled }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState<string | null>(null);
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startNfcScan = async () => {
      if (!nfcEnabled || currentUser) return;
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
      if (nfcEnabled && !currentUser) startNfcScan();
  }, [nfcEnabled, currentUser]);

  useEffect(() => {
      if (nfcEnabled && !showPinPad && !showExitPinPad && !currentUser) {
          const interval = setInterval(() => {
              if (document.activeElement !== inputRef.current) {
                  inputRef.current?.focus();
              }
          }, 500);
          return () => clearInterval(interval);
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, currentUser]);

  const processScan = (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => 
          (e.nfcCode?.toUpperCase() === cleanCode) || 
          (e.nfcCode2?.toUpperCase() === cleanCode) || 
          (e.id.toUpperCase() === cleanCode)
      );
      if (emp) setCurrentUser(emp);
  };

  const handleVehicleSelection = (vehicle: Vehicle) => {
      if (!currentUser) return;
      if (vehicle.status === 'AVAILABLE') {
          if (confirm(`Prendere in carico il mezzo ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_OUT');
              setMessage(`${vehicle.name} prelevato con successo`);
              setCurrentUser(null);
              setTimeout(() => setMessage(null), 3000);
          }
      } else if (vehicle.currentDriverId === currentUser.id) {
          if (confirm(`Restituire il mezzo ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_IN');
              setMessage(`${vehicle.name} restituito correttamente`);
              setCurrentUser(null);
              setTimeout(() => setMessage(null), 3000);
          }
      } else alert("Questo mezzo è già in uso da un altro operatore.");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative no-select">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-6 left-6 p-3 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors z-50">
          <ArrowLeft size={28} />
      </button>

      <div className="mb-12 text-center">
        <h1 className="text-4xl font-black mb-4 uppercase tracking-[0.2em] text-[#EC1D25]">TOTEM MEZZI</h1>
        <div className="text-6xl font-mono text-slate-300 flex items-center justify-center gap-4">
            <Clock size={48} className="text-[#EC1D25]" />
            {currentTime.toLocaleTimeString('it-IT')}
        </div>
      </div>

      {!currentUser ? (
        <div className="flex flex-col items-center w-full max-w-md">
          {message && <div className="mb-10 p-5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-2xl font-black text-center animate-fade-in">{message}</div>}
          
          <div className="relative w-56 h-56 mb-12 flex items-center justify-center bg-slate-800 rounded-[2.5rem] border-4 border-slate-700 text-[#EC1D25] shadow-2xl z-10" onClick={() => inputRef.current?.focus()}>
              <Wifi size={80} className={nfcStatus === 'LISTENING' ? 'animate-pulse' : ''} />
          </div>
          
          <div className="px-10 py-4 rounded-full border border-slate-700 bg-slate-800 text-sm font-black uppercase tracking-widest text-slate-400 mb-10">Passa il badge aziendale</div>
          
          <button 
              onClick={() => setShowPinPad(true)} 
              className="flex items-center gap-3 text-slate-400 hover:text-white transition-all bg-slate-800 px-12 py-5 rounded-2xl border border-slate-700 font-black uppercase tracking-widest shadow-lg z-20 active:scale-95"
          >
              <KeyRound size={24} /> Digita PIN
          </button>
          
          <input 
              ref={inputRef} 
              type="text" 
              onChange={(e) => processScan(e.target.value)} 
              className="absolute opacity-0 pointer-events-none" 
              autoFocus 
              inputMode="none"
          />
        </div>
      ) : (
        <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-10 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-8">
                    <div className="w-20 h-20 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-4xl border border-slate-700">{currentUser.name.charAt(0)}</div>
                    <div>
                        <h2 className="text-4xl font-black text-white">Ciao, {currentUser.name}</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Seleziona il mezzo per il ritiro o la consegna</p>
                    </div>
                </div>
                <button onClick={() => setCurrentUser(null)} className="px-10 py-4 bg-slate-700 text-white rounded-2xl font-black hover:bg-slate-600 transition-colors uppercase tracking-widest shadow-lg">Esci</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {vehicles.map(vehicle => {
                    const isMine = vehicle.currentDriverId === currentUser.id;
                    const isAvailable = vehicle.status === 'AVAILABLE';
                    return (
                        <button 
                            key={vehicle.id} 
                            disabled={!isAvailable && !isMine} 
                            onClick={() => handleVehicleSelection(vehicle)} 
                            className={`p-8 rounded-[2rem] border-2 flex flex-col gap-6 text-left transition-all duration-300 shadow-xl group ${isMine ? 'bg-[#EC1D25] border-[#EC1D25] scale-105 z-10 ring-4 ring-red-500/20' : isAvailable ? 'bg-slate-800 border-slate-700 hover:border-[#EC1D25] hover:-translate-y-2' : 'bg-slate-900 border-slate-800 opacity-20 grayscale cursor-not-allowed'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-5 rounded-2xl ${isMine ? 'bg-white text-[#EC1D25]' : 'bg-slate-900 text-[#EC1D25]'}`}>
                                    <Truck size={40} />
                                </div>
                                <div className={`text-xs font-black px-4 py-2 rounded-full border uppercase tracking-[0.2em] ${isMine ? 'bg-white text-red-600 border-white' : 'border-slate-600 text-slate-400'}`}>
                                    {isMine ? 'IN USO (TU)' : vehicle.status}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white">{vehicle.name}</h3>
                                <p className={`font-mono text-xl font-bold ${isMine ? 'text-white/80' : 'text-slate-500'}`}>{vehicle.plate}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
      )}

      {/* PIN PAD PERSONALE */}
      {showPinPad && (
          <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-[100] p-4">
              <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
                  <h3 className="text-2xl font-black mb-8 text-slate-800 tracking-tight">Inserisci PIN</h3>
                  <div className="text-5xl font-mono py-6 bg-slate-100 rounded-2xl mb-10 tracking-[0.5em] text-slate-900 font-black">
                      {enteredPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => setEnteredPin(p => p.length < 6 ? p + num : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{num}</button>
                      ))}
                      <button onClick={() => setEnteredPin('')} className="h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"><Delete size={32}/></button>
                      <button onClick={() => setEnteredPin(p => p.length < 6 ? p + '0' : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">0</button>
                      <button 
                          onClick={() => {
                              const e = employees.find(x => x.pin === enteredPin); 
                              if(e) { setCurrentUser(e); setShowPinPad(false); setEnteredPin(''); } 
                              else { setEnteredPin(''); alert("PIN Errato"); }
                          }} 
                          className="h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
                      >
                          <CheckCircle size={32}/>
                      </button>
                  </div>
                  <button onClick={() => {setShowPinPad(false); setEnteredPin('');}} className="mt-10 text-slate-400 font-bold uppercase tracking-widest hover:text-slate-600 transition-colors">Torna indietro</button>
              </div>
          </div>
      )}

      {/* PIN PAD USCITA TOTEM */}
      {showExitPinPad && (
          <div className="fixed inset-0 bg-slate-950/98 flex items-center justify-center z-[110] p-4">
              <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
                  <h3 className="text-2xl font-black mb-8 text-slate-800 tracking-tight">Esci dal Totem</h3>
                  <div className="text-5xl font-mono py-6 bg-slate-100 rounded-2xl mb-10 tracking-[0.5em] text-slate-900 font-black">
                      {exitPin.padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => setExitPin(p => p.length < 4 ? p + num : p)} className="h-20 bg-slate-50 rounded-2xl font-black text-3xl text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{num}</button>
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
                  <button onClick={() => {setShowExitPinPad(false); setExitPin('');}} className="mt-10 text-slate-400 font-bold uppercase tracking-widest hover:text-slate-600 transition-colors">Annulla</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default VehicleKiosk;
