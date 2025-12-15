
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser, BrainCircuit, Timer } from 'lucide-react';
import { analyzeBusinessData } from '../services/geminiService';
import { read, utils, writeFile } from 'xlsx';
import { dbService } from '../services/db';

interface Props {
  jobs: Job[];
  logs: WorkLog[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  justifications: DayJustification[];
  customPrompts: AIQuickPrompt[];
  permissions: RolePermissions;
  onSaveJob: (job: Job) => void;
  onSaveEmployee: (emp: Employee) => void;
  onSaveJustification: (just: DayJustification) => void;
  onSaveAiPrompts: (prompts: AIQuickPrompt[]) => void;
  onSavePermissions: (perms: RolePermissions) => void;
  onUpdateLog: (log: WorkLog) => void;
  currentUserRole: Role;
  settings: GlobalSettings;
  onSaveSettings: (settings: GlobalSettings) => void;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onDeleteAttendance: (recordId: string) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EC1D25'];

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

const AdminDashboard: React.FC<Props> = ({ jobs, logs, employees, attendance, justifications = [], customPrompts = [], permissions = {}, onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, onSavePermissions, onUpdateLog, currentUserRole, settings, onSaveSettings, onSaveAttendance, onDeleteAttendance }) => {
  
  // Permissions Logic
  const isGodMode = currentUserRole === Role.SYSTEM_ADMIN || currentUserRole === Role.DIRECTION;
  const isSystem = currentUserRole === Role.SYSTEM_ADMIN;
  const canManageEmployees = currentUserRole === Role.DIRECTION || currentUserRole === Role.SYSTEM_ADMIN;

  const getAllowedTabs = () => {
      if (isSystem) return ['OVERVIEW', 'JOBS', 'HR', 'AI', 'MANAGE', 'CONFIG'];
      const rolePerms = permissions[currentUserRole];
      if (rolePerms) return rolePerms;
      return ['OVERVIEW'];
  }

  const allowedTabsList = getAllowedTabs();

  const allPossibleTabs = [
    {id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard},
    {id: 'JOBS', label: 'Analisi Commesse', icon: Briefcase},
    {id: 'HR', label: 'HR & PAGHE', icon: Users},
    {id: 'AI', label: 'AI Analyst', icon: BrainCircuit},
    {id: 'MANAGE', label: 'GESTIONE DATI', icon: Settings},
    {id: 'CONFIG', label: 'CONFIGURAZIONE', icon: Wrench}
  ];

  const availableTabs = allPossibleTabs.filter(t => allowedTabsList.includes(t.id));

  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'OVERVIEW');
  const [manageSubTab, setManageSubTab] = useState<'JOBS' | 'EMPLOYEES'>('JOBS');
  
  // Drill down state
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [tempPhase, setTempPhase] = useState<string>('');

  // Bulk Job Actions
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Sorting State
  const [jobSort, setJobSort] = useState<SortConfig>(null);
  const [manageJobSort, setManageJobSort] = useState<SortConfig>(null);

  // Date Filtering State (Global for Overview and Jobs)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Phase Management State
  const [newPhaseName, setNewPhaseName] = useState('');

  useEffect(() => {
     if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
         setActiveTab(availableTabs[0].id);
     }
  }, [currentUserRole, permissions]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [tempPromptText, setTempPromptText] = useState('');
  const [tempPromptLabel, setTempPromptLabel] = useState('');

  // HR Tab States
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<string | null>(null);

  // Form States
  const [isEditingJob, setIsEditingJob] = useState<Partial<Job> | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState<Partial<Employee> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Permission Editing State
  const [tempPermissions, setTempPermissions] = useState<RolePermissions>(permissions);

  // --- Calculations for BI ---

  const jobStats = useMemo(() => {
    return jobs.map(job => {
      const jobLogs = logs.filter(l => l.jobId === job.id);
      const totalHoursUsed = jobLogs.reduce((acc, log) => acc + log.hours, 0);
      
      const totalCost = jobLogs.reduce((acc, log) => {
        const emp = employees.find(e => e.id === log.employeeId);
        return acc + (log.hours * (emp ? emp.hourlyRate : 0));
      }, 0);

      const isOverBudget = totalHoursUsed > job.budgetHours;
      const profitMargin = job.budgetValue - totalCost;

      // Find Start Date (First Log)
      const sortedLogs = [...jobLogs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const startDate = sortedLogs.length > 0 ? sortedLogs[0].date : '-';
      const lastLog = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1] : null;
      const lastPhase = lastLog ? lastLog.phase : '-';

      return { ...job, totalHoursUsed, totalCost, profitMargin, isOverBudget, startDate, lastPhase };
    });
  }, [jobs, logs, employees]);

  // Filtering Helper
  const filterJobsByDate = (jobList: typeof jobStats) => {
      if (!filterStartDate && !filterEndDate) return jobList;
      return jobList.filter(j => {
          if (j.startDate === '-') return false; // Exclude jobs without start date if filtering
          const isAfterStart = !filterStartDate || j.startDate >= filterStartDate;
          const isBeforeEnd = !filterEndDate || j.startDate <= filterEndDate;
          return isAfterStart && isBeforeEnd;
      });
  };

  // Sorting Helper
  const sortData = (data: any[], config: SortConfig) => {
      if (!config) return data;
      return [...data].sort((a, b) => {
          if (a[config.key] < b[config.key]) return config.direction === 'asc' ? -1 : 1;
          if (a[config.key] > b[config.key]) return config.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const filteredJobStats = useMemo(() => filterJobsByDate(jobStats), [jobStats, filterStartDate, filterEndDate]);
  const sortedJobStats = useMemo(() => sortData(filteredJobStats, jobSort), [filteredJobStats, jobSort]);
  const sortedManageJobs = useMemo(() => sortData(filteredJobStats, manageJobSort), [filteredJobStats, manageJobSort]); 

  const requestSort = (key: string, currentSort: SortConfig, setSort: any) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (currentSort && currentSort.key === key && currentSort.direction === 'asc') {
          direction = 'desc';
      }
      setSort({ key, direction });
  }

  const renderSortArrow = (key: string, currentSort: SortConfig) => {
      if (!currentSort || currentSort.key !== key) return <span className="text-slate-300 ml-1">↕</span>;
      return currentSort.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1"/> : <ArrowDown size={14} className="inline ml-1"/>;
  }

  const clientData = useMemo(() => {
    const data: {[key: string]: number} = {};
    filteredJobStats.forEach(stat => {
      data[stat.clientName] = (data[stat.clientName] || 0) + stat.totalHoursUsed;
    });
    return Object.keys(data).map(key => ({ name: key, hours: data[key] }));
  }, [filteredJobStats]);

  const statusData = useMemo(() => {
    const counts: {[key: string]: number} = {};
    filteredJobStats.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredJobStats]);

  const topClientsByRevenue = useMemo(() => {
      const map: {[key:string]: number} = {};
      filteredJobStats.forEach(j => {
          map[j.clientName] = (map[j.clientName] || 0) + j.budgetValue;
      });
      return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [filteredJobStats]);

  const overBudgetClients = useMemo(() => {
      const map: {[key:string]: {over: number, total: number}} = {};
      filteredJobStats.filter(j => j.isOverBudget).forEach(j => {
          if (!map[j.clientName]) map[j.clientName] = {over: 0, total: 0};
          map[j.clientName].over += (j.totalHoursUsed - j.budgetHours);
          map[j.clientName].total += j.totalHoursUsed;
      });
      return Object.entries(map).sort((a,b) => b[1].over - a[1].over).slice(0, 5);
  }, [filteredJobStats]);

  const packagingJobs = useMemo(() => {
      return jobStats.filter(j => j.status === JobStatus.IN_PROGRESS && j.lastPhase.toLowerCase().includes('imballaggio'));
  }, [jobStats]);

  const phaseEfficiency = useMemo(() => {
      const map: {[phase:string]: {[emp:string]: number}} = {};
      logs.forEach(l => {
          const empName = employees.find(e => e.id === l.employeeId)?.name || 'Unknown';
          if (!map[l.phase]) map[l.phase] = {};
          map[l.phase][empName] = (map[l.phase][empName] || 0) + l.hours;
      });
      return Object.entries(map).map(([phase, emps]) => {
          const topEmp = Object.entries(emps).sort((a,b) => b[1] - a[1])[0];
          return { phase, champion: topEmp[0], hours: topEmp[1] };
      });
  }, [logs, employees]);

  // NEW REPORTS
  const expiringJobs = useMemo(() => {
      return jobStats
        .filter(j => j.status === JobStatus.IN_PROGRESS && j.deadline)
        .sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 5);
  }, [jobStats]);

  const activeOperators = useMemo(() => {
     // Filter logs based on date range if set
     const relevantLogs = logs.filter(l => {
         if (!filterStartDate && !filterEndDate) return true;
         return (!filterStartDate || l.date >= filterStartDate) && (!filterEndDate || l.date <= filterEndDate);
     });
     
     const map: {[id:string]: number} = {};
     relevantLogs.forEach(l => {
         map[l.employeeId] = (map[l.employeeId] || 0) + l.hours;
     });
     return Object.entries(map)
        .map(([id, hours]) => ({ name: employees.find(e=>e.id===id)?.name || 'Unknown', hours }))
        .sort((a,b) => b.hours - a.hours)
        .slice(0, 5);
  }, [logs, employees, filterStartDate, filterEndDate]);

  const recentActivities = useMemo(() => {
      return [...logs]
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(l => ({
            ...l,
            empName: employees.find(e => e.id === l.employeeId)?.name,
            jobCode: jobs.find(j => j.id === l.jobId)?.code
        }));
  }, [logs, employees, jobs]);


  const handleAskAI = async (promptText: string = aiPrompt) => {
    if (!settings.geminiApiKey) {
        alert("Per utilizzare AI Analyst, devi prima inserire una API Key valida nella sezione CONFIGURAZIONE.");
        return;
    }
    if (!promptText.trim()) return;
    setAiPrompt(promptText);
    setIsLoadingAi(true);
    setAiResponse('');
    const context = { jobs: filteredJobStats, logs, employees };
    try {
        const result = await analyzeBusinessData(promptText, context, settings.geminiApiKey);
        setAiResponse(result);
    } catch (e) {
        setAiResponse("Errore durante l'analisi. Verifica la tua API Key.");
    } finally {
        setIsLoadingAi(false);
    }
  };

  const handleSavePrompt = (id: string) => {
      const updated = customPrompts.map(p => p.id === id ? { ...p, label: tempPromptLabel, prompt: tempPromptText } : p);
      onSaveAiPrompts(updated);
      setEditingPromptId(null);
  };
  
  const handleExcelExportJobs = (sourceData: typeof jobStats) => {
      const jobsToExport = selectedJobIds.size > 0 
        ? sourceData.filter(j => selectedJobIds.has(j.id))
        : sourceData;

      const data = jobsToExport.map(j => ({
          'Codice': j.code,
          'Cliente': j.clientName,
          'Descrizione': j.description,
          'Stato': j.status,
          'Budget Ore': j.budgetHours,
          'Ore Usate': j.totalHoursUsed,
          'Valore Commessa': j.budgetValue,
          'Margine': j.profitMargin,
          'Scadenza': j.deadline,
          'Data Inizio': j.startDate,
          'Priorità': j.priority || 3
      }));

      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Commesse");
      writeFile(workbook, `Report_Commesse_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleBackupDownload = async () => {
    const data = await dbService.exportDatabase();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBackupRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    const success = await dbService.importDatabase(text);
    if(success) {
        alert("Backup ripristinato con successo! La pagina verrà ricaricata.");
        window.location.reload();
    } else {
        alert("Errore nel ripristino del backup. File non valido.");
    }
  };

  const handleResetJobs = async () => {
      if (window.confirm("ATTENZIONE: Stai per eliminare TUTTE le commesse e le registrazioni delle ore lavorate.\n\nQuesta azione NON è reversibile.\n\nSei sicuro di voler procedere per pulire l'archivio?")) {
          try {
              await dbService.resetJobsAndLogs();
              alert("Archivio pulito con successo. La pagina verrà ricaricata.");
              window.location.reload();
          } catch(e) {
              alert("Errore durante la pulizia. Controlla la console.");
          }
      }
  }

  // --- Import Logic ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      // (Import logic unchanged for brevity, reusing previous implementation)
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws, { header: 1 }); // Array of arrays

          const jobsBatchMap = new Map<string, Job>();
          const empsBatchMap = new Map<string, Employee>();
          const logsBatchList: WorkLog[] = [];
          
          const codeToIdMap = new Map<string, string>(); 

          let jobsCreated = 0;
          let jobsUpdated = 0;
          let logsCreated = 0;
          
          let lastJobId: string | null = null;

          let headerIndex = -1;
          for(let i=0; i<Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if(row.some(cell => cell && cell.toString().trim().toLowerCase() === 'riferimento')) {
                  headerIndex = i;
                  break;
              }
          }
          
          if(headerIndex === -1) {
              alert("Intestazione 'Riferimento' non trovata nelle prime 20 righe.");
              return;
          }

          const headerRow = data[headerIndex] as string[];
          const colMap: {[key:string]: number} = {};
          headerRow.forEach((cell, idx) => {
              if(typeof cell === 'string') colMap[cell.trim()] = idx;
          });
          
          const getCol = (row: any[], name: string) => {
              const idx = colMap[name];
              return (idx !== undefined && row[idx] !== undefined) ? row[idx] : null;
          }

          const formatDate = (val: any) => {
              if(!val) return '';
              if (typeof val === 'string' && val.includes('.')) {
                  const parts = val.split('.');
                  if (parts.length === 3) {
                      let year = parseInt(parts[2]);
                      if (year < 100) year += 2000;
                      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  }
              }
              if(val instanceof Date) return val.toISOString().split('T')[0];
              return '';
          }

          for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (row.length === 0) continue;

              const code = getCol(row, 'Riferimento');
              const operatorRaw = getCol(row, 'Operatore');
              
              if (!operatorRaw) continue; 

              if (code) {
                  const cleanCode = String(code).trim();
                  
                  let existingJob = jobs.find(j => j.code === cleanCode);
                  if (!existingJob) {
                      const batchId = codeToIdMap.get(cleanCode);
                      if (batchId) existingJob = jobsBatchMap.get(batchId);
                  }

                  let jobId: string;

                  if (existingJob) {
                      jobId = existingJob.id;
                      if (!jobsBatchMap.has(jobId)) { 
                          jobsUpdated++;
                      }
                  } else {
                      jobId = Date.now().toString() + Math.random().toString().slice(2,5);
                      codeToIdMap.set(cleanCode, jobId);
                      jobsCreated++;
                  }

                  const jobData: Job = {
                      id: jobId,
                      code: cleanCode,
                      clientName: String(getCol(row, 'Cliente') || 'Sconosciuto'),
                      description: String(getCol(row, 'Descrizione') || ''),
                      status: existingJob ? existingJob.status : JobStatus.IN_PROGRESS,
                      budgetHours: Number(getCol(row, 'Monte Ore') || 0),
                      budgetValue: Number(getCol(row, 'Valore') || 0),
                      deadline: formatDate(getCol(row, 'Data Consegna')),
                      priority: existingJob ? (existingJob.priority || 3) : 3,
                      suggestedOperatorId: existingJob?.suggestedOperatorId
                  };
                  
                  jobsBatchMap.set(jobId, jobData);
                  lastJobId = jobId;
              }

              if (lastJobId && operatorRaw) {
                  const operatorName = String(operatorRaw).trim();
                  let emp = employees.find(e => e.name.toLowerCase().includes(operatorName.toLowerCase()));
                  
                  if (!emp) {
                      for (const batchEmp of empsBatchMap.values()) {
                          if (batchEmp.name.toLowerCase() === operatorName.toLowerCase()) {
                              emp = batchEmp;
                              break;
                          }
                      }
                  }

                  if (!emp) {
                      const newEmpId = 'imp-' + Date.now() + Math.random().toString().slice(2,5);
                      emp = {
                          id: newEmpId,
                          name: operatorName,
                          role: Role.WORKSHOP,
                          hourlyRate: 30,
                          department: 'Importato',
                          toleranceMinutes: 10,
                          scheduleStartMorning: "08:30",
                          scheduleEndMorning: "12:30",
                          scheduleStartAfternoon: "13:30",
                          scheduleEndAfternoon: "17:30",
                          workDays: [1,2,3,4,5]
                      };
                      empsBatchMap.set(newEmpId, emp);
                  }

                  const hoursRaw = getCol(row, 'Ore');
                  let hours = 0;
                  if (typeof hoursRaw === 'number') {
                      hours = hoursRaw * 24;
                  } else if (typeof hoursRaw === 'string' && hoursRaw.includes(':')) {
                      const [h, m] = hoursRaw.split(':').map(Number);
                      hours = h + (m/60);
                  }

                  if (hours > 0) {
                       const logDate = formatDate(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0];
                       const logId = `log-${lastJobId}-${emp.id}-${logDate}-${hours.toFixed(2)}`;
                       
                       const existsInDb = logs.some(l => l.id === logId);
                       const existsInBatch = logsBatchList.some(l => l.id === logId);

                       if (!existsInDb && !existsInBatch) {
                           const newLog: WorkLog = {
                               id: logId,
                               jobId: lastJobId,
                               employeeId: emp.id,
                               date: logDate,
                               hours: hours,
                               phase: 'Generica (Import)',
                               notes: 'Importato da Excel'
                           };
                           logsBatchList.push(newLog);
                           logsCreated++;
                       }
                  }
              }
          }

          if (jobsBatchMap.size > 0 || logsBatchList.length > 0) {
              try {
                  await dbService.bulkImport(
                      Array.from(jobsBatchMap.values()),
                      logsBatchList,
                      Array.from(empsBatchMap.values())
                  );
                  alert(`Importazione Completata con Successo!\n\nNuove Commesse: ${jobsCreated}\nCommesse Aggiornate: ${jobsUpdated}\nRegistrazioni Ore: ${logsCreated}\n\nLa pagina verrà ricaricata.`);
                  window.location.reload();
              } catch (e) {
                  console.error("Bulk Import Error", e);
                  alert("Errore durante il salvataggio dei dati. Controlla la console.");
              }
          } else {
              alert("Nessun dato valido trovato da importare.");
          }
      };
      reader.readAsBinaryString(file);
  };

  const addPhase = () => {
      if (newPhaseName && !settings.workPhases.includes(newPhaseName)) {
          const newPhases = [...settings.workPhases, newPhaseName];
          onSaveSettings({...settings, workPhases: newPhases});
          setNewPhaseName('');
      }
  }

  const removePhase = (phaseToRemove: string) => {
      if (confirm(`Sei sicuro di voler eliminare la fase "${phaseToRemove}"?`)) {
          const newPhases = settings.workPhases.filter(p => p !== phaseToRemove);
          onSaveSettings({...settings, workPhases: newPhases});
      }
  }

  // --- REVISED HR CALCULATIONS (STRICT MODE + EVENING OVERTIME 30m) ---
  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { 
        standardHours: 0, overtime: 0, 
        isLate: false, isAnomaly: false, isAbsent: false, 
        firstIn: null, lastOut: null, 
        lunchOut: null, lunchIn: null,
        records: [], justification: null,
        firstInId: null, lunchOutId: null, lunchInId: null, lastOutId: null
    };

    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Crucial: Check against employee's specific work days
    const isWorkDay = (emp.workDays || [1,2,3,4,5]).includes(dayOfWeek);

    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    
    // 1. Get Records
    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 2. Identify Key Timestamps (Entrata 1, Uscita 1, Entrata 2, Uscita 2)
    let firstIn: string | null = null;
    let firstInId: string | null = null;
    let firstInMins: number = 0;
    
    let lunchOut: string | null = null;
    let lunchOutId: string | null = null;
    let lunchOutMins: number = 0;
    
    let lunchIn: string | null = null;
    let lunchInId: string | null = null;
    let lunchInMins: number = 0;
    
    let lastOut: string | null = null;
    let lastOutId: string | null = null;
    let lastOutMins: number = 0;

    const getMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
    const parseTimeStr = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    if (dayAttendance.length > 0 && dayAttendance[0].type === 'ENTRATA') {
        const d = new Date(dayAttendance[0].timestamp);
        firstIn = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        firstInMins = getMinutes(d);
        firstInId = dayAttendance[0].id;
    }
    
    // Attempt to identify lunch break if there are 4 records
    if (dayAttendance.length >= 2 && dayAttendance[1].type === 'USCITA') {
         // Could be lunch out or final exit if only half day
         const d = new Date(dayAttendance[1].timestamp);
         if (dayAttendance.length >= 3) {
             lunchOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             lunchOutMins = getMinutes(d);
             lunchOutId = dayAttendance[1].id;
         } else {
             lastOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             lastOutMins = getMinutes(d);
             lastOutId = dayAttendance[1].id;
         }
    }
    if (dayAttendance.length >= 3 && dayAttendance[2].type === 'ENTRATA') {
        const d = new Date(dayAttendance[2].timestamp);
        lunchIn = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        lunchInMins = getMinutes(d);
        lunchInId = dayAttendance[2].id;
    }
    if (dayAttendance.length >= 4 && dayAttendance[3].type === 'USCITA') {
        const d = new Date(dayAttendance[3].timestamp);
        lastOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        lastOutMins = getMinutes(d);
        lastOutId = dayAttendance[3].id;
    }

    // --- STRICT CALCULATION LOGIC ---
    let standardHours = 0;
    let overtime = 0;

    // Get Schedule (In Minutes)
    const schStartM = parseTimeStr(emp.scheduleStartMorning || "08:30");
    const schEndM = parseTimeStr(emp.scheduleEndMorning || "12:30");
    const schStartA = parseTimeStr(emp.scheduleStartAfternoon || "13:30");
    const schEndA = parseTimeStr(emp.scheduleEndAfternoon || "17:30");

    // MORNING SESSION
    if (firstIn && (lunchOut || lastOut)) {
        // If only 2 records, the second one is treated as lastOut but might be lunch depending on time
        // But for calculation simplicity, if we have In1 and Out1 (whether it's lunch or final), we calc duration
        const exitMins = lunchOut ? lunchOutMins : lastOutMins; 
        
        // Logic: Start from Schedule if entered early. Start from Entry if entered late.
        const effectiveStart = Math.max(firstInMins, schStartM);
        
        // Logic: End at Schedule if exited late (Overtime disregarded in morning/lunch per request logic "only evening").
        // If exited early, End is actual Exit.
        const effectiveEnd = Math.min(exitMins, schEndM);

        if (effectiveEnd > effectiveStart) {
            standardHours += (effectiveEnd - effectiveStart) / 60;
        }
    }

    // AFTERNOON SESSION
    if (lunchIn && lastOut) {
        // Logic: Start from Schedule if entered early.
        const effectiveStart = Math.max(lunchInMins, schStartA);
        
        // Logic: Standard Hours capped at Schedule End.
        const effectiveEnd = Math.min(lastOutMins, schEndA);

        if (effectiveEnd > effectiveStart) {
            standardHours += (effectiveEnd - effectiveStart) / 60;
        }

        // --- OVERTIME CALCULATION (EVENING ONLY) ---
        // Logic: "Straordinario calcolalo in automatico sull'uscita serale ogni 30 minuti"
        if (lastOutMins > schEndA) {
            const diffMinutes = lastOutMins - schEndA;
            const blocks = Math.floor(diffMinutes / 30); // 30 min blocks
            overtime += blocks * 0.5;
        }
    } else if (!lunchOut && firstIn && lastOut) {
        // Continuous shift case (handled by first block mostly, but check evening overtime if applicable)
        if (lastOutMins > schEndA) {
             const diffMinutes = lastOutMins - schEndA;
             const blocks = Math.floor(diffMinutes / 30);
             overtime += blocks * 0.5;
        }
    }

    // 4. Handle Justifications (Overrides)
    if (justification) {
        if (justification.type === JustificationType.FERIE || justification.type === JustificationType.MALATTIA) {
            // Usually counts as 8h standard for payroll, but 0 worked
            // We return 0 worked, but the UI will show the justification column
        } else if (justification.type === JustificationType.PERMESSO) {
            // Permesso adds to "paid" time but not physically worked, simplified here
        }
    }

    // 6. Detect Issues
    let isLate = false;
    let isAnomaly = false;
    let isAbsent = false;

    // Late Logic
    if (firstIn && !justification) {
        const limitMinutes = schStartM + (emp.toleranceMinutes || 10);
        if (firstInMins > limitMinutes) isLate = true;
    }

    // Anomaly Logic (Missing punches)
    if (dateStr < todayStr && dayAttendance.length % 2 !== 0) {
        isAnomaly = true;
    }

    // Absence Logic
    if (dateStr < todayStr && isWorkDay && dayAttendance.length === 0 && !justification) {
        isAbsent = true;
    }

    return { 
        standardHours, overtime, 
        isLate, isAnomaly, isAbsent,
        firstIn, lunchOut, lunchIn, lastOut,
        firstInId, lunchOutId, lunchInId, lastOutId,
        records: dayAttendance, justification 
    };
  };

  const getPayrollData = () => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let totalWorked = 0;
         let totalOvertime = 0;
         let ferieCount = 0; // days
         let malattiaCount = 0; // days
         let permessoHours = 0;
         let lateCount = 0;
         let absenceCount = 0;
         let daysWorked = 0;
         
         for(let d=1; d<=daysInMonth; d++) {
             const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
             const stats = calculateDailyStats(emp.id, dateStr);
             
             totalWorked += stats.standardHours;
             totalOvertime += stats.overtime;
             
             if (stats.standardHours > 0) daysWorked++;
             if (stats.isLate) lateCount++;
             if (stats.isAbsent) absenceCount++;

             if (stats.justification) {
                 if (stats.justification.type === JustificationType.FERIE) ferieCount++;
                 if (stats.justification.type === JustificationType.MALATTIA) malattiaCount++;
                 if (stats.justification.type === JustificationType.PERMESSO) permessoHours += (stats.justification.hoursOffset || 0);
             }
         }
         return { ...emp, totalWorked, totalOvertime, ferieCount, malattiaCount, permessoHours, lateCount, absenceCount, daysWorked };
     });
  };

  const handleExportTimecard = (empId: string) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const rows = [];

      for(let d=1; d<=daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const stats = calculateDailyStats(empId, dateStr);
          
          rows.push({
              'Data': dateStr,
              'Giorno': new Date(dateStr).toLocaleDateString('it-IT', {weekday: 'short'}),
              'Entrata 1': stats.firstIn || '',
              'Uscita 1': stats.lunchOut || '',
              'Entrata 2': stats.lunchIn || '',
              'Uscita 2': stats.lastOut || '',
              'Ore Ordinarie': stats.standardHours.toFixed(2),
              'Straordinari': stats.overtime.toFixed(2),
              'Permessi': stats.justification?.type === JustificationType.PERMESSO ? stats.justification.hoursOffset : '',
              'Ferie': stats.justification?.type === JustificationType.FERIE ? '1' : '',
              'Malattia': stats.justification?.type === JustificationType.MALATTIA ? '1' : '',
              'Note': stats.isLate ? 'Ritardo' : (stats.isAbsent ? 'Assenza' : '')
          });
      }

      // Totals Row
      const totals = rows.reduce((acc, row) => ({
          std: acc.std + parseFloat(row['Ore Ordinarie'] || '0'),
          over: acc.over + parseFloat(row['Straordinari'] || '0'),
      }), {std: 0, over: 0});

      rows.push({});
      rows.push({ 'Data': 'TOTALE', 'Ore Ordinarie': totals.std.toFixed(2), 'Straordinari': totals.over.toFixed(2) });

      const worksheet = utils.json_to_sheet(rows);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Cartellino");
      writeFile(workbook, `Cartellino_${emp.name}_${selectedMonth}.xlsx`);
  }

  const handleExportSummary = () => {
      const data = payrollStats.map(p => ({
          'Dipendente': p.name,
          'Reparto': p.department,
          'Mese': selectedMonth,
          'Giorni Presenza': p.daysWorked,
          'Ore Ordinarie': p.totalWorked.toFixed(2),
          'Straordinari': p.totalOvertime.toFixed(2),
          'Giorni Ferie': p.ferieCount,
          'Giorni Malattia': p.malattiaCount,
          'Ore Permesso': p.permessoHours,
          'Ritardi': p.lateCount,
          'Assenze Ingiustificate': p.absenceCount
      }));
      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Riepilogo_Paghe");
      writeFile(workbook, `Riepilogo_Paghe_${selectedMonth}.xlsx`);
  };

  const setJustificationForDay = (empId: string, dateStr: string, type: JustificationType, hours: number = 0) => {
      const newJust: DayJustification = {
          id: `${empId}-${dateStr}`,
          employeeId: empId,
          date: dateStr,
          type,
          hoursOffset: hours
      };
      onSaveJustification(newJust);
  };

  const handleTimeChange = (
      empId: string, 
      dateStr: string, 
      newTime: string, 
      existingId: string | null, 
      type: 'ENTRATA' | 'USCITA'
  ) => {
      if (!newTime) {
          if (existingId) onDeleteAttendance(existingId);
          return;
      }
      
      const record: AttendanceRecord = {
          id: existingId || Date.now().toString() + Math.random().toString().slice(2,5),
          employeeId: empId,
          type: type,
          timestamp: `${dateStr}T${newTime}:00`
      };
      onSaveAttendance(record);
  }

  const handleSaveJobForm = () => {
    if (!isEditingJob?.code) return;
    const newJob = { ...isEditingJob } as Job;
    newJob.id = newJob.id || Date.now().toString();
    newJob.status = newJob.status || JobStatus.PLANNED;
    newJob.priority = newJob.priority || 3;
    onSaveJob(newJob);
    setIsEditingJob(null);
  };

  const handleSaveEmpForm = () => {
    if (!isEditingEmp?.name) return;
    const newEmp = { ...isEditingEmp } as Employee;
    newEmp.id = newEmp.id || Date.now().toString();
    
    // Set defaults if empty
    if (!newEmp.scheduleStartMorning) newEmp.scheduleStartMorning = "08:30";
    if (!newEmp.scheduleEndMorning) newEmp.scheduleEndMorning = "12:30";
    if (!newEmp.scheduleStartAfternoon) newEmp.scheduleStartAfternoon = "13:30";
    if (!newEmp.scheduleEndAfternoon) newEmp.scheduleEndAfternoon = "17:30";
    if (!newEmp.toleranceMinutes) newEmp.toleranceMinutes = 10;
    if (!newEmp.workDays) newEmp.workDays = [1,2,3,4,5]; // Mon-Fri default

    onSaveEmployee(newEmp);
    setIsEditingEmp(null);
  }

  const handleBulkStatusChange = (status: JobStatus) => {
      selectedJobIds.forEach(id => {
          const job = jobs.find(j => j.id === id);
          if (job) onSaveJob({ ...job, status });
      });
      setSelectedJobIds(new Set()); // clear selection
  }

  const handleUpdatePhase = (log: WorkLog) => {
      onUpdateLog({ ...log, phase: tempPhase });
      setEditingLogId(null);
      setTempPhase('');
  }

  const togglePermission = (role: string, tabId: string) => {
      const currentTabs = tempPermissions[role] || [];
      let newTabs;
      if (currentTabs.includes(tabId)) {
          newTabs = currentTabs.filter(t => t !== tabId);
      } else {
          newTabs = [...currentTabs, tabId];
      }
      setTempPermissions({ ...tempPermissions, [role]: newTabs });
  }

  const savePermissions = () => {
      onSavePermissions(tempPermissions);
      alert("Permessi aggiornati con successo!");
  }

  // Payroll stats calculation based on updated logic
  const payrollStats = useMemo(() => getPayrollData(), [employees, attendance, justifications, selectedMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:max-w-none bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
             {currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING ? 'Pannello Amministrazione' : 'Dashboard Aziendale'}
          </h1>
          <p className="text-slate-500">
              {(currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING) && 'Gestione Presenze e Paghe'}
              {currentUserRole === Role.DIRECTION && 'Business Intelligence Completa'}
              {currentUserRole === Role.SYSTEM_ADMIN && 'Pannello di Controllo Sistemista'}
              {currentUserRole !== Role.SYSTEM_ADMIN && currentUserRole !== Role.DIRECTION && currentUserRole !== Role.ADMIN && 'Gestione Commesse e Clienti'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 print:hidden bg-white px-6 rounded-t-xl">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab.icon && <tab.icon size={16}/>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        
        {/* ... (Previous Tab Contents OVERVIEW, JOBS, HR, AI remain similar structure) ... */}
        
        {/* REUSE PREVIOUS OVERVIEW / HR / AI Sections - Just pasting the updates to the Manage Modal below within context */}
        
        {activeTab === 'OVERVIEW' && (
             <>
            {/* Report Date Filter (For Print & Display) */}
            <div className="flex justify-between items-center mb-6 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    <Filter size={18} />
                    <span className="font-semibold text-sm">Filtra Report per Data:</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded border border-slate-200">
                        <Calendar size={14} className="text-slate-400"/>
                        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-32"/>
                        <span className="text-slate-300">-</span>
                        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-32"/>
                        {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 print:hidden">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Commesse Attive</p>
                            <h3 className="text-2xl font-bold text-slate-800">{jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length}</h3>
                        </div>
                        <Briefcase className="text-blue-500 bg-blue-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                {/* Packaging Stat */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">In Imballaggio</p>
                            <h3 className="text-2xl font-bold text-orange-600">{packagingJobs.length}</h3>
                        </div>
                        <Package className="text-orange-500 bg-orange-50 p-2 rounded-lg" size={40} />
                    </div>
                    {packagingJobs.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 border-t pt-2 max-h-20 overflow-y-auto">
                            {packagingJobs.map(j => <div key={j.id} className="truncate">• {j.code}</div>)}
                        </div>
                    )}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Valore Produzione</p>
                            <h3 className="text-2xl font-bold text-slate-800">€ {jobStats.reduce((acc, j) => acc + j.budgetValue, 0).toLocaleString()}</h3>
                        </div>
                        <TrendingUp className="text-green-500 bg-green-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Commesse a Rischio</p>
                            <h3 className="text-2xl font-bold text-red-600">{jobStats.filter(j => j.profitMargin < 0 || j.isOverBudget).length}</h3>
                        </div>
                        <AlertTriangle className="text-red-500 bg-red-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:grid-cols-2 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-6 text-slate-700">Ore Lavorate per Cliente</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={clientData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-6 text-slate-700">Stato Avanzamento Commesse</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Advanced Reports Section (Restored & Expanded) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:border-none print:shadow-none print:p-0 print-section">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <h3 className="text-xl font-bold text-slate-800">Report Aziendale Dettagliato</h3>
                    <button onClick={() => window.print()} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 border p-2 rounded hover:bg-slate-50">
                        <Printer size={18} /> Stampa Report
                    </button>
                </div>
                {/* Print Only Header */}
                <div className="hidden print:block mb-8 border-b pb-4">
                    <h1 className="text-2xl font-bold">Report Aziendale Integrato</h1>
                    <p className="text-slate-500">
                        Data Stampa: {new Date().toLocaleDateString()} 
                        {filterStartDate ? ` | Filtro: ${new Date(filterStartDate).toLocaleDateString()} - ${filterEndDate ? new Date(filterEndDate).toLocaleDateString() : 'Oggi'}` : ''}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                    {/* 1. Top Clients */}
                    <div className="border rounded-lg p-4 bg-slate-50 print:bg-white print:border-slate-300">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <TrendingUp size={18} className="text-green-600"/> Top Clienti (Fatturato)
                        </h4>
                        <ul className="space-y-2 text-sm">
                            {topClientsByRevenue.map(([client, value], idx) => (
                                <li key={client} className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="font-medium text-slate-700">{idx+1}. {client}</span>
                                    <span className="font-bold text-green-700">€ {value.toLocaleString()}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* 2. Over Budget */}
                    <div className="border rounded-lg p-4 bg-red-50 print:bg-white print:border-red-200">
                        <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-600"/> Sforamento Budget
                        </h4>
                        <ul className="space-y-2 text-sm">
                            {overBudgetClients.map(([client, stats], idx) => (
                                <li key={client} className="flex justify-between border-b border-red-100 pb-1">
                                    <span className="font-medium text-red-900">{client}</span>
                                    <span className="font-bold text-red-700">+{stats.over.toFixed(0)} h</span>
                                </li>
                            ))}
                            {overBudgetClients.length === 0 && <li className="text-slate-500 italic">Nessun cliente fuori budget.</li>}
                        </ul>
                    </div>

                    {/* 3. Phase Leaders */}
                    <div className="border rounded-lg p-4 bg-blue-50 print:bg-white print:border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <Users size={18} className="text-blue-600"/> Efficienza per Fase
                        </h4>
                        <div className="space-y-2 text-sm max-h-48 overflow-y-auto print:max-h-none print:overflow-visible">
                            {phaseEfficiency.map((stat) => (
                                <div key={stat.phase} className="flex justify-between border-b border-blue-100 pb-1">
                                    <span className="font-medium text-blue-900 text-xs uppercase">{stat.phase}</span>
                                    <span className="text-slate-600 text-xs text-right">
                                        <span className="font-bold">{stat.champion}</span> ({stat.hours}h)
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Upcoming Deadlines (NEW) */}
                    <div className="border rounded-lg p-4 bg-orange-50 print:bg-white print:border-orange-200">
                         <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                            <Timer size={18} className="text-orange-600"/> Scadenze Imminenti
                        </h4>
                         <ul className="space-y-2 text-sm">
                            {expiringJobs.map(j => (
                                <li key={j.id} className="flex justify-between border-b border-orange-100 pb-1">
                                    <span className="font-medium text-orange-900 truncate max-w-[120px]">{j.code}</span>
                                    <span className="font-bold text-orange-700">{new Date(j.deadline).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'})}</span>
                                </li>
                            ))}
                            {expiringJobs.length === 0 && <li className="text-slate-500 italic">Nessuna scadenza prossima.</li>}
                        </ul>
                    </div>

                    {/* 5. Top Operators (NEW) */}
                    <div className="border rounded-lg p-4 bg-purple-50 print:bg-white print:border-purple-200">
                        <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                            <Star size={18} className="text-purple-600"/> Top Operatori (Ore)
                        </h4>
                         <ul className="space-y-2 text-sm">
                            {activeOperators.map((op, idx) => (
                                <li key={idx} className="flex justify-between border-b border-purple-100 pb-1">
                                    <span className="font-medium text-purple-900">{op.name}</span>
                                    <span className="font-bold text-purple-700">{op.hours.toFixed(1)} h</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* 6. Recent Activity Log (NEW) */}
                     <div className="border rounded-lg p-4 bg-gray-50 print:bg-white print:border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Clock size={18} className="text-gray-600"/> Ultime Attività
                        </h4>
                         <ul className="space-y-2 text-sm">
                            {recentActivities.map((log, idx) => (
                                <li key={idx} className="flex justify-between border-b border-gray-200 pb-1">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900 text-xs">{log.jobCode}</span>
                                        <span className="text-[10px] text-gray-500">{log.empName}</span>
                                    </div>
                                    <span className="font-bold text-gray-700 text-xs">{log.phase}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>
            </div>
            </>
        )}
        
        {/* JOBS SECTION, HR SECTION, AI SECTION are reused from previous state, omitted for brevity but presumed present */}
        {activeTab === 'JOBS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="font-bold text-slate-700">Analisi Dettagliata Commesse</h3>
                        <div className="flex items-center gap-2 text-sm bg-white p-1 rounded border border-slate-200">
                            <Calendar size={14} className="text-slate-400 ml-1"/>
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                            <span className="text-slate-300">-</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                            {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                        </div>

                        {selectedJobIds.size > 0 && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded shadow-sm border border-slate-200 animate-in fade-in slide-in-from-left-4">
                                <span className="text-xs font-bold text-blue-600">{selectedJobIds.size} selezionati</span>
                                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                                <button onClick={() => handleBulkStatusChange(JobStatus.COMPLETED)} className="text-xs hover:text-green-600 font-medium">Completata</button>
                                <button onClick={() => handleBulkStatusChange(JobStatus.IN_PROGRESS)} className="text-xs hover:text-blue-600 font-medium">In Corso</button>
                                <button onClick={() => handleBulkStatusChange(JobStatus.ON_HOLD)} className="text-xs hover:text-orange-600 font-medium">Sospesa</button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {isGodMode && (
                            <button onClick={() => handleExcelExportJobs(sortedJobStats)} className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-100 border border-green-200 transition">
                                <FileSpreadsheet size={16}/> Esporta Excel
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300"
                                        onChange={(e) => {
                                            if(e.target.checked) setSelectedJobIds(new Set(sortedJobStats.map(j => j.id)));
                                            else setSelectedJobIds(new Set());
                                        }}
                                        checked={selectedJobIds.size === sortedJobStats.length && sortedJobStats.length > 0}
                                    />
                                </th>
                                <th onClick={() => requestSort('code', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Commessa {renderSortArrow('code', jobSort)}</th>
                                <th onClick={() => requestSort('clientName', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Cliente {renderSortArrow('clientName', jobSort)}</th>
                                <th onClick={() => requestSort('totalHoursUsed', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Ore {renderSortArrow('totalHoursUsed', jobSort)}</th>
                                <th onClick={() => requestSort('profitMargin', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Margine {renderSortArrow('profitMargin', jobSort)}</th>
                                <th onClick={() => requestSort('deadline', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Scadenza {renderSortArrow('deadline', jobSort)}</th>
                                <th onClick={() => requestSort('status', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Stato {renderSortArrow('status', jobSort)}</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedJobStats.map((job) => (
                                <tr key={job.id} className={`hover:bg-slate-50 ${selectedJobIds.has(job.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300"
                                            checked={selectedJobIds.has(job.id)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedJobIds);
                                                if (e.target.checked) newSet.add(job.id);
                                                else newSet.delete(job.id);
                                                setSelectedJobIds(newSet);
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)}>{job.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{job.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-slate-200 rounded-full h-2.5">
                                                <div 
                                                    className={`h-2.5 rounded-full ${job.isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${Math.min((job.totalHoursUsed / job.budgetHours) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span>{job.totalHoursUsed.toFixed(1)}/{job.budgetHours}</span>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${job.profitMargin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        € {job.profitMargin.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {job.deadline ? new Date(job.deadline).toLocaleDateString('it-IT') : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${job.status === JobStatus.IN_PROGRESS ? 'bg-green-100 text-green-800' : 
                                            job.status === JobStatus.PLANNED ? 'bg-blue-100 text-blue-800' : 
                                            job.status === JobStatus.COMPLETED ? 'bg-slate-800 text-white' :
                                            'bg-slate-100 text-slate-800'}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Info size={16} className="text-slate-400 hover:text-blue-500 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* JOB DETAILS MODAL */}
                {selectedJobForAnalysis && (
                     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        <Briefcase className="text-blue-600" />
                                        Dettaglio Commessa: {jobs.find(j => j.id === selectedJobForAnalysis)?.code}
                                    </h3>
                                    <p className="text-slate-500">{jobs.find(j => j.id === selectedJobForAnalysis)?.clientName} - {jobs.find(j => j.id === selectedJobForAnalysis)?.description}</p>
                                </div>
                                <button onClick={() => setSelectedJobForAnalysis(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                    <X size={24} className="text-slate-500"/>
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-8">
                                {/* Operator Summary */}
                                <div>
                                    <h4 className="text-lg font-semibold mb-3 text-slate-700">Riepilogo per Operatore</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {Object.entries(
                                            logs.filter(l => l.jobId === selectedJobForAnalysis)
                                            .reduce((acc, log) => {
                                                const empName = employees.find(e => e.id === log.employeeId)?.name || 'Sconosciuto';
                                                acc[empName] = (acc[empName] || 0) + log.hours;
                                                return acc;
                                            }, {} as {[key:string]: number})
                                        ).map(([name, hours]) => (
                                            <div key={name} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                <div className="text-sm text-slate-500 font-medium">Operatore</div>
                                                <div className="font-bold text-slate-800 truncate">{name}</div>
                                                <div className="text-2xl font-bold text-blue-600 mt-1">{(hours as number).toFixed(1)} <span className="text-sm font-normal text-slate-500">h</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Detailed Logs Table with Phase Editing */}
                                <div>
                                    <h4 className="text-lg font-semibold mb-3 text-slate-700">Cronologia Lavori</h4>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                                                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Operatore</th><th className="px-4 py-3">Fase</th><th className="px-4 py-3">Ore</th><th className="px-4 py-3">Note</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {logs.filter(l => l.jobId === selectedJobForAnalysis).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(log => (
                                                    <tr key={log.id} className="hover:bg-slate-50 group">
                                                        <td className="px-4 py-3 text-slate-600">{new Date(log.date).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 font-medium">{employees.find(e => e.id === log.employeeId)?.name}</td>
                                                        <td className="px-4 py-3">
                                                            {editingLogId === log.id ? (
                                                                <select autoFocus value={tempPhase} onChange={(e) => setTempPhase(e.target.value)} onBlur={() => handleUpdatePhase(log)} className="border rounded p-1 text-xs">
                                                                    {['Generica (Import)', ...settings.workPhases].map(p => <option key={p} value={p}>{p}</option>)}
                                                                </select>
                                                            ) : (
                                                                <button onClick={() => { setEditingLogId(log.id); setTempPhase(log.phase); }} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 hover:bg-blue-100 flex items-center gap-1">{log.phase} <Edit2 size={10} className="opacity-0 group-hover:opacity-50"/></button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold">{log.hours}</td>
                                                        <td className="px-4 py-3 text-slate-500 italic truncate max-w-xs">{log.notes}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                             <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                                <button onClick={() => setSelectedJobForAnalysis(null)} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition">Chiudi Dettaglio</button>
                            </div>
                        </div>
                     </div>
                )}
            </div>
        )}

        {/* HR Section using REVISED CALCULATIONS */}
        {activeTab === 'HR' && (
             <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="text-blue-600"/>
                    <label className="text-sm font-medium text-slate-700">Mese di Competenza:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-2 py-1"/>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                         <h3 className="font-bold text-slate-700">Riepilogo Presenze Mensile</h3>
                         <button onClick={handleExportSummary} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition"><FileSpreadsheet size={16}/> Export Riepilogo Paghe</button>
                    </div>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dipendente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Giorni Pres.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ore Ordinarie</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Straordinari</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assenze/Ferie/Mal.</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {payrollStats.map(stat => (
                                <tr key={stat.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {stat.name}
                                        <div className="text-xs text-slate-400">{stat.role}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{stat.daysWorked}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{stat.totalWorked.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-slate-500">{stat.totalOvertime > 0 ? <span className="text-orange-600 font-bold">{stat.totalOvertime.toFixed(2)}</span> : '-'}</td>
                                    <td className="px-6 py-4 text-xs space-y-1">
                                        {stat.absenceCount > 0 && <div className="text-red-600 font-bold">Assenze Ing.: {stat.absenceCount} gg</div>}
                                        {stat.ferieCount > 0 && <div className="text-blue-600">Ferie: {stat.ferieCount} gg</div>}
                                        {stat.malattiaCount > 0 && <div className="text-purple-600">Malattia: {stat.malattiaCount} gg</div>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setSelectedEmpForDetail(stat.id)} className="bg-slate-100 hover:bg-blue-50 text-blue-600 px-3 py-1 rounded border border-slate-200 text-sm font-medium transition">
                                            Gestisci / Cartellino
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* DETTAGLIO CARTELLINO DIPENDENTE (MODAL) */}
                {selectedEmpForDetail && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl">
                            {/* Header Modal */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800">
                                        {employees.find(e => e.id === selectedEmpForDetail)?.name}
                                    </h3>
                                    <p className="text-slate-500 text-sm">Cartellino Presenze: {new Date(selectedMonth).toLocaleDateString('it-IT', {month:'long', year:'numeric'})}</p>
                                </div>
                                <div className="flex gap-2">
                                     <button onClick={() => handleExportTimecard(selectedEmpForDetail)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                                        <FileSpreadsheet size={18}/> Scarica Excel
                                    </button>
                                    <button onClick={() => setSelectedEmpForDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                        <X size={24} className="text-slate-500"/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Body Modal (Scrollable) */}
                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 border-b border-slate-300">
                                            <th className="p-2 border border-slate-200 text-left">Data</th>
                                            <th className="p-2 border border-slate-200 text-center w-20">Entrata</th>
                                            <th className="p-2 border border-slate-200 text-center w-20">Uscita (P)</th>
                                            <th className="p-2 border border-slate-200 text-center w-20">Entrata (P)</th>
                                            <th className="p-2 border border-slate-200 text-center w-20">Uscita</th>
                                            <th className="p-2 border border-slate-200 text-center w-20 bg-blue-50 font-bold text-blue-800">Ore Ord.</th>
                                            <th className="p-2 border border-slate-200 text-center w-20 bg-orange-50 font-bold text-orange-800">Straord.</th>
                                            <th className="p-2 border border-slate-200 text-center w-24">Giustificativo</th>
                                            <th className="p-2 border border-slate-200 text-center w-16">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()}, (_, i) => i + 1).map(day => {
                                            const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                                            const stats = calculateDailyStats(selectedEmpForDetail, dateStr);
                                            const dateObj = new Date(dateStr);
                                            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                            
                                            // Row Styling
                                            let rowClass = "hover:bg-slate-50";
                                            if (isWeekend) rowClass = "bg-slate-50 text-slate-400";
                                            if (stats.isAbsent) rowClass = "bg-red-50"; 
                                            if (stats.isAnomaly) rowClass = "bg-orange-50";

                                            return (
                                                <tr key={day} className={`border-b border-slate-200 ${rowClass}`}>
                                                    <td className="p-2 border border-slate-200">
                                                        <div className="font-bold">{String(day).padStart(2,'0')}</div>
                                                        <div className="text-xs uppercase">{dateObj.toLocaleDateString('it-IT', {weekday:'short'})}</div>
                                                    </td>
                                                    <td className={`p-1 border border-slate-200 text-center ${stats.isLate ? 'text-orange-600 font-bold' : ''}`}>
                                                        <input 
                                                            type="time" 
                                                            className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs"
                                                            value={stats.firstIn || ''}
                                                            onChange={(e) => handleTimeChange(selectedEmpForDetail, dateStr, e.target.value, stats.firstInId, 'ENTRATA')}
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 text-center">
                                                        <input 
                                                            type="time" 
                                                            className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs"
                                                            value={stats.lunchOut || ''}
                                                            onChange={(e) => handleTimeChange(selectedEmpForDetail, dateStr, e.target.value, stats.lunchOutId, 'USCITA')}
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 text-center">
                                                        <input 
                                                            type="time" 
                                                            className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs"
                                                            value={stats.lunchIn || ''}
                                                            onChange={(e) => handleTimeChange(selectedEmpForDetail, dateStr, e.target.value, stats.lunchInId, 'ENTRATA')}
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 text-center">
                                                        <input 
                                                            type="time" 
                                                            className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs"
                                                            value={stats.lastOut || ''}
                                                            onChange={(e) => handleTimeChange(selectedEmpForDetail, dateStr, e.target.value, stats.lastOutId, 'USCITA')}
                                                        />
                                                    </td>
                                                    <td className="p-2 border border-slate-200 text-center font-bold">{stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '-'}</td>
                                                    <td className="p-2 border border-slate-200 text-center text-orange-600 font-bold">{stats.overtime > 0 ? stats.overtime.toFixed(2) : ''}</td>
                                                    <td className="p-2 border border-slate-200 text-center">
                                                        <select 
                                                            className={`w-full text-xs p-1 border rounded ${stats.justification ? 'bg-blue-100 font-bold text-blue-800 border-blue-300' : 'bg-white'}`}
                                                            value={stats.justification?.type || ''}
                                                            onChange={(e) => {
                                                                if (e.target.value) setJustificationForDay(selectedEmpForDetail, dateStr, e.target.value as JustificationType);
                                                                else onSaveJustification({ ...stats.justification!, id: `${selectedEmpForDetail}-${dateStr}`, type: JustificationType.STANDARD }); // Hack to clear
                                                            }}
                                                        >
                                                            <option value="">-</option>
                                                            <option value={JustificationType.FERIE}>FERIE</option>
                                                            <option value={JustificationType.MALATTIA}>MALATTIA</option>
                                                            <option value={JustificationType.PERMESSO}>PERMESSO</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2 border border-slate-200 text-center text-xs">
                                                        {stats.isLate && <span className="block text-orange-600 font-bold">RITARDO</span>}
                                                        {stats.isAbsent && <span className="block text-red-600 font-bold">ASSENZA</span>}
                                                        {stats.isAnomaly && <span className="block text-orange-500 font-bold">ANOMALIA</span>}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {/* AI Section */}
        {activeTab === 'AI' && (
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 {!settings.geminiApiKey ? (
                     <div className="flex flex-col items-center justify-center py-12 text-center">
                         <div className="bg-orange-100 p-4 rounded-full mb-4"><Key className="text-orange-500" size={32}/></div>
                         <h3 className="text-xl font-bold text-slate-800 mb-2">Configurazione Richiesta</h3>
                         <p className="text-slate-500 max-w-md mb-6">Per utilizzare l'analista AI, è necessario inserire una API Key di Google Gemini valida nelle impostazioni.</p>
                         <button onClick={() => {if(isSystem) setActiveTab('CONFIG')}} className="text-blue-600 font-bold hover:underline">Vai alla Configurazione</button>
                     </div>
                 ) : (
                 <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg"><BrainCircuit size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Analista Aziendale IA</h2>
                            <p className="text-slate-500 text-sm">Analisi predittiva e insight sui dati aziendali</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                        {customPrompts.map((prompt) => (
                            <div key={prompt.id} className="relative group">
                                {editingPromptId === prompt.id ? (
                                    <div className="p-3 bg-white border-2 border-blue-500 rounded-lg shadow-lg z-10 absolute top-0 left-0 w-full min-w-[200px]">
                                        <input type="text" className="w-full text-xs font-bold mb-2 border-b outline-none" value={tempPromptLabel} onChange={(e) => setTempPromptLabel(e.target.value)} placeholder="Etichetta"/>
                                        <textarea className="w-full text-xs p-1 border rounded resize-none outline-none mb-2" rows={3} value={tempPromptText} onChange={(e) => setTempPromptText(e.target.value)} placeholder="Domanda per IA..."/>
                                        <div className="flex justify-end gap-1"><button onClick={() => setEditingPromptId(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X size={14}/></button><button onClick={() => handleSavePrompt(prompt.id)} className="p-1 hover:bg-green-100 text-green-600 rounded"><Save size={14}/></button></div>
                                    </div>
                                ) : (
                                    <button onClick={() => handleAskAI(prompt.prompt)} className="w-full p-3 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-lg text-left transition relative h-full flex flex-col justify-between group-hover:shadow-md">
                                        <span className="text-sm font-semibold text-slate-700 block mb-1">{prompt.label}</span>
                                        <span className="text-xs text-slate-400 line-clamp-2">{prompt.prompt}</span>
                                        <div onClick={(e) => { e.stopPropagation(); setEditingPromptId(prompt.id); setTempPromptLabel(prompt.label); setTempPromptText(prompt.prompt); }} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition"><Pencil size={12} /></div>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 min-h-[200px] mb-4 shadow-inner">
                        {aiResponse ? (
                            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                        ) : (
                            <div className="text-center text-slate-400 py-16 flex flex-col items-center gap-3">
                                {isLoadingAi ? <Loader2 className="animate-spin text-blue-500" size={32}/> : <div className="flex flex-col items-center"><BrainCircuit size={48} className="text-slate-300 mb-2"/><span>Seleziona una domanda rapida o scrivi la tua richiesta qui sotto.</span></div>}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 relative">
                        <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Fai una domanda libera sui tuoi dati..." className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none pl-12 shadow-sm"/>
                        <div className="absolute left-4 top-3.5 text-slate-400"><Info size={20}/></div>
                        <button onClick={() => handleAskAI()} disabled={!aiPrompt || isLoadingAi} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-sm">{isLoadingAi ? 'Analisi...' : 'Chiedi'}</button>
                    </div>
                 </>
                 )}
            </div>
        )}

        {activeTab === 'MANAGE' && (
            <div className="space-y-6">
                <div className="flex gap-4 mb-6">
                    <button onClick={() => setManageSubTab('JOBS')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'JOBS' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Commesse</button>
                    {(canManageEmployees || isSystem) && <button onClick={() => setManageSubTab('EMPLOYEES')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'EMPLOYEES' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Dipendenti</button>}
                </div>

                {manageSubTab === 'JOBS' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        {/* Header controls same as before */}
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Elenco Commesse</h2>
                            <div className="flex gap-2">
                              <input type="file" accept=".xlsx, .xls, .xml" onChange={handleExcelImport} className="hidden" ref={fileInputRef} />
                              {(isGodMode) && <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"><FileSpreadsheet size={18} /> Importa/Aggiorna</button>}
                              {(isGodMode) && <button onClick={() => handleExcelExportJobs(sortedManageJobs)} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"><Download size={18} /> Export</button>}
                              {(isSystem) && <button onClick={handleResetJobs} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"><Eraser size={18} /> Svuota Archivio Commesse</button>}
                              <button onClick={() => setIsEditingJob({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuova</button>
                            </div>
                        </div>
                        
                        {/* New Job Modal with Notes */}
                        {isEditingJob && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingJob.id ? 'Modifica Commessa' : 'Nuova Commessa'}</h3><button onClick={() => setIsEditingJob(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Codice</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.code || ''} onChange={e => setIsEditingJob({...isEditingJob, code: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Cliente</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.clientName || ''} onChange={e => setIsEditingJob({...isEditingJob, clientName: e.target.value})} /></div>
                                        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700">Descrizione</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.description || ''} onChange={e => setIsEditingJob({...isEditingJob, description: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Budget Ore</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetHours || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetHours: parseFloat(e.target.value)})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Valore (€)</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetValue || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetValue: parseFloat(e.target.value)})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Scadenza</label><input type="date" className="w-full border p-2 rounded" value={isEditingJob.deadline || ''} onChange={e => setIsEditingJob({...isEditingJob, deadline: e.target.value})} /></div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Priorità</label>
                                            <div className="flex gap-1 mt-2">
                                                {[1,2,3,4,5].map(star => (
                                                    <Star 
                                                        key={star} 
                                                        size={24} 
                                                        className={`cursor-pointer ${star <= (isEditingJob.priority || 3) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} 
                                                        onClick={() => setIsEditingJob({...isEditingJob, priority: star})}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Assegna a Operatore</label>
                                            <select 
                                                className="w-full border p-2 rounded" 
                                                value={isEditingJob.suggestedOperatorId || ''} 
                                                onChange={e => setIsEditingJob({...isEditingJob, suggestedOperatorId: e.target.value})}
                                            >
                                                <option value="">Nessuno</option>
                                                {employees.filter(e => e.role === Role.WORKSHOP).map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Note Interne</label>
                                            <textarea 
                                                className="w-full border p-2 rounded resize-y min-h-[80px]" 
                                                value={isEditingJob.notes || ''} 
                                                onChange={e => setIsEditingJob({...isEditingJob, notes: e.target.value})}
                                                placeholder="Eventuali note tecniche o amministrative..."
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2">
                                        <button onClick={() => setIsEditingJob(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annulla</button>
                                        <button onClick={handleSaveJobForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button>
                                    </div>
                                </div>
                            </div>
                        )}
                         
                        <div className="overflow-x-auto">
                           <table className="min-w-full divide-y divide-slate-200">
                               <thead className="bg-slate-50">
                                   <tr>
                                       <th onClick={() => requestSort('code', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Codice {renderSortArrow('code', manageJobSort)}</th>
                                       <th onClick={() => requestSort('clientName', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Cliente {renderSortArrow('clientName', manageJobSort)}</th>
                                       <th onClick={() => requestSort('priority', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Priorità {renderSortArrow('priority', manageJobSort)}</th>
                                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Budget/Valore</th>
                                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stato</th>
                                       <th className="px-6 py-3"></th>
                                   </tr>
                               </thead>
                               <tbody className="bg-white divide-y divide-slate-200">
                                   {sortedManageJobs.map((job) => (
                                       <tr key={job.id} className="hover:bg-slate-50">
                                           <td className="px-6 py-4 font-medium text-slate-900">{job.code}</td>
                                           <td className="px-6 py-4 text-slate-500">{job.clientName}</td>
                                           <td className="px-6 py-4 text-slate-500 flex gap-1">
                                               {Array.from({length: job.priority || 3}).map((_, i) => <Star key={i} size={12} className="fill-orange-400 text-orange-400"/>)}
                                           </td>
                                           <td className="px-6 py-4 text-slate-500">{job.budgetHours}h / €{job.budgetValue}</td>
                                           <td className="px-6 py-4"><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{job.status}</span></td>
                                           <td className="px-6 py-4"><button onClick={() => setIsEditingJob(job)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button></td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                        </div>
                    </div>
                )}

                {/* EMPLOYEES MANAGMENT (Reused from previous, just placeholder here to close the structure) */}
                {manageSubTab === 'EMPLOYEES' && (canManageEmployees || isSystem) && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Elenco Dipendenti</h2>
                            <button onClick={() => setIsEditingEmp({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuovo Dipendente</button>
                        </div>

                         {isEditingEmp && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingEmp.id ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h3><button onClick={() => setIsEditingEmp(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Nome e Cognome</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.name || ''} onChange={e => setIsEditingEmp({...isEditingEmp, name: e.target.value})} /></div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Ruolo</label>
                                            <select className="w-full border p-2 rounded" value={isEditingEmp.role || Role.EMPLOYEE} onChange={e => setIsEditingEmp({...isEditingEmp, role: e.target.value as Role})}>
                                                {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="block text-sm font-medium text-slate-700">Reparto</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.department || ''} onChange={e => setIsEditingEmp({...isEditingEmp, department: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Costo Orario (€)</label><input type="number" className="w-full border p-2 rounded" value={isEditingEmp.hourlyRate || ''} onChange={e => setIsEditingEmp({...isEditingEmp, hourlyRate: parseFloat(e.target.value)})} /></div>
                                        
                                        {/* Security Codes */}
                                        <div className="border-t col-span-2 pt-4 mt-2 mb-2"><h4 className="font-bold text-slate-700 text-sm">Sicurezza Accessi</h4></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Codice NFC Badge</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.nfcCode || ''} onChange={e => setIsEditingEmp({...isEditingEmp, nfcCode: e.target.value})} placeholder="Es. NFC_123" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">PIN Accesso (4-6 cifre)</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.pin || ''} onChange={e => setIsEditingEmp({...isEditingEmp, pin: e.target.value})} placeholder="Es. 1234" /></div>

                                        {/* Scheduling Config */}
                                        <div className="border-t col-span-2 pt-4 mt-2 mb-2"><h4 className="font-bold text-slate-700 text-sm">Configurazione Orari</h4></div>
                                        
                                        <div><label className="block text-sm font-medium text-slate-700">Inizio Mattina</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleStartMorning || '08:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartMorning: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Fine Mattina</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleEndMorning || '12:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndMorning: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Inizio Pomeriggio</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleStartAfternoon || '13:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartAfternoon: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Fine Pomeriggio</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleEndAfternoon || '17:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndAfternoon: e.target.value})} /></div>
                                        
                                        <div><label className="block text-sm font-medium text-slate-700">Tolleranza Ritardo (min)</label><input type="number" className="w-full border p-2 rounded" value={isEditingEmp.toleranceMinutes || 10} onChange={e => setIsEditingEmp({...isEditingEmp, toleranceMinutes: parseInt(e.target.value)})} /></div>
                                        
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Giorni Lavorativi</label>
                                            <div className="flex gap-4 flex-wrap">
                                                {['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((dayName, idx) => (
                                                    <label key={idx} className="flex items-center gap-1 text-sm cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={(isEditingEmp.workDays || [1,2,3,4,5]).includes(idx)}
                                                            onChange={(e) => {
                                                                const currentDays = isEditingEmp.workDays || [1,2,3,4,5];
                                                                let newDays;
                                                                if(e.target.checked) newDays = [...currentDays, idx];
                                                                else newDays = currentDays.filter(d => d !== idx);
                                                                setIsEditingEmp({...isEditingEmp, workDays: newDays});
                                                            }}
                                                        />
                                                        {dayName}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                    <div className="mt-6 flex justify-end gap-2">
                                        <button onClick={() => setIsEditingEmp(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annulla</button>
                                        <button onClick={handleSaveEmpForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ruolo</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reparto</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Costo/h</th><th className="px-6 py-3"></th></tr></thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {employees.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{emp.name}</td>
                                            <td className="px-6 py-4 text-slate-500">{emp.role}</td>
                                            <td className="px-6 py-4 text-slate-500">{emp.department}</td>
                                            <td className="px-6 py-4 text-slate-500">€{emp.hourlyRate}</td>
                                            <td className="px-6 py-4"><button onClick={() => setIsEditingEmp(emp)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ... (CONFIG tab remains same) ... */}
        {activeTab === 'CONFIG' && isSystem && (
            <div className="space-y-6">
                {/* 1. Global Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="text-slate-600"/> Impostazioni Globali</h2>
                    
                    {/* NFC Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Scan size={20}/> Modalità Badge NFC</h3>
                            <p className="text-sm text-slate-500">Se attiva, nasconde la lista operatori e richiede la scansione del badge o PIN.</p>
                        </div>
                        <button 
                            onClick={() => onSaveSettings({ ...settings, nfcEnabled: !settings.nfcEnabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.nfcEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.nfcEnabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                        </button>
                    </div>

                    {/* API Key Config */}
                    <div className="mb-6">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2"><Key size={20}/> Gemini API Key</h3>
                         <p className="text-sm text-slate-500 mb-2">Inserisci la chiave API di Google Gemini per abilitare l'AI Analyst.</p>
                         <div className="flex gap-2">
                             <input 
                                type="password" 
                                value={settings.geminiApiKey || ''} 
                                onChange={(e) => onSaveSettings({...settings, geminiApiKey: e.target.value})}
                                placeholder="sk-..."
                                className="flex-1 border p-2 rounded"
                             />
                         </div>
                    </div>

                    {/* Phase Management */}
                    <div>
                        <h3 className="font-bold text-slate-800 mb-4">Gestione Fasi Lavorative</h3>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={newPhaseName} 
                                onChange={(e) => setNewPhaseName(e.target.value)}
                                placeholder="Nuova fase..."
                                className="border p-2 rounded flex-1"
                            />
                            <button onClick={addPhase} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Aggiungi</button>
                        </div>
                        <div className="space-y-2">
                            {settings.workPhases.map(phase => (
                                <div key={phase} className="flex justify-between items-center p-3 bg-white border rounded shadow-sm">
                                    <span>{phase}</span>
                                    <button onClick={() => removePhase(phase)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* 2. Role Permissions */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Permessi Ruoli</h2>
                        <button onClick={savePermissions} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Salva Permessi</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2">Ruolo</th>
                                    {allPossibleTabs.map(t => <th key={t.id} className="py-2 text-center text-xs">{t.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(Role).filter(r => r !== Role.SYSTEM_ADMIN).map(role => (
                                    <tr key={role} className="border-b hover:bg-slate-50">
                                        <td className="py-3 font-medium">{role}</td>
                                        {allPossibleTabs.map(tab => (
                                            <td key={tab.id} className="text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={(tempPermissions[role] || []).includes(tab.id)}
                                                    onChange={() => togglePermission(role, tab.id)}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Backup & Restore */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database className="text-slate-600"/> Backup e Ripristino
                    </h2>
                    <p className="text-slate-500 mb-6">Esporta un file JSON completo di tutti i dati (Commesse, Dipendenti, Log, Impostazioni) o ripristina un backup precedente.</p>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleBackupDownload}
                            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-900 transition"
                        >
                            <Download size={20}/> Scarica Backup Completo
                        </button>
                        <div className="relative">
                            <input 
                                type="file" 
                                ref={backupInputRef}
                                onChange={handleBackupRestore}
                                accept=".json"
                                className="hidden"
                            />
                            <button 
                                onClick={() => backupInputRef.current?.click()}
                                className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition"
                            >
                                <Upload size={20}/> Ripristina Backup
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
