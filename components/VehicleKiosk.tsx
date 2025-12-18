
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
                  const code = tag.id || (tag.message?.records[0]?.data);
                  if (code) processScan(code.toString());
              });
              await (nativeNfc as any).scan();
          } catch { setNfcStatus('ERROR'); }
      }
  };

  useEffect(() => {
      if (nfcEnabled && !currentUser) startNfcScan();
  }, [nfcEnabled, currentUser]);

  const processScan = (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => (e.nfcCode?.toUpperCase() === cleanCode) || (e.nfcCode2?.toUpperCase() === cleanCode) || (e.id.toUpperCase() === cleanCode));
      if (emp) setCurrentUser(emp);
  };

  const handleVehicleSelection = (vehicle: Vehicle) => {
      if (!currentUser) return;
      if (vehicle.status === 'AVAILABLE') {
          if (confirm(`Prendi ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_OUT');
              setMessage(`${vehicle.name} preso correttamente`);
              setTimeout(() => { setMessage(null); setCurrentUser(null); }, 2000);
          }
      } else if (vehicle.currentDriverId === currentUser.id) {
          if (confirm(`Restituisci ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_IN');
              setMessage(`${vehicle.name} restituito correttamente`);
              setTimeout(() => { setMessage(null); setCurrentUser(null); }, 2000);
          }
      } else alert("In uso da altri.");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full text-slate-400 z-10"><ArrowLeft size={24} /></button>

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black mb-2 uppercase tracking-widest">TOTEM MEZZI</h1>
        <div className="text-5xl font-mono text-slate-300 flex items-center justify-center gap-3"><Clock size={40} className="text-[#EC1D25]" />{currentTime.toLocaleTimeString('it-IT')}</div>
      </div>

      {!currentUser ? (
        <div className="flex flex-col items-center w-full max-w-md">
          {message && <div className="mb-6 p-4 bg-blue-600 text-white rounded-lg font-bold">{message}</div>}
          <div className="relative w-48 h-48 mb-10 flex items-center justify-center bg-slate-800 rounded-full border-4 border-slate-700 text-[#EC1D25] z-10" onClick={() => inputRef.current?.focus()}>
              <Wifi size={64} />
          </div>
          <div className="px-8 py-3 rounded-full border border-slate-700 bg-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">Passa il badge</div>
          <button onClick={() => setShowPinPad(true)} className="flex items-center gap-2 text-slate-400 hover:text-white transition bg-slate-800 px-8 py-3 rounded-xl border border-slate-700 font-bold z-20"><KeyRound size={20} /> Usa Codice PIN</button>
          <input ref={inputRef} type="text" onChange={(e) => processScan(e.target.value)} className="absolute opacity-0 pointer-events-none" autoFocus />
        </div>
      ) : (
        <div className="w-full max-w-6xl">
            <div className="flex justify-between items-center mb-10 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl">{currentUser.name.charAt(0)}</div>
                    <div><h2 className="text-3xl font-black text-white">Ciao, {currentUser.name}</h2><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Seleziona mezzo</p></div>
                </div>
                <button onClick={() => setCurrentUser(null)} className="px-6 py-2 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition">Indietro</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {vehicles.map(vehicle => {
                    const isMine = vehicle.currentDriverId === currentUser.id;
                    const isAvailable = vehicle.status === 'AVAILABLE';
                    return (
                        <button key={vehicle.id} disabled={!isAvailable && !isMine} onClick={() => handleVehicleSelection(vehicle)} className={`p-6 rounded-2xl border-2 flex flex-col gap-4 text-left transition-all ${isMine ? 'bg-[#EC1D25] border-[#EC1D25]' : isAvailable ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-30 grayscale'}`}>
                            <div className="flex justify-between items-start"><div className="bg-slate-900 p-4 rounded-xl"><Truck size={32} /></div><div className="text-xs font-black px-2 py-1 rounded border uppercase tracking-widest">{vehicle.status}</div></div>
                            <div><h3 className="text-xl font-black">{vehicle.name}</h3><p className="font-mono text-slate-400">{vehicle.plate}</p></div>
                        </button>
                    )
                })}
            </div>
        </div>
      )}

      {(showPinPad || showExitPinPad) && (
          <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-[100]">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
                  <h3 className="text-xl font-bold mb-6 text-slate-800">{showExitPinPad ? "Uscita" : "PIN"}</h3>
                  <div className="text-3xl font-mono py-4 bg-slate-100 rounded-xl mb-6 tracking-widest text-slate-900">{(showExitPinPad ? exitPin : enteredPin).padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                  <div className="grid grid-cols-3 gap-3">
                      {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+num:p) : setEnteredPin(p=>p.length<6?p+num:p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">{num}</button>)}
                      <button onClick={() => {setEnteredPin(''); setExitPin('');}} className="h-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition"><Delete size={24}/></button>
                      <button onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+'0':p) : setEnteredPin(p=>p.length<6?p+'0':p)} className="h-16 bg-slate-50 rounded-xl font-bold text-xl text-slate-700 hover:bg-slate-200 transition">0</button>
                      <button onClick={() => {
                          if(showExitPinPad) { if(exitPin === '1409') onExit(); else setExitPin(''); }
                          else { const e = employees.find(x => x.pin === enteredPin); if(e){setCurrentUser(e);setShowPinPad(false);}else{setEnteredPin('');} }
                      }} className="h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition"><CheckCircle size={24}/></button>
                  </div>
                  <button onClick={() => {setShowPinPad(false); setShowExitPinPad(false);}} className="mt-6 text-slate-400 font-bold">Chiudi</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default VehicleKiosk;
