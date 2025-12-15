
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser } from 'lucide-react';
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
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EC1D25'];

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

const AdminDashboard: React.FC<Props> = ({ jobs, logs, employees, attendance, justifications = [], customPrompts = [], permissions = {}, onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, onSavePermissions, onUpdateLog, currentUserRole, settings, onSaveSettings }) => {
  
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
    {id: 'AI', label: 'AI Analyst', icon: TrendingUp},
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

  // Date Filtering State
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


  const handleAskAI = async (promptText: string = aiPrompt) => {
    if (!promptText.trim()) return;
    setAiPrompt(promptText);
    setIsLoadingAi(true);
    setAiResponse('');
    const context = { jobs: filteredJobStats, logs, employees };
    const result = await analyzeBusinessData(promptText, context, settings.geminiApiKey || '');
    setAiResponse(result);
    setIsLoadingAi(false);
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
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws, { header: 1 }); // Array of arrays

          // Data collectors
          const jobsBatchMap = new Map<string, Job>();
          const empsBatchMap = new Map<string, Employee>();
          const logsBatchList: WorkLog[] = [];
          
          const codeToIdMap = new Map<string, string>(); // Maps "JOB-CODE" to "firebase-id"

          let jobsCreated = 0;
          let jobsUpdated = 0;
          let logsCreated = 0;
          
          let lastJobId: string | null = null;

          // Find header row
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
              
              if (!operatorRaw) continue; // Detail row must have operator

              // --- JOB HANDLING ---
              if (code) {
                  const cleanCode = String(code).trim();
                  
                  // 1. Try to find job in existing DB
                  let existingJob = jobs.find(j => j.code === cleanCode);
                  // 2. Or try to find in current batch map
                  if (!existingJob) {
                      // Check if we already created it in this loop pass
                      // We need to iterate map values to find by code? Or just use codeToIdMap
                      const batchId = codeToIdMap.get(cleanCode);
                      if (batchId) existingJob = jobsBatchMap.get(batchId);
                  }

                  let jobId: string;

                  if (existingJob) {
                      jobId = existingJob.id;
                      // Update mode
                      if (!jobsBatchMap.has(jobId)) { // Count update only once per batch
                          jobsUpdated++;
                      }
                  } else {
                      // New Job
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
                  
                  // Store in batch map (overwrites if already processed in this loop, ensuring latest data)
                  jobsBatchMap.set(jobId, jobData);
                  lastJobId = jobId;
              }

              // --- LOG HANDLING ---
              if (lastJobId && operatorRaw) {
                  const operatorName = String(operatorRaw).trim();
                  // Fuzzy match employee
                  let emp = employees.find(e => e.name.toLowerCase().includes(operatorName.toLowerCase()));
                  
                  // If not in DB, check current batch
                  if (!emp) {
                      for (const batchEmp of empsBatchMap.values()) {
                          if (batchEmp.name.toLowerCase() === operatorName.toLowerCase()) {
                              emp = batchEmp;
                              break;
                          }
                      }
                  }

                  if (!emp) {
                      // Create generic import employee
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
                       
                       // Avoid duplicates in DB check
                       const existsInDb = logs.some(l => l.id === logId);
                       // Avoid duplicates in Batch check
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

          // --- BULK COMMIT ---
          if (jobsBatchMap.size > 0 || logsBatchList.length > 0) {
              try {
                  // Use dbService bulk import
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

  // --- Calculations for HR Stats with specific schedules ---
  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { hours: 0, isLate: false, isAnomaly: false, firstIn: null, records: [], justification: null };

    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check if it's a working day for this employee
    const isWorkingDay = (emp.workDays || [1,2,3,4,5]).includes(dayOfWeek);

    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    const isExempt = emp.role === Role.SYSTEM_ADMIN || emp.role === Role.DIRECTION;
    
    // Justification overrides everything
    if (justification) {
        if (justification.type === JustificationType.FERIE || 
            justification.type === JustificationType.MALATTIA || 
            justification.type === JustificationType.INGIUSTIFICATO) {
            return { hours: 0, isLate: false, isAnomaly: false, firstIn: null, records: [], justification };
        }
    }

    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalHours = 0;
    let isLate = false;
    let firstIn: string | null = null;
    let isAnomaly = false;

    // Check for anomalies: Odd number of punches (Missing exit)
    // Only flag anomaly if it's a past date (on current date they might be working)
    if (dateStr < todayStr && dayAttendance.length % 2 !== 0) {
        isAnomaly = true;
    }

    if (isExempt && dayAttendance.length === 0 && isWorkingDay) {
        totalHours = 8;
        return { hours: totalHours, isLate: false, isAnomaly: false, firstIn: '08:30 (Auto)', records: [], justification };
    }

    if (!isWorkingDay && dayAttendance.length === 0) {
        return { hours: 0, isLate: false, isAnomaly: false, firstIn: null, records: [], justification: null };
    }

    for (let i = 0; i < dayAttendance.length; i++) {
        if (dayAttendance[i].type === 'ENTRATA') {
             const inTime = new Date(dayAttendance[i].timestamp);
             if (!firstIn) firstIn = inTime.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             
             // Check lateness against specific employee schedule
             const scheduleStart = emp.scheduleStartMorning || "08:30";
             const [scheduleH, scheduleM] = scheduleStart.split(':').map(Number);
             const entryH = inTime.getHours();
             const entryM = inTime.getMinutes();
             
             // Convert to minutes for easier comparison
             const limitMinutes = (scheduleH * 60) + scheduleM + (emp.toleranceMinutes || 10);
             const entryMinutes = (entryH * 60) + entryM;
             
             // Only flag late if it's a morning entry (before noon) and exceeds tolerance
             if (entryH < 12 && entryMinutes > limitMinutes) {
                 isLate = true;
             }

             if (i + 1 < dayAttendance.length && dayAttendance[i+1].type === 'USCITA') {
                 const outTime = new Date(dayAttendance[i+1].timestamp);
                 totalHours += (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
                 i++; 
             }
        }
    }
    
    if (justification && (justification.type === JustificationType.RITARDO_GIUSTIFICATO || justification.type === JustificationType.PERMESSO)) {
        isLate = false;
    }
    
    return { hours: totalHours, isLate, isAnomaly, firstIn, records: dayAttendance, justification };
  };

  const getPayrollData = () => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let workedHours = 0;
         let ferieHours = 0;
         let malattiaHours = 0;
         let permessoHours = 0;
         let lateCount = 0;
         let daysWorked = 0;
         for(let d=1; d<=daysInMonth; d++) {
             const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
             const stats = calculateDailyStats(emp.id, dateStr);
             const just = stats.justification;
             workedHours += stats.hours;
             if (stats.hours > 0) daysWorked++;
             if (stats.isLate) lateCount++;
             if (just) {
                 if (just.type === JustificationType.FERIE) ferieHours += 8;
                 if (just.type === JustificationType.MALATTIA) malattiaHours += 8;
                 if (just.type === JustificationType.PERMESSO) permessoHours += (just.hoursOffset || 0);
             }
         }
         return { ...emp, workedHours, ferieHours, malattiaHours, permessoHours, lateCount, daysWorked };
     });
  };

  const handleExportConsultant = () => {
      const data = payrollStats.map(p => ({
          'Dipendente': p.name,
          'Reparto': p.department,
          'Mese': selectedMonth,
          'Giorni Presenza': p.daysWorked,
          'Ore Lavorate': p.workedHours.toFixed(2),
          'Ore Ferie': p.ferieHours,
          'Ore Malattia': p.malattiaHours,
          'Ore Permesso': p.permessoHours,
          'Ritardi': p.lateCount
      }));
      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Paghe");
      writeFile(workbook, `Report_Paghe_${selectedMonth}.xlsx`);
  };

  const setJustificationForDay = (empId: string, dateStr: string, type: JustificationType) => {
      const newJust: DayJustification = {
          id: `${empId}-${dateStr}`,
          employeeId: empId,
          date: dateStr,
          type,
          hoursOffset: type === JustificationType.PERMESSO ? 1 : 0 
      };
      onSaveJustification(newJust);
  };

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
        
        {activeTab === 'OVERVIEW' && (
             <>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:grid-cols-2 print:hidden">
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

            {/* Advanced Reports Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:border-none print:shadow-none print:p-0 print-section">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <h3 className="text-xl font-bold text-slate-800">Report Avanzati</h3>
                    <button onClick={() => window.print()} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 border p-2 rounded hover:bg-slate-50">
                        <Printer size={18} /> Stampa Report
                    </button>
                </div>
                {/* Print Only Header */}
                <div className="hidden print:block mb-8 border-b pb-4">
                    <h1 className="text-2xl font-bold">Report Aziendale Integrato</h1>
                    <p className="text-slate-500">Data Stampa: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                    {/* Top Clients */}
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

                    {/* Over Budget */}
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

                    {/* Phase Leaders */}
                    <div className="border rounded-lg p-4 bg-blue-50 print:bg-white print:border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <Users size={18} className="text-blue-600"/> Volume Lavoro per Fase
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
                </div>
            </div>
            </>
        )}
        
        {/* JOBS, HR, AI Sections */}
        {activeTab === 'JOBS' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="font-bold text-slate-700">Elenco Commesse</h3>
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
                {/* Table for JOBS Tab remains similar to previous version, ensuring sorting/filtering works */}
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
                     // Modal content
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
                        
                        {/* New Job Modal with Priority and Suggested Operator */}
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
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Assegna a Operatore (Suggerimento)</label>
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
