
import React, { useState } from 'react';
import { Job, WorkLog, Employee, JobStatus } from '../types';
import { Clock, Save, FileText, Plus, Calendar, Trash2, Edit2 } from 'lucide-react';

interface Props {
  currentUser: Employee;
  jobs: Job[];
  logs: WorkLog[];
  onAddLog: (log: WorkLog) => void;
  onDeleteLog: (logId: string) => void;
  onUpdateLog: (log: WorkLog) => void;
}

const WorkshopPanel: React.FC<Props> = ({ currentUser, jobs, logs, onAddLog, onDeleteLog, onUpdateLog }) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [phase, setPhase] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // State for Editing
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const activeJobs = jobs.filter(j => j.status === JobStatus.IN_PROGRESS || j.status === JobStatus.PLANNED);
  
  // Recent logs for this user
  const myLogs = logs.filter(l => l.employeeId === currentUser.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  // Helper to get last phase
  const getLastPhase = (jobId: string) => {
    const jobLogs = logs.filter(l => l.jobId === jobId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return jobLogs.length > 0 ? jobLogs[0].phase : '-';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !hours || !phase || !date) return;

    if (editingLogId) {
        // Update existing
        const updatedLog: WorkLog = {
            id: editingLogId,
            employeeId: currentUser.id,
            jobId: selectedJobId,
            phase,
            hours: parseFloat(hours),
            date,
            notes
        };
        onUpdateLog(updatedLog);
        setEditingLogId(null);
        alert('Registrazione aggiornata!');
    } else {
        // Create new
        const newLog: WorkLog = {
            id: Date.now().toString(),
            employeeId: currentUser.id,
            jobId: selectedJobId,
            phase,
            hours: parseFloat(hours),
            date: date,
            notes
        };
        onAddLog(newLog);
        alert('Ore caricate con successo!');
    }

    // Reset form but keep date
    setHours('');
    setPhase('');
    setNotes('');
    setSelectedJobId('');
  };

  const startEdit = (log: WorkLog) => {
      setEditingLogId(log.id);
      setSelectedJobId(log.jobId);
      setHours(log.hours.toString());
      setPhase(log.phase);
      setNotes(log.notes || '');
      setDate(log.date);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
      setEditingLogId(null);
      setHours('');
      setPhase('');
      setNotes('');
      setSelectedJobId('');
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Pannello Operativo</h1>
          <p className="text-slate-500">Benvenuto, {currentUser.name} ({currentUser.department})</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow text-slate-600 font-mono border-l-4 border-[#EC1D25]">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${editingLogId ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-slate-200'}`}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700">
              <div className={`${editingLogId ? 'bg-yellow-500' : 'bg-[#EC1D25]'} text-white p-1 rounded`}>
                {editingLogId ? <Edit2 size={20} /> : <Plus size={20} />}
              </div>
              {editingLogId ? 'Modifica Registrazione' : 'Nuova Registrazione Ore'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Commessa Attiva</label>
                  <select 
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    required
                  >
                    <option value="">Seleziona Commessa...</option>
                    {activeJobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.code} - {job.clientName} ({job.description})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fase Lavorativa</label>
                  <select 
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    required
                  >
                    <option value="">Seleziona Fase...</option>
                    <option value="Preventivo">Preventivo</option>
                    <option value="Ordine">Ordine</option>
                    <option value="Taglio">Taglio</option>
                    <option value="Lavorazioni">Lavorazioni</option>
                    <option value="Assemblaggio">Assemblaggio</option>
                    <option value="Taglio Pannelli">Taglio Pannelli</option>
                    <option value="Preparazione Accessori">Preparazione Accessori</option>
                    <option value="Imballaggio">Imballaggio</option>
                    <option value="Spedizione">Spedizione</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Lavoro</label>
                  <div className="relative">
                    <input 
                        type="date" 
                        max={today}
                        className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none pl-9"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                    />
                    <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={18} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ore Lavorate</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="0"
                    max="24"
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    required
                    placeholder="Es. 4.5"
                  />
                </div>
                
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Note (Opzionale)</label>
                  <input 
                    type="text" 
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Dettagli operazione..."
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                {editingLogId && (
                    <button 
                        type="button" 
                        onClick={cancelEdit}
                        className="flex-1 bg-slate-100 text-slate-600 font-semibold py-3 rounded-lg hover:bg-slate-200 transition"
                    >
                        Annulla Modifica
                    </button>
                )}
                <button 
                  type="submit" 
                  className={`flex-1 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-md ${editingLogId ? 'bg-yellow-500' : 'bg-[#EC1D25]'}`}
                >
                  <Save size={20} />
                  {editingLogId ? 'Aggiorna Registrazione' : 'Salva Registrazione'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700">
               <FileText className="text-slate-500" />
               Dettaglio Commesse Attive
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Codice</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Descrizione</th>
                    <th className="px-4 py-3">Ultima Fase</th>
                    <th className="px-4 py-3">Budget Ore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{job.code}</td>
                      <td className="px-4 py-3 text-slate-600">{job.clientName}</td>
                      <td className="px-4 py-3 text-slate-600">{job.description}</td>
                      <td className="px-4 py-3 text-slate-500 italic">{getLastPhase(job.id)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{job.budgetHours} h</span>
                      </td>
                    </tr>
                  ))}
                  {activeJobs.length === 0 && (
                      <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                              Nessuna commessa attiva. Contattare l'amministrazione.
                          </td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
              <Clock className="text-[#EC1D25]" />
              Tue Ultime Attività
            </h2>
            {myLogs.length === 0 ? (
              <p className="text-slate-400 italic text-sm">Nessuna attività recente registrata.</p>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2">
                {myLogs.map((log, idx) => {
                  const job = jobs.find(j => j.id === log.jobId);
                  return (
                    <div key={idx} className="mb-6 ml-6 relative group">
                      <span className="flex absolute -left-8 justify-center items-center w-4 h-4 bg-white rounded-full ring-4 ring-slate-100 border border-slate-300">
                      </span>
                      <div className="flex justify-between items-start">
                          <div>
                            <h3 className="flex items-center mb-1 text-sm font-semibold text-slate-900">
                                {job?.code} - {job?.clientName}
                            </h3>
                            <time className="block mb-2 text-xs font-normal leading-none text-slate-400">
                                {new Date(log.date).toLocaleDateString('it-IT')}
                            </time>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => startEdit(log)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Modifica">
                                  <Edit2 size={14} />
                              </button>
                              <button onClick={() => onDeleteLog(log.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Elimina">
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </div>
                      
                      <p className="mb-2 text-sm font-normal text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                        {log.phase}: <strong>{log.hours} ore</strong> <br/>
                        {log.notes && <span className="text-xs text-slate-400 italic">"{log.notes}"</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default WorkshopPanel;
