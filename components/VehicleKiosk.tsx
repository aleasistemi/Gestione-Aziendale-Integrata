import React, { useState, useEffect, useRef } from 'react';
import { Employee, Vehicle, VehicleLog, Role } from '../types';
import { Clock, Truck, User, ArrowLeft, KeyRound, Wifi, Delete, CheckCircle, X, LogOut, ArrowRightCircle, AlertCircle, Play, Laptop } from 'lucide-react';

const getNativeNfc = async () => {
    try {
        const { NFC } = await import('capacitor-nfc');
        return NFC;
    } catch (e) {
        return null;
    }
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
              // Fixed: startScan does not exist on type 'NFCPluginWeb', using scan() and casting to any.
              await (nativeNfc as any).scan();
              return;
          } catch (e) {
              console.error("Native NFC failed", e);
          }
      }

      if ('NDEFReader' in window) {
          try {
              const ndef = new (window as any).NDEFReader();
              await ndef.scan();
              setNfcStatus('LISTENING');
              ndef.onreading = (event: any) => {
                  let readCode = "";
                  for (const record of event.message.records) {
                      if (record.recordType === "text") {
                          readCode = new TextDecoder(record.encoding).decode(record.data);
                          break;
                      }
                  }
                  if (!readCode) readCode = event.serialNumber.replaceAll(':', '').toUpperCase();
                  processScan(readCode);
              };
          } catch (error) {
              setNfcStatus('ERROR');
          }
      } else {
          setNfcStatus('UNSUPPORTED');
      }
  };

  useEffect(() => {
      if (nfcEnabled && !currentUser) startNfcScan();
  }, [nfcEnabled, currentUser]);

  const processScan = (code: string) => {
      if (code.length < 2) return;
      const cleanCode = code.trim().toUpperCase();
      const emp = employees.find(e => 
          (e.nfcCode?.toUpperCase() === cleanCode) ||
          (e.nfcCode2?.toUpperCase() === cleanCode) ||
          (e.id.toUpperCase() === cleanCode)
      );
      if (emp) {
          setCurrentUser(emp);
          if (navigator.vibrate) navigator.vibrate(200);
      } else {
          setMessage(`Badge non riconosciuto`);
          setTimeout(() => setMessage(null), 3000);
      }
  };

  const handleVehicleSelection = (vehicle: Vehicle) => {
      if (!currentUser) return;
      if (vehicle.status === 'AVAILABLE') {
          if (confirm(`Prendi ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_OUT');
              setMessage(`${vehicle.name} preso`);
              setTimeout(() => { setMessage(null); setCurrentUser(null); }, 2000);
          }
      } else if (vehicle.currentDriverId === currentUser.id) {
          if (confirm(`Restituisci ${vehicle.name}?`)) {
              onAction(vehicle, currentUser, 'CHECK_IN');
              setMessage(`${vehicle.name} restituito`);
              setTimeout(() => { setMessage(null); setCurrentUser(null); }, 2000);
          }
      } else {
          alert("In uso da altri.");
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative">
      <button onClick={() => setShowExitPinPad(true)} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full text-slate-400 z-50 opacity-20 hover:opacity-100"><ArrowLeft size={24} /></button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black mb-2 tracking-widest uppercase">TOTEM MEZZI</h1>
        <div className="text-5xl font-mono text-slate-300 flex items-center justify-center gap-3"><Clock size={40} className="text-[#EC1D25]" />{currentTime.toLocaleTimeString('it-IT')}</div>
      </div>

      {!currentUser ? (
        <div className="flex flex-col items-center w-full max-w-md">
          {message && <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg font-bold">{message}</div>}
          <div className="relative w-64 h-64 mb-8 flex items-center justify-center cursor-pointer" onClick={() => inputRef.current?.focus()}>
              <div className="absolute inset-0 bg-[#EC1D25] rounded-full animate-ping opacity-20"></div>
              <div className="relative bg-slate-800 p-8 rounded-full border-4 border-slate-700 text-[#EC1D25]"><Wifi size={64} className="animate-pulse" /></div>
          </div>
          <div className={`px-6 py-2 rounded-full border mb-8 flex items-center gap-2 ${nfcStatus === 'LISTENING' ? 'bg-green-900/30' : 'bg-slate-800'}`}>
              <div className={`w-3 h-3 rounded-full ${nfcStatus === 'LISTENING' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <span className="text-xs font-bold uppercase tracking-widest">Lettore Pronto</span>
          </div>
          <button onClick={() => setShowPinPad(true)} className="flex items-center gap-2 text-slate-400 border border-slate-700 px-8 py-3 rounded-full"><KeyRound size={20} /> Usa PIN</button>
        </div>
      ) : (
        <div className="w-full max-w-6xl animate-fade-in">
            <div className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#EC1D25] flex items-center justify-center font-bold text-xl">{currentUser.name.charAt(0)}</div>
                    <div><h2 className="text-2xl font-bold">Ciao, {currentUser.name}</h2><p className="text-slate-400 text-sm">Seleziona mezzo</p></div>
                </div>
                <button onClick={() => setCurrentUser(null)} className="px-4 py-2 bg-slate-700 rounded text-sm transition">Indietro</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {vehicles.map(vehicle => (
                    <button key={vehicle.id} disabled={vehicle.status !== 'AVAILABLE' && vehicle.currentDriverId !== currentUser.id} onClick={() => handleVehicleSelection(vehicle)} className={`p-6 rounded-xl border flex flex-col gap-4 text-left transition-all ${vehicle.currentDriverId === currentUser.id ? 'bg-orange-900/30 border-orange-500' : vehicle.status === 'AVAILABLE' ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-red-900/30 opacity-40'}`}>
                        <div className="flex justify-between"><div className="bg-slate-900 p-3 rounded-lg"><Truck size={32} /></div><div className="text-[10px] font-bold px-2 py-1 rounded border uppercase">{vehicle.status}</div></div>
                        <div><h3 className="text-xl font-bold">{vehicle.name}</h3><p className="text-slate-400 font-mono">{vehicle.plate}</p></div>
                    </button>
                ))}
            </div>
        </div>
      )}

      {(showPinPad || showExitPinPad) && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
              <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700 text-center">
                  <h3 className="text-xl font-bold mb-6 text-white">{showExitPinPad ? "Uscita" : "PIN"}</h3>
                  <div className="text-4xl font-mono py-4 bg-slate-900 rounded-lg text-white mb-6">{(showExitPinPad ? exitPin : enteredPin).padEnd(4, '•').split('').map(c => c === '•' ? '•' : '*').join('')}</div>
                  <div className="grid grid-cols-3 gap-3">
                      {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+num:p) : setEnteredPin(p=>p.length<6?p+num:p)} className="p-4 bg-slate-700 rounded-lg font-bold text-white">{num}</button>)}
                      <button onClick={() => {setEnteredPin(''); setExitPin('');}} className="p-4 bg-red-900/50 text-red-400 rounded-lg"><Delete size={24} className="mx-auto"/></button>
                      <button onClick={() => showExitPinPad ? setExitPin(p=>p.length<4?p+'0':p) : setEnteredPin(p=>p.length<6?p+'0':p)} className="p-4 bg-slate-700 rounded-lg font-bold text-white">0</button>
                      <button onClick={() => {
                          if(showExitPinPad) { if(exitPin === '1409') onExit(); else setExitPin(''); }
                          else { const e = employees.find(x => x.pin === enteredPin); if(e){setCurrentUser(e);setShowPinPad(false);}else{setEnteredPin('');} }
                      }} className="p-4 bg-blue-600 text-white rounded-lg"><CheckCircle size={24} className="mx-auto"/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VehicleKiosk;