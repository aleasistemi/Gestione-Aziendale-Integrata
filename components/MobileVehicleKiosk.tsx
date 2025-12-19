
import React, { useState, useEffect } from 'react';
import { Employee, Vehicle, Role } from '../types';
import { Truck, ArrowLeft, CheckCircle, ChevronRight, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';

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
  const [showOthers, setShowOthers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const allVisible = employees
    .filter(e => e.role !== Role.SYSTEM_ADMIN)
    .sort((a, b) => a.name.localeCompare(b.name));

  const warehouseEmps = allVisible.filter(e => e.role === Role.WAREHOUSE || e.department === 'Magazzino');
  const otherEmps = allVisible.filter(e => 
    (e.role !== Role.WAREHOUSE && e.department !== 'Magazzino') &&
    (searchTerm === '' || e.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          setShowOthers(false);
          setSearchTerm('');
      }, 2000);
  }

  const renderEmpButton = (emp: Employee) => (
    <button
        key={emp.id}
        onClick={() => setCurrentUser(emp)}
        className="flex items-center justify-between p-4 bg-slate-900 active:bg-slate-800 rounded-2xl border border-slate-800 transition-all shadow-lg mb-2"
    >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-base font-black text-[#EC1D25] border border-slate-700">
              {emp.name.charAt(0)}
          </div>
          <span className="font-bold text-slate-100 text-base">{emp.name}</span>
        </div>
        <ChevronRight size={18} className="text-slate-700" />
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 no-select overflow-x-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <button onClick={onExit} className="p-3 bg-slate-900 rounded-full text-slate-400">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
            <h1 className="text-lg font-black text-[#EC1D25] tracking-widest uppercase">ALEA SISTEMI</h1>
            <div className="text-xl font-mono text-slate-400">
                {currentTime.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
        <div className="w-10"></div>
      </div>

      {!currentUser ? (
        <div className="flex-1 flex flex-col animate-in fade-in duration-300">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1 uppercase tracking-tighter italic">GESTIONE MEZZI</h2>
            <p className="text-slate-500 text-sm">Identificati per procedere</p>
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
              {/* SEZIONE MAGAZZINO */}
              <div className="text-[10px] font-black text-[#EC1D25] uppercase tracking-[0.2em] mb-3 px-2 flex items-center gap-2">
                  <Truck size={12}/> Personale Magazzino
              </div>
              <div className="mb-6">
                  {warehouseEmps.map(renderEmpButton)}
                  {warehouseEmps.length === 0 && <p className="text-slate-700 italic text-sm px-4">Nessun utente magazzino configurato.</p>}
              </div>

              {/* SEZIONE ALTRI UTENTI (MENU A TENDINA) */}
              <div className="border-t border-slate-900 pt-4">
                  <button 
                    onClick={() => setShowOthers(!showOthers)}
                    className={`w-full py-4 px-5 rounded-2xl flex items-center justify-between transition-all ${showOthers ? 'bg-[#EC1D25] text-white shadow-lg' : 'bg-slate-900 text-slate-400'}`}
                  >
                      <div className="flex items-center gap-3">
                        <Users size={20}/>
                        <span className="font-black uppercase text-xs tracking-widest">Altri Utenti</span>
                      </div>
                      {showOthers ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                  </button>
                  
                  {showOthers && (
                      <div className="mt-4 animate-in slide-in-from-top-4 duration-300 space-y-3">
                          {/* Campo ricerca per facilitare se la lista è lunga */}
                          <div className="relative mb-4">
                              <Search className="absolute left-4 top-3 text-slate-500" size={18}/>
                              <input 
                                type="text" 
                                placeholder="Cerca nome..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#EC1D25] outline-none"
                              />
                          </div>
                          <div className="max-h-[300px] overflow-y-auto pr-1">
                            {otherEmps.map(renderEmpButton)}
                            {otherEmps.length === 0 && <p className="text-center py-4 text-slate-600 text-sm italic">Nessun risultato.</p>}
                          </div>
                      </div>
                  )}
              </div>
          </div>
        </div>
      ) : (
        /* SELEZIONE MEZZI (Invariata ma ottimizzata per thumb) */
        <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#EC1D25] text-white flex items-center justify-center font-black text-xl">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-lg font-black leading-tight">{currentUser.name.split(' ')[0]}</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Pronto per il prelievo</p>
                    </div>
                </div>
                <button 
                  onClick={() => {setCurrentUser(null); setShowOthers(false); setSearchTerm('');}} 
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                    Cambia
                </button>
            </div>

            {message ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-green-600/10 border border-green-500/30 rounded-3xl p-10 animate-in zoom-in duration-300">
                    <div className="bg-green-500 p-4 rounded-full mb-6">
                        <CheckCircle size={60} className="text-white" />
                    </div>
                    <span className="text-2xl font-black uppercase text-center">{message}</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pb-10 pr-1">
                    <div className="grid grid-cols-1 gap-4">
                        {vehicles.map(vehicle => {
                            const isAvailable = vehicle.status === 'AVAILABLE';
                            const isMine = vehicle.currentDriverId === currentUser.id;
                            const driver = employees.find(e => e.id === vehicle.currentDriverId)?.name.split(' ')[0] || 'Occupato';

                            return (
                                <button
                                    key={vehicle.id}
                                    disabled={!isAvailable && !isMine}
                                    onClick={() => handleVehicleSelection(vehicle)}
                                    className={`p-6 rounded-[2rem] border-2 flex flex-col gap-4 text-left transition-all active:scale-95 shadow-md ${
                                      isMine 
                                        ? "bg-[#EC1D25] border-[#EC1D25] ring-4 ring-red-500/20" 
                                        : isAvailable 
                                          ? "bg-slate-900 border-slate-800 active:bg-slate-800" 
                                          : "bg-slate-950 border-slate-900 opacity-20 grayscale pointer-events-none"
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className={`p-3 rounded-2xl ${isMine ? 'bg-white text-[#EC1D25]' : 'bg-slate-800 text-[#EC1D25]'}`}>
                                            <Truck size={32} />
                                        </div>
                                        <div className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                                          isMine ? 'bg-white text-[#EC1D25] border-white' : isAvailable ? 'text-green-500 border-green-500' : 'text-slate-600 border-slate-800'
                                        }`}>
                                            {isMine ? 'IL TUO MEZZO' : isAvailable ? 'LIBERO' : `USATO DA ${driver}`}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white leading-none">{vehicle.name}</h3>
                                        <p className={`font-mono text-sm mt-2 font-bold ${isMine ? 'text-white/70' : 'text-slate-500'}`}>{vehicle.plate}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {vehicles.length === 0 && <p className="text-center py-20 text-slate-700 italic">Nessun veicolo caricato nel sistema.</p>}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MobileVehicleKiosk;
