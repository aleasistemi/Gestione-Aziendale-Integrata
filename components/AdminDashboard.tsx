import React, { useState, useMemo } from 'react';
import { Job, Employee, WorkLog, AttendanceRecord, Vehicle, VehicleLog, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { Search, Calendar, X } from 'lucide-react';

interface Props {
    currentUser: Employee | null;
    jobs: Job[];
    employees: Employee[];
    logs: WorkLog[];
    attendance: AttendanceRecord[];
    vehicles: Vehicle[];
    vehicleLogs: VehicleLog[];
    justifications: DayJustification[];
    customPrompts: AIQuickPrompt[];
    settings: GlobalSettings;
    permissions: RolePermissions;
    onSaveJob: (job: Job) => void;
    onSaveEmployee: (emp: Employee) => void;
    onSaveSettings: (settings: GlobalSettings) => void;
    onSavePermissions: (perms: RolePermissions) => void;
    onSaveAiPrompts: (prompts: AIQuickPrompt[]) => void;
    onSaveJustification: (just: DayJustification) => void;
    onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ 
    currentUser, jobs, employees, logs, attendance, vehicles, 
    vehicleLogs, justifications, customPrompts, settings, permissions,
    onSaveJob, onSaveEmployee, onSaveSettings, onSavePermissions, 
    onSaveAiPrompts, onSaveJustification, onLogout
}) => {
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [viewArchiveYear, setViewArchiveYear] = useState('active');

    const availableArchiveYears = useMemo(() => {
        const years = new Set<number>();
        jobs.forEach(j => {
            if (j.archiveYear) years.add(j.archiveYear);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [jobs]);

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Dashboard Amministrazione</h1>
                <button onClick={onLogout} className="text-red-600 font-bold hover:underline">Esci</button>
            </header>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
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

                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-1 rounded border border-slate-300">
                        <Calendar size={14} className="text-slate-400 ml-1"/>
                        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-28 text-xs"/>
                        <span className="text-slate-300">-</span>
                        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-28 text-xs"/>
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

            <div className="text-center py-20 text-slate-500">
                <p>Seleziona una scheda dal menu (Contenuto Dashboard completo non disponibile in questa fix).</p>
                <p>Dati caricati: {jobs.length} commesse, {employees.length} dipendenti.</p>
            </div>
        </div>
    );
};

export default AdminDashboard;