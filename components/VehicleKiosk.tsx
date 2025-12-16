
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Vehicle, VehicleLog, Role } from '../types';
import { Clock, Truck, User, ArrowLeft, KeyRound, Wifi, Delete, CheckCircle, X, LogOut, ArrowRightCircle } from 'lucide-react';

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
  
  // Scanner Input State
  const [scanValue, setScanValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [showPinPad, setShowPinPad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Exit PIN State
  const [showExitPinPad, setShowExitPinPad] = useState(false);
  const [exitPin, setExitPin] = useState('');

  // Filter visible employees (only workshop/technical usually take cars, but let's allow all for now)
  const visibleEmployees = employees.filter(e => 
    e.role !== Role.SYSTEM_ADMIN
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Force focus on the scanner input
  useEffect(() => {
      if (nfcEnabled && !showPinPad && !showExitPinPad && !currentUser) {
          const focusInterval = setInterval(() => {
              if (document.activeElement !== inputRef.current) {
                  inputRef.current?.focus();
              }
          }, 500);
          return () => clearInterval(focusInterval);
      }
  }, [nfcEnabled, showPinPad, showExitPinPad, currentUser]);

  const processScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      
      const emp = employees.find(e => 
          (e.nfcCode && e.nfcCode.trim().toUpperCase() === cleanCode) ||
          (e.nfcCode2 && e.nfcCode2.trim().toUpperCase() === cleanCode)
      );
                
      if (emp) {
          setCurrentUser(emp);
          setScanValue('');
      } else {
          setMessage(`Badge non riconosciuto`);
          setScanValue('');
          setTimeout(() => setMessage(null), 3000);
      }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          processScan(scanValue);
      }
  };

  const handleVehicleSelection = (vehicle: Vehicle) => {
      if (!currentUser) return;

      if (vehicle.status === 'AVAILABLE') {
          if (confirm(`Confermi di voler prendere: ${vehicle.name} (${vehicle.plate})?`)) {
              onAction(vehicle, currentUser, 'CHECK_OUT');
              setMessage(`${vehicle.name} assegnato a ${currentUser.name}`);
              resetAfterAction();
          }
      } else if (vehicle.currentDriverId === currentUser.id) {
          if (confirm(`Vuoi restituire: ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_IN');
              setMessage(`${vehicle.name} restituito con successo.`);
              resetAfterAction();
          }
      } else {
          alert("Questo mezzo è in uso da un altro operatore.");
      }
  };

  const resetAfterAction = () => {
      setTimeout(() => {
          setMessage(null);
          setCurrentUser(null);
          setShowPinPad(false);
          setEnteredPin('');
      }, 2500);
  }

  const handlePinSubmit = () => {
      const emp = employees.find(e => e.pin === enteredPin);
      if (emp) {
          setCurrentUser(emp);
          setShowPinPad(false);
          setEnteredPin('');
      } else {
          setMessage("PIN non valido");
          setEnteredPin('');
          setTimeout(() => setMessage(null), 2000);
      }
  }

  const handleExitVerify = () => {
      if (exitPin === '1409') { // Standard Kiosk PIN
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={() => setShowExitPinPad(true)} 
        className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition text-slate-400 z-50 opacity-20 hover:opacity-100"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex flex-col items-center mb-4">
            <h1 className="text-3xl font-black text-white tracking-widest uppercase">TOTEM MEZZI</h1>
            <div className="h-1 w-20 bg-[#EC1D25] mt-2"></div>
        </div>
        <div className="text-5xl font-mono text-slate-300 flex items-center justify-center gap-3">
            <Clock size={40} className="text-[#EC1D25]" />
            {currentTime.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>

      {/* Main Area */}
      {!currentUser ? (
        <div className="w-full max-w-4xl flex flex-col items-center">
          {message && (
             <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-white rounded-lg font-bold animate-bounce text-center">
                 {message}
             </div>
          )}

          {nfcEnabled ? (
              <div className="flex flex-col items-center w-full max-w-md relative">
                  <input 
                      ref={inputRef}
                      type="text" 
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="absolute inset-0 opacity-0 cursor-default z-0"
                      autoFocus
                  />
                  
                  <div className="relative w-64 h-64 mb-8 flex items-center justify-center cursor-pointer z-10" onClick={() => inputRef.current?.focus()}>
                       <div className="absolute inset-0 bg-[#EC1D25] rounded-full animate-ping opacity-20"></div>
                       <div className="relative bg-slate-800 p-8 rounded-full shadow-2xl border-4 border-slate-700 text-[#EC1D25]">
                           <Wifi size={64} className="animate-pulse" />
                       </div>
                  </div>
                  
                  <p className="text-slate-400 mb-8 font-medium">Avvicina il Badge per Identificarti</p>

                  <button 
                    onClick={() => setShowPinPad(true)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition border border-slate-700 px-8 py-3 rounded-full hover:bg-slate-800 z-20"
                  >
                      <KeyRound size={20} /> Usa Codice PIN
                  </button>
              </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                {visibleEmployees.map(emp => (
                <button
                    key={emp.id}
                    onClick={() => setCurrentUser(emp)}
                    className="p-6 bg-slate-800 rounded-xl hover:bg-slate-700 transition flex flex-col items-center gap-3 border border-slate-700 hover:border-[#EC1D25]"
                >
                    <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-xl font-bold text-slate-300">
                    {emp.name.charAt(0)}
                    </div>
                    <span className="font-bold text-center text-slate-200">{emp.name}</span>
                </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-6xl animate-fade-in">
            <div className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#EC1D25] text-white flex items-center justify-center font-bold text-xl">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Ciao, {currentUser.name}</h2>
                        <p className="text-slate-400 text-sm">Seleziona un'operazione</p>
                    </div>
                </div>
                <button onClick={() => setCurrentUser(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition">
                    Esci
                </button>
            </div>

            {message ? (
                <div className="bg-green-600 text-white p-8 rounded-xl text-center text-2xl font-bold flex flex-col items-center gap-4">
                    <CheckCircle size={48} />
                    {message}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vehicles.map(vehicle => {
                        const isAvailable = vehicle.status === 'AVAILABLE';
                        const isMine = vehicle.currentDriverId === currentUser.id;
                        const driverName = employees.find(e => e.id === vehicle.currentDriverId)?.name || 'Sconosciuto';

                        let cardClass = "bg-slate-800 border-slate-700";
                        let statusText = "DISPONIBILE";
                        let statusColor = "text-green-500";

                        if (isMine) {
                            cardClass = "bg-orange-900/20 border-orange-500/50 ring-2 ring-orange-500/20";
                            statusText = "IN USO DA TE";
                            statusColor = "text-orange-500";
                        } else if (!isAvailable) {
                            cardClass = "bg-red-900/10 border-red-900/30 opacity-60";
                            statusText = `IN USO: ${driverName}`;
                            statusColor = "text-red-500";
                        }

                        return (
                            <button
                                key={vehicle.id}
                                disabled={!isAvailable && !isMine}
                                onClick={() => handleVehicleSelection(vehicle)}
                                className={`p-6 rounded-xl border flex flex-col gap-4 text-left transition-all hover:scale-[1.02] ${cardClass}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="bg-slate-900 p-3 rounded-lg">
                                        <Truck size={32} className={isMine ? "text-orange-500" : isAvailable ? "text-white" : "text-slate-500"} />
                                    </div>
                                    <div className={`text-xs font-bold px-2 py-1 rounded border ${statusColor} border-current`}>
                                        {statusText}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{vehicle.name}</h3>
                                    <p className="text-slate-400 font-mono text-lg">{vehicle.plate}</p>
                                </div>
                                {isMine && (
                                    <div className="mt-auto pt-4 border-t border-white/10 flex items-center gap-2 text-orange-400 text-sm font-bold">
                                        <ArrowRightCircle size={16} /> CLICCA PER RESTITUIRE
                                    </div>
                                )}
                                {isAvailable && (
                                    <div className="mt-auto pt-4 border-t border-white/10 flex items-center gap-2 text-green-400 text-sm font-bold">
                                        <ArrowRightCircle size={16} /> CLICCA PER PRENDERE
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      )}

      {/* PIN PAD MODALS (Reusable) */}
      {(showPinPad || showExitPinPad) && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
              <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">{showExitPinPad ? "PIN Uscita" : "Inserisci PIN Utente"}</h3>
                      <button onClick={() => {setShowPinPad(false); setShowExitPinPad(false); setEnteredPin(''); setExitPin('');}}><X size={24} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="mb-8">
                      <div className="text-center text-4xl font-mono tracking-widest py-4 bg-slate-900 rounded-lg text-white">
                          {(showExitPinPad ? exitPin : enteredPin).padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+num:p) : handlePinInput(num.toString())} className="p-4 bg-slate-700 rounded-lg text-xl font-bold text-white hover:bg-slate-600 transition shadow-sm">
                              {num}
                          </button>
                      ))}
                      <button onClick={() => showExitPinPad ? setExitPin('') : setEnteredPin('')} className="p-4 bg-red-900/50 rounded-lg text-red-400 hover:bg-red-900 transition"><Delete size={24} className="mx-auto"/></button>
                      <button onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+'0':p) : handlePinInput('0')} className="p-4 bg-slate-700 rounded-lg text-xl font-bold text-white hover:bg-slate-600 transition shadow-sm">0</button>
                      <button onClick={showExitPinPad ? handleExitVerify : handlePinSubmit} className="p-4 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition"><CheckCircle size={24} className="mx-auto"/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VehicleKiosk;
