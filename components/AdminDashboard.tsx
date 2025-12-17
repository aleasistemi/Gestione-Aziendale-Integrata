import React, { useState, useMemo } from 'react';
import { 
  Employee, Job, WorkLog, AttendanceRecord, Role, 
  DayJustification, AIQuickPrompt, RolePermissions, 
  GlobalSettings, JobStatus, Vehicle, VehicleLog 
} from '../types';
import { analyzeBusinessData } from '../services/geminiService';
import { 
  LayoutDashboard, Users, Briefcase, Truck, BrainCircuit, Settings, 
  Search, Calendar, X, Plus, Save, Download, Trash2, Edit2, 
  CheckCircle, AlertCircle, ChevronRight, Filter, LogOut 
} from 'lucide-react';

interface Props {
  jobs: Job[];
  logs: WorkLog[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  vehicles: Vehicle[];
  vehicleLogs: VehicleLog[];
  justifications: DayJustification[];
  customPrompts: AIQuickPrompt[];
  permissions: RolePermissions;
  currentUserRole: Role;
  settings: GlobalSettings;
  
  onSaveJob: (job: Job) => void;
  onSaveEmployee: (emp: Employee) => void;
  onSaveJustification: (just: DayJustification) => void;
  onSaveAiPrompts: (prompts: AIQuickPrompt[]) => void;
  onSavePermissions: (perms: RolePermissions) => void;
  onUpdateLog: (log: WorkLog) => void;
  onSaveSettings: (settings: GlobalSettings) => void;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onDeleteAttendance: (id: string) => void;
  onSaveVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (id: string) => void;
}

export const AdminDashboard: React.FC<Props> = ({
  jobs, logs, employees, attendance, vehicles, vehicleLogs, justifications, 
  customPrompts, permissions, currentUserRole, settings,
  onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, 
  onSavePermissions, onUpdateLog, onSaveSettings, onSaveAttendance, 
  onDeleteAttendance, onSaveVehicle, onDeleteVehicle
}) => {
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [viewArchiveYear, setViewArchiveYear] = useState('active');

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Computed
  const availableArchiveYears = useMemo(() => {
    const years = new Set<number>();
    jobs.forEach(j => {
      if (j.archiveYear) years.add(j.archiveYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobs;
    
    // Archive Filter
    if (viewArchiveYear === 'active') {
      result = result.filter(j => !j.isArchived);
    } else {
      result = result.filter(j => j.isArchived && j.archiveYear === parseInt(viewArchiveYear));
    }

    // Search Filter
    if (globalSearchTerm) {
      const lower = globalSearchTerm.toLowerCase();
      result = result.filter(j => 
        j.code.toLowerCase().includes(lower) || 
        j.clientName.toLowerCase().includes(lower) || 
        j.description.toLowerCase().includes(lower)
      );
    }

    return result;
  }, [jobs, viewArchiveYear, globalSearchTerm]);

  const handleAiAnalysis = async () => {
    if (!aiPrompt.trim()) return;
    setIsAnalyzing(true);
    setAiResponse('');
    
    try {
        const result = await analyzeBusinessData(
            aiPrompt, 
            { jobs: filteredJobs, logs, employees }, 
            settings.geminiApiKey || ''
        );
        setAiResponse(result);
    } catch (e) {
        setAiResponse("Errore durante l'analisi. Verifica la configurazione API Key.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
       {/* Top Bar with Search */}
       <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Dashboard Amministrazione</h1>
            
            <div className="flex items-center gap-4">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Cerca Commessa o Cliente..." 
                        value={globalSearchTerm}
                        onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <Search className="absolute left-3 top-2 text-slate-400" size={16}/>
                </div>

                <div className="flex items-center gap-2 text-sm bg-white p-1 rounded border border-slate-300">
                    <Calendar size={14} className="text-slate-400 ml-1"/>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="outline-none text-slate-600 w-28 text-xs"/>
                    <span className="text-slate-300">-</span>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="outline-none text-slate-600 w-28 text-xs"/>
                    {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                </div>

                <select 
                    value={viewArchiveYear} 
                    onChange={(e) => setViewArchiveYear(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="active">Visualizza: Attive</option>
                    {availableArchiveYears.map(year => (
                        <option key={year} value={year.toString()}>Archivio {year}</option>
                    ))}
                </select>
            </div>
       </div>

       {/* Tabs Navigation */}
       <div className="flex gap-4 mb-6 border-b border-slate-200 overflow-x-auto">
           {[
             { id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard },
             { id: 'JOBS', label: 'Commesse', icon: Briefcase },
             { id: 'HR', label: 'Risorse Umane', icon: Users },
             { id: 'FLEET', label: 'Parco Mezzi', icon: Truck },
             { id: 'AI', label: 'Analisi AI', icon: BrainCircuit },
             { id: 'SETTINGS', label: 'Impostazioni', icon: Settings }
           ].map(tab => (
               <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-4 font-medium text-sm transition-colors relative flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
               >
                   <tab.icon size={16} />
                   {tab.label}
                   {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
               </button>
           ))}
       </div>

       {/* Content Area */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
            {activeTab === 'OVERVIEW' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <h3 className="text-blue-800 font-bold mb-2">Commesse Attive</h3>
                        <p className="text-3xl font-black text-blue-900">{jobs.filter(j => j.status === 'In Corso').length}</p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                        <h3 className="text-green-800 font-bold mb-2">Dipendenti Presenti</h3>
                        <p className="text-3xl font-black text-green-900">
                          {/* Semplice conta dei dipendenti con entrata oggi senza uscita */}
                          {employees.filter(e => {
                            const lastAtt = attendance.filter(a => a.employeeId === e.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                            return lastAtt && lastAtt.type === 'ENTRATA' && new Date(lastAtt.timestamp).toDateString() === new Date().toDateString();
                          }).length}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                        <h3 className="text-purple-800 font-bold mb-2">Mezzi in Uso</h3>
                        <p className="text-3xl font-black text-purple-900">{vehicles.filter(v => v.status === 'IN_USE').length}</p>
                    </div>
                </div>
            )}
            
            {activeTab === 'JOBS' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Elenco Commesse ({filteredJobs.length})</h3>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                           <Plus size={16} /> Nuova Commessa
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Codice</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Stato</th>
                                    <th className="px-4 py-3">Budget</th>
                                    <th className="px-4 py-3">Scadenza</th>
                                    <th className="px-4 py-3">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredJobs.slice(0, 15).map(job => (
                                    <tr key={job.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium">{job.code}</td>
                                        <td className="px-4 py-3">{job.clientName}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${job.status === 'In Corso' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{job.budgetHours} h</td>
                                        <td className="px-4 py-3">{job.deadline}</td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

             {activeTab === 'AI' && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl mb-6 shadow-lg">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><BrainCircuit /> Analisi Aziendale Gemini 2.5 Flash</h3>
                        <p className="opacity-90 text-sm">Usa l'intelligenza artificiale per analizzare andamento commesse, efficienza dipendenti e previsioni finanziarie.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1 space-y-2">
                             <p className="text-xs font-bold text-slate-400 uppercase mb-2">Prompt Rapidi</p>
                             {customPrompts.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => setAiPrompt(p.prompt)}
                                    className="w-full text-left p-3 rounded-lg text-sm bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition shadow-sm"
                                >
                                    {p.label}
                                </button>
                             ))}
                        </div>
                        <div className="md:col-span-3">
                             <textarea 
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl p-4 h-32 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm mb-4"
                                placeholder="Esempio: Analizza le commesse in perdita nell'ultimo mese..."
                            />
                            <div className="flex justify-end mb-6">
                                <button 
                                    onClick={handleAiAnalysis}
                                    disabled={isAnalyzing || !settings.geminiApiKey}
                                    className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md transition-all active:scale-95"
                                >
                                    {isAnalyzing ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Analisi...</>
                                    ) : (
                                        <><BrainCircuit size={18}/> Genera Analisi</>
                                    )}
                                </button>
                            </div>

                            {aiResponse && (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg prose prose-slate max-w-none animate-fade-in">
                                    <div className="flex items-center gap-2 text-purple-600 font-bold mb-4 border-b pb-2">
                                        <BrainCircuit size={20}/> Risposta AI
                                    </div>
                                    <div className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-medium">
                                        {aiResponse}
                                    </div>
                                </div>
                            )}
                            
                            {!settings.geminiApiKey && (
                                <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-sm border border-yellow-200 flex items-center gap-2">
                                    <AlertCircle size={16}/> 
                                    Per utilizzare l'AI, inserisci la tua API Key Gemini nelle Impostazioni.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {(activeTab === 'HR' || activeTab === 'FLEET' || activeTab === 'SETTINGS') && (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <Settings size={48} className="mb-4 opacity-20"/>
                     <p>Sezione {activeTab} disponibile prossimamente</p>
                 </div>
            )}
       </div>
    </div>
  );
};