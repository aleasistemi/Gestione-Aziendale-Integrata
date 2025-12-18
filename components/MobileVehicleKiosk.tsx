
import React, { useState, useEffect } from 'react';
import { Employee, Vehicle, Role } from '../types';
import { Clock, Truck, ArrowLeft, User, CheckCircle, ChevronRight } from 'lucide-react';

interface Props {
  employees: Employee[];
  vehicles: Vehicle[];
  onAction: (vehicle: Vehicle, employee: Employee, type: 'CHECK_OUT' | 'CHECK_IN') => void;
  onExit: () => void;
}

const MobileVehicleKiosk: React.FC<Props> = ({ employees, vehicles, onAction, onExit }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState<string | null>(null);

  // Filtriamo gli operatori (escludiamo i sistemisti) e ordiniamo per nome
  const visibleEmployees = employees
    .filter(e => e.role !== Role.SYSTEM_ADMIN)
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVehicleSelection = (vehicle: Vehicle) => {
      if (!currentUser) return;

      if (vehicle.status === 'AVAILABLE') {
          if (confirm(`Prelevi il mezzo: ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_OUT');
              setMessage(`${vehicle.name} preso in carico.`);
              resetAfterAction();
          }
      } else if (vehicle.currentDriverId === currentUser.id) {
          if (confirm(`Riconsegni il mezzo: ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_IN');
              setMessage(`${vehicle.name} riconsegnato.`);
              resetAfterAction();
          }
      } else {
          const driver = employees.find(e => e.id === vehicle.currentDriverId)?.name || "un collega";
          alert(`Attenzione: questo mezzo è già in uso da: ${driver}.`);
      }
  };

  const resetAfterAction = () => {
      setTimeout(() => {
          setMessage(null);
          setCurrentUser(null);
      }, 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 no-select overflow-x-hidden">
      {/* Header compatto per smartphone */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <button onClick={onExit} className="p-3 bg-slate-900 rounded-full text-slate-400">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
            <h1 className="text-lg font-black text-[#EC1D25] tracking-widest uppercase">ALEA SMART</h1>
            <div className="text-xl font-mono text-slate-400">
                {currentTime.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
        <div className="w-10"></div>
      </div>

      {!currentUser ? (
        /* LISTA NOMI - ZERO INPUT / ZERO TASTIERA */
        <div className="flex-1 flex flex-col animate-in fade-in duration-300">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">CHI SEI?</h2>
            <p className="text-slate-500 text-sm">Seleziona il tuo nome dall'elenco</p>
          </div>

          <div className="grid grid-cols-1 gap-3 pb-10 overflow-y-auto">
              {visibleEmployees.map(emp => (
              <button
                  key={emp.id}
                  onClick={() => setCurrentUser(emp)}
                  className="flex items-center justify-between p-4 bg-slate-900 active:bg-slate-800 rounded-2xl border border-slate-800 transition-all"
              >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg font-black text-[#EC1D25]">
                        {emp.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-100 text-lg">{emp.name}</span>
                  </div>
                  <ChevronRight size={20} className="text-slate-700" />
              </button>
              ))}
          </div>
        </div>
      ) : (
        /* SELEZIONE MEZZI */
        <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EC1D25] text-white flex items-center justify-center font-black">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-lg font-black">{currentUser.name.split(' ')[0]}</h2>
                    </div>
                </div>
                <button 
                  onClick={() => setCurrentUser(null)} 
                  className="px-4 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest"
                >
                    Cambia
                </button>
            </div>

            {message ? (
                <div className="bg-green-600/20 border border-green-500/50 text-green-400 p-10 rounded-3xl text-center flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                    <CheckCircle size={50} />
                    <span className="text-xl font-black uppercase">{message}</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 pb-10 overflow-y-auto">
                    {vehicles.map(vehicle => {
                        const isAvailable = vehicle.status === 'AVAILABLE';
                        const isMine = vehicle.currentDriverId === currentUser.id;
                        const driver = employees.find(e => e.id === vehicle.currentDriverId)?.name.split(' ')[0] || 'In uso';

                        return (
                            <button
                                key={vehicle.id}
                                disabled={!isAvailable && !isMine}
                                onClick={() => handleVehicleSelection(vehicle)}
                                className={`p-5 rounded-2xl border-2 flex flex-col gap-3 text-left transition-all active:scale-95 ${
                                  isMine 
                                    ? "bg-[#EC1D25] border-[#EC1D25]" 
                                    : isAvailable 
                                      ? "bg-slate-900 border-slate-800" 
                                      : "bg-slate-950 border-slate-900 opacity-20 grayscale pointer-events-none"
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className={`p-3 rounded-xl ${isMine ? 'bg-white text-[#EC1D25]' : 'bg-slate-800 text-[#EC1D25]'}`}>
                                        <Truck size={24} />
                                    </div>
                                    <div className={`text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest ${
                                      isMine ? 'bg-white text-[#EC1D25] border-white' : isAvailable ? 'text-green-500 border-green-500' : 'text-slate-600 border-slate-800'
                                    }`}>
                                        {isMine ? 'TUO' : isAvailable ? 'LIBERO' : driver}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white leading-none">{vehicle.name}</h3>
                                    <p className={`font-mono text-sm mt-1 ${isMine ? 'text-white/80' : 'text-slate-500'}`}>{vehicle.plate}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MobileVehicleKiosk;
