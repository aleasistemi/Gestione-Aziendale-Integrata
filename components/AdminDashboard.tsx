
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload } from 'lucide-react';
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
      // System Admin always sees everything, including config
      if (isSystem) return ['OVERVIEW', 'JOBS', 'HR', 'AI', 'MANAGE', 'CONFIG'];
      
      // Use permissions from DB or fallbacks
      const rolePerms = permissions[currentUserRole];
      if (rolePerms) return rolePerms;

      // Fallback (should be covered by default DB value)
      return ['OVERVIEW'];
  }

  const allowedTabsList = getAllowedTabs();

  const allPossibleTabs = [
    {id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard},
    {id: 'JOBS', label: 'Analisi Commesse', icon: Briefcase},
    {id: 'HR', label: 'HR & PAGHE', icon: Users},
    {id: 'AI', label: 'AI Analyst', icon: TrendingUp},
    {id: 'MANAGE', label: 'GESTIONE DATI', icon: Settings},
    {id: 'CONFIG', label: 'CONFIGURAZIONE', icon: Wrench} // Only for System Admin usually
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

      return { ...job, totalHoursUsed, totalCost, profitMargin, isOverBudget, startDate };
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
  
  // For Manage Tab, we essentially use the same data source but might have different sorting/filtering needs
  // We use filteredJobStats here too so the date filter works in Manage tab as requested
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
    const context = { jobs: filteredJobStats, logs, employees }; // Use filtered stats for AI context
    const result = await analyzeBusinessData(promptText, context);
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
          'Costi Stimati': j.totalCost,
          'Margine': j.profitMargin,
          'Scadenza': j.deadline,
          'Data Inizio': j.startDate
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

  // Re-using the robust Import Logic from previous steps
  const parsePositionalTime = (val: any): number => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'string' && val.includes(':')) {
          const parts = val.split(':');
          if (parts.length >= 2) {
              const h = Number(parts[0]);
              const m = Number(parts[1]);
              if (!isNaN(h) && !isNaN(m)) return h + (m / 60);
          }
      }
      const num = Number(val);
      if (!isNaN(num)) return num;
      return 0;
  }

  const parsePositionalDate = (val: any): string => {
     try {
         if (!val) return new Date().toISOString().split('T')[0];
         if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569)*86400*1000));
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
         }
         if (typeof val === 'string') {
             const v = val.trim();
             if (v.includes('.')) {
                 const parts = v.split('.');
                 if (parts.length === 3) {
                     let day = parseInt(parts[0]);
                     let month = parseInt(parts[1]);
                     let year = parseInt(parts[2]);
                     if (year < 100) year += 2000; 
                     const d = new Date(year, month - 1, day);
                     if (!isNaN(d.getTime())) {
                        const offset = d.getTimezoneOffset();
                        const adjustedDate = new Date(d.getTime() - (offset*60*1000));
                        return adjustedDate.toISOString().split('T')[0];
                     }
                 }
             }
             if (v.includes('/')) {
                 const parts = v.split('/');
                 if(parts.length === 3) {
                     const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                     if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                 }
             }
         }
         const d = new Date(val);
         if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
         return new Date().toISOString().split('T')[0];
     } catch (e) {
         return new Date().toISOString().split('T')[0];
     }
  }

  const findEmployeeByFuzzyName = (excelName: string, allEmployees: Employee[]): Employee | undefined => {
      const cleanExcel = String(excelName).toLowerCase().trim();
      if (!cleanExcel) return undefined;
      return allEmployees.find(emp => {
          const cleanDb = emp.name.toLowerCase();
          return cleanDb.includes(cleanExcel) || cleanExcel.includes(cleanDb);
      });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      let headerRowIndex = -1;
      let colMap = { code: -1, client: -1, description: -1, deadline: -1, budgetHours: -1, budgetValue: -1, operator: -1, hours: -1, dateStart: -1 };

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (!row) continue;
          const codeIdx = row.findIndex((cell: any) => String(cell).toLowerCase().includes('riferimento') || String(cell).toLowerCase().includes('reference'));
          if (codeIdx !== -1) {
              headerRowIndex = i;
              colMap.code = codeIdx;
              colMap.client = row.findIndex((cell: any) => String(cell).toLowerCase().includes('cliente'));
              colMap.description = row.findIndex((cell: any) => String(cell).toLowerCase().includes('descrizione'));
              colMap.deadline = row.findIndex((cell: any) => String(cell).toLowerCase().includes('data consegna'));
              colMap.budgetHours = row.findIndex((cell: any) => String(cell).toLowerCase().includes('monte ore'));
              colMap.budgetValue = row.findIndex((cell: any) => String(cell).toLowerCase().includes('valore'));
              colMap.operator = row.findIndex((cell: any) => String(cell).toLowerCase().includes('operatore'));
              colMap.dateStart = row.findIndex((cell: any) => String(cell).toLowerCase().includes('data inizio'));
              const allOreIndices = row.map((cell: any, idx: number) => String(cell).toLowerCase() === 'ore' || String(cell).toLowerCase() === 'ore usate' ? idx : -1).filter((idx: number) => idx !== -1);
              const detailHoursIdx = allOreIndices.find((idx: number) => idx > colMap.operator);
              colMap.hours = detailHoursIdx !== undefined ? detailHoursIdx : -1;
              break;
          }
      }

      if (headerRowIndex === -1 || colMap.code === -1) throw new Error("Impossibile trovare la riga di intestazione (Cerca 'Riferimento').");

      const importedJobsMap = new Map<string, Job>();
      const importedLogs: WorkLog[] = [];
      const importedEmployeesMap = new Map<string, Employee>();
      employees.forEach(e => importedEmployeesMap.set(e.id, e));
      jobs.forEach(j => importedJobsMap.set(j.code, j));

      let rowsProcessed = 0;
      let logsCreated = 0;
      let newEmployeesCount = 0;

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const val = (idx: number) => (idx !== -1 && row[idx] !== undefined) ? row[idx] : '';
          const code = String(val(colMap.code)).trim();
          if (!code || code.toLowerCase().includes('riferimento')) continue;

          const operatorRaw = val(colMap.operator);
          if (!operatorRaw || String(operatorRaw).trim() === '') continue;

          rowsProcessed++;
          const clientName = String(val(colMap.client)).trim() || 'Sconosciuto';
          const description = String(val(colMap.description)).trim();
          const deadline = parsePositionalDate(val(colMap.deadline));
          const budgetHours = Number(val(colMap.budgetHours)) || 0;
          const budgetValue = Number(val(colMap.budgetValue)) || 0;
          const date = parsePositionalDate(val(colMap.dateStart));

            let job = importedJobsMap.get(code);
            const newJob: Job = {
                id: job ? job.id : `job-${code}`,
                code: code,
                clientName: clientName,
                description: description || (job?.description || ''),
                status: JobStatus.IN_PROGRESS,
                budgetHours: budgetHours > 0 ? budgetHours : (job?.budgetHours || 0),
                budgetValue: budgetValue > 0 ? budgetValue : (job?.budgetValue || 0),
                deadline: deadline
            };
            importedJobsMap.set(code, newJob);

            const hours = parsePositionalTime(val(colMap.hours));
            const opNameStr = String(operatorRaw).trim();

            if (hours > 0 && opNameStr) {
                let emp = findEmployeeByFuzzyName(opNameStr, employees);
                if (!emp) {
                    const tempArr = Array.from(importedEmployeesMap.values());
                    emp = findEmployeeByFuzzyName(opNameStr, tempArr);
                }

                if (!emp) {
                    emp = {
                        id: `emp-imp-${opNameStr.replace(/\s+/g, '')}-${Date.now()}`,
                        name: opNameStr,
                        role: Role.WORKSHOP, 
                        hourlyRate: 30, 
                        department: 'Importato',
                        toleranceMinutes: 10,
                        scheduleStartMorning: "08:30",
                        scheduleEndMorning: "12:30",
                        scheduleStartAfternoon: "13:30",
                        scheduleEndAfternoon: "17:30"
                    };
                    importedEmployeesMap.set(emp.id, emp);
                    newEmployeesCount++;
                }

                const uniqueLogId = `log-${code}-${emp.id}-${date}-${hours}`;
                if (!importedLogs.find(l => l.id === uniqueLogId)) {
                    importedLogs.push({
                        id: uniqueLogId,
                        employeeId: emp.id,
                        jobId: newJob.id,
                        phase: 'Generica (Import)',
                        hours: hours,
                        date: date,
                        notes: `Importato: ${opNameStr}`
                    });
                    logsCreated++;
                }
            }
      }

      const finalJobs = Array.from(importedJobsMap.values());
      const finalNewEmployees = Array.from(importedEmployeesMap.values()).filter(e => !employees.find(ex => ex.id === e.id));

      await dbService.bulkImport(finalJobs, importedLogs, finalNewEmployees);
      alert(`Importazione Completata con Successo!\n\nRighe Dati Processate: ${rowsProcessed}\nLog Creati: ${logsCreated}\nNuovi Dipendenti: ${newEmployeesCount}`);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error("Excel import failed", error);
      alert("Errore importazione: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // --- HR Calculations ---
  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { hours: 0, isLate: false, firstIn: null, records: [], justification: null };

    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    const isExempt = emp.role === Role.SYSTEM_ADMIN || emp.role === Role.DIRECTION;
    
    if (justification) {
        if (justification.type === JustificationType.FERIE || 
            justification.type === JustificationType.MALATTIA || 
            justification.type === JustificationType.INGIUSTIFICATO) {
            return { hours: 0, isLate: false, firstIn: null, records: [], justification };
        }
    }

    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalHours = 0;
    let isLate = false;
    let firstIn: string | null = null;

    if (isExempt && dayAttendance.length === 0) {
        const dayOfWeek = new Date(dateStr).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            totalHours = 8;
        }
        return { hours: totalHours, isLate: false, firstIn: '08:30 (Auto)', records: [], justification };
    }

    for (let i = 0; i < dayAttendance.length; i++) {
        if (dayAttendance[i].type === 'ENTRATA') {
             const inTime = new Date(dayAttendance[i].timestamp);
             if (!firstIn) firstIn = inTime.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             const scheduleH = parseInt(emp.scheduleStartMorning.split(':')[0]);
             const scheduleM = parseInt(emp.scheduleStartMorning.split(':')[1]);
             const entryH = inTime.getHours();
             const entryM = inTime.getMinutes();
             const limitMinutes = (scheduleH * 60) + scheduleM + emp.toleranceMinutes;
             const entryMinutes = (entryH * 60) + entryM;
             if (entryH < 12 && entryMinutes > limitMinutes) isLate = true;
             if (i + 1 < dayAttendance.length && dayAttendance[i+1].type === 'USCITA') {
                 const outTime = new Date(dayAttendance[i+1].timestamp);
                 totalHours += (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
                 i++; 
             }
        }
    }
    if (justification && (justification.type === JustificationType.RITARDO_GIUSTIFICATO || justification.type === JustificationType.PERMESSO)) isLate = false;
    return { hours: totalHours, isLate, firstIn, records: dayAttendance, justification };
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

  const payrollStats = useMemo(() => activeTab === 'HR' ? getPayrollData() : [], [activeTab, selectedMonth, attendance, employees, justifications]);

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
    onSaveJob(newJob);
    setIsEditingJob(null);
  };

  const handleSaveEmpForm = () => {
    if (!isEditingEmp?.name) return;
    const newEmp = { ...isEditingEmp } as Employee;
    newEmp.id = newEmp.id || Date.now().toString();
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
        
        {/* ... OVERVIEW, JOBS, HR, AI Sections remain largely unchanged, focusing on MANAGE and CONFIG updates ... */}

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
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Ore Totali Mese</p>
                            <h3 className="text-2xl font-bold text-slate-800">{logs.reduce((acc, l) => acc + l.hours, 0)}</h3>
                        </div>
                        <Users className="text-purple-500 bg-purple-50 p-2 rounded-lg" size={40} />
                    </div>
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
        
        {/* JOBS, HR, AI Sections same as previous file version... omitted for brevity but part of final file */}
        {activeTab === 'JOBS' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="font-bold text-slate-700">Elenco Commesse</h3>
                        {/* Date Filter */}
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

                                {/* Detailed Logs Table */}
                                <div>
                                    <h4 className="text-lg font-semibold mb-3 text-slate-700">Cronologia Lavori (Dettaglio Fasi)</h4>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-3">Data</th>
                                                    <th className="px-4 py-3">Operatore</th>
                                                    <th className="px-4 py-3">Fase (Modificabile)</th>
                                                    <th className="px-4 py-3">Ore</th>
                                                    <th className="px-4 py-3">Note</th>
                                                    <th className="px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {logs
                                                    .filter(l => l.jobId === selectedJobForAnalysis)
                                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                    .map(log => (
                                                        <tr key={log.id} className="hover:bg-slate-50 group">
                                                            <td className="px-4 py-3 text-slate-600">{new Date(log.date).toLocaleDateString('it-IT')}</td>
                                                            <td className="px-4 py-3 font-medium text-slate-900">{employees.find(e => e.id === log.employeeId)?.name || 'Sconosciuto'}</td>
                                                            <td className="px-4 py-3 text-slate-600">
                                                                {editingLogId === log.id ? (
                                                                    <select 
                                                                        autoFocus
                                                                        value={tempPhase}
                                                                        onChange={(e) => setTempPhase(e.target.value)}
                                                                        onBlur={() => handleUpdatePhase(log)}
                                                                        className="border rounded p-1 text-xs"
                                                                    >
                                                                        {['Preventivo','Ordine','Taglio','Lavorazioni','Assemblaggio','Taglio Pannelli','Preparazione Accessori','Imballaggio','Spedizione','Generica (Import)'].map(p => (
                                                                            <option key={p} value={p}>{p}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <button 
                                                                        onClick={() => { setEditingLogId(log.id); setTempPhase(log.phase); }}
                                                                        className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 hover:bg-blue-100 flex items-center gap-1"
                                                                    >
                                                                        {log.phase} <Edit2 size={10} className="opacity-0 group-hover:opacity-50"/>
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-700">{log.hours}</td>
                                                            <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{log.notes || '-'}</td>
                                                            <td className="px-4 py-3 text-right"></td>
                                                        </tr>
                                                    ))
                                                }
                                                {logs.filter(l => l.jobId === selectedJobForAnalysis).length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                                            Nessuna attività registrata per questa commessa.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                                <button 
                                    onClick={() => setSelectedJobForAnalysis(null)}
                                    className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition"
                                >
                                    Chiudi Dettaglio
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'HR' && (
             // Preserving existing HR Tab Code ... 
             <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="text-blue-600"/>
                    <label className="text-sm font-medium text-slate-700">Seleziona Mese:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-2 py-1"/>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                         <h3 className="font-bold text-slate-700">Riepilogo Mensile Presenze</h3>
                         <button onClick={handleExportConsultant} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition"><FileSpreadsheet size={16}/> Esporta Report Consulente</button>
                    </div>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dipendente</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gg Lav.</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ore Lav.</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ritardi</th><th className="px-6 py-3"></th></tr></thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {payrollStats.map(stat => (
                                <tr key={stat.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{stat.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{stat.daysWorked}</td>
                                    <td className="px-6 py-4 text-slate-500">{stat.workedHours.toFixed(2)}</td>
                                    <td className="px-6 py-4">{stat.lateCount > 0 ? <span className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 rounded w-fit"><AlertCircle size={14}/> {stat.lateCount}</span> : <span className="text-green-600">0</span>}</td>
                                    <td className="px-6 py-4"><button onClick={() => setSelectedEmpForDetail(stat.id)} className="text-blue-600 hover:text-blue-800 underline">Gestisci</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {selectedEmpForDetail && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Gestione Presenze</h3><button onClick={() => setSelectedEmpForDetail(null)}><X size={24} className="text-slate-400"/></button></div>
                            <div className="space-y-2">
                                {Array.from({length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()}, (_, i) => i + 1).map(day => {
                                    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                                    const stats = calculateDailyStats(selectedEmpForDetail, dateStr);
                                    const dateObj = new Date(dateStr);
                                    if(stats.hours === 0 && !stats.justification && (dateObj.getDay() === 0 || dateObj.getDay() === 6)) return null;
                                    return (
                                        <div key={day} className={`flex justify-between items-center p-3 rounded border ${stats.isLate ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                                            <div className="w-32"><div className="font-mono font-bold text-slate-700">{dateStr}</div><div className="text-xs text-slate-400">{dateObj.toLocaleDateString('it-IT', {weekday:'long'})}</div></div>
                                            <div className="text-sm">{stats.justification ? <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">{stats.justification.type}</span> : (stats.hours > 0 ? `${stats.hours.toFixed(2)}h` : '-')}</div>
                                            <select className="text-xs border rounded p-1" value={stats.justification?.type || ''} onChange={(e) => {if(e.target.value) setJustificationForDay(selectedEmpForDetail, dateStr, e.target.value as JustificationType)}}>
                                                <option value="">Azioni...</option><option value={JustificationType.FERIE}>Ferie</option><option value={JustificationType.MALATTIA}>Malattia</option><option value={JustificationType.PERMESSO}>Permesso</option>
                                            </select>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {activeTab === 'AI' && (
             // AI Tab Content remains same
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Analista Aziendale IA</h2>
                        <p className="text-slate-500 text-sm">Chiedi analisi su profitti, costi e inefficienze. Personalizza le tue domande rapide.</p>
                    </div>
                </div>

                {/* Quick Prompts Grid */}
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
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[200px] mb-4 shadow-inner">
                    {aiResponse ? <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} /> : <div className="text-center text-slate-400 py-16 flex flex-col items-center gap-3">{isLoadingAi ? <Loader2 className="animate-spin text-blue-500" size={32}/> : <span>Seleziona una domanda rapida o scrivi la tua richiesta qui sotto.</span>}</div>}
                </div>
                <div className="flex gap-2 relative">
                    <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Fai una domanda libera..." className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none pl-12 shadow-sm"/>
                    <div className="absolute left-4 top-3.5 text-slate-400"><Info size={20}/></div>
                    <button onClick={() => handleAskAI()} disabled={!aiPrompt || isLoadingAi} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-sm">{isLoadingAi ? 'Attendere...' : 'Analizza'}</button>
                </div>
            </div>
        )}

        {activeTab === 'MANAGE' && (
            <div className="space-y-6">
                <div className="flex gap-4 mb-6">
                    <button onClick={() => setManageSubTab('JOBS')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'JOBS' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Commesse</button>
                    {(canManageEmployees || isSystem) && <button onClick={() => setManageSubTab('EMPLOYEES')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'EMPLOYEES' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Dipendenti</button>}
                </div>

                {manageSubTab === 'JOBS' && (
                    // Jobs Management (reused)
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Elenco Commesse</h2>
                            
                            <div className="flex items-center gap-2">
                                {/* Date Filter for Manage */}
                                <div className="flex items-center gap-2 text-sm bg-white p-1 rounded border border-slate-200">
                                    <Calendar size={14} className="text-slate-400 ml-1"/>
                                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                                    {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                                </div>
                            </div>

                            <div className="flex gap-2">
                              <input type="file" accept=".xlsx, .xls, .xml" onChange={handleExcelImport} className="hidden" ref={fileInputRef} />
                              {(isGodMode) && <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"><FileSpreadsheet size={18} /> Importa</button>}
                              {(isGodMode) && <button onClick={() => handleExcelExportJobs(sortedManageJobs)} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"><Download size={18} /> Export</button>}
                              <button onClick={() => setIsEditingJob({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuova</button>
                            </div>
                        </div>
                        
                        {isEditingJob && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingJob.id ? 'Modifica Commessa' : 'Nuova Commessa'}</h3><button onClick={() => setIsEditingJob(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Codice</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.code || ''} onChange={e => setIsEditingJob({...isEditingJob, code: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Cliente</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.clientName || ''} onChange={e => setIsEditingJob({...isEditingJob, clientName: e.target.value})} /></div>
                                        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700">Descrizione</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.description || ''} onChange={e => setIsEditingJob({...isEditingJob, description: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Budget Ore</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetHours || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetHours: Number(e.target.value)})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Valore (€)</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetValue || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetValue: Number(e.target.value)})} /></div>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsEditingJob(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Annulla</button><button onClick={handleSaveJobForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button></div>
                                </div>
                            </div>
                        )}

                        <table className="w-full text-sm text-left">
                             <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th onClick={() => requestSort('code', manageJobSort, setManageJobSort)} className="px-4 py-3 cursor-pointer hover:bg-slate-100">Codice {renderSortArrow('code', manageJobSort)}</th>
                                    <th onClick={() => requestSort('clientName', manageJobSort, setManageJobSort)} className="px-4 py-3 cursor-pointer hover:bg-slate-100">Cliente {renderSortArrow('clientName', manageJobSort)}</th>
                                    <th onClick={() => requestSort('startDate', manageJobSort, setManageJobSort)} className="px-4 py-3 cursor-pointer hover:bg-slate-100">Inizio {renderSortArrow('startDate', manageJobSort)}</th>
                                    <th onClick={() => requestSort('status', manageJobSort, setManageJobSort)} className="px-4 py-3 cursor-pointer hover:bg-slate-100">Stato {renderSortArrow('status', manageJobSort)}</th>
                                    <th className="px-4 py-3">Azioni</th>
                                </tr>
                             </thead>
                             <tbody>
                                {sortedManageJobs.map(job => (
                                    <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium">{job.code}</td>
                                        <td className="px-4 py-3">{job.clientName}</td>
                                        <td className="px-4 py-3 text-slate-500">{job.startDate !== '-' ? new Date(job.startDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${job.status === JobStatus.IN_PROGRESS ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>{job.status}</span></td>
                                        <td className="px-4 py-3"><button onClick={() => setIsEditingJob(job)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button></td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    </div>
                )}
                
                {manageSubTab === 'EMPLOYEES' && (
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Gestione Personale</h2>
                            <button onClick={() => setIsEditingEmp({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuovo Dipendente</button>
                        </div>
                        {isEditingEmp && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-lg">
                                    <h3 className="text-lg font-bold mb-4">{isEditingEmp.id ? 'Modifica' : 'Nuovo'} Dipendente</h3>
                                    <div className="space-y-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Nome</label><input type="text" placeholder="Nome" className="w-full border p-2 rounded" value={isEditingEmp.name || ''} onChange={e => setIsEditingEmp({...isEditingEmp, name: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Ruolo</label><select className="w-full border p-2 rounded" value={isEditingEmp.role || Role.EMPLOYEE} onChange={e => setIsEditingEmp({...isEditingEmp, role: e.target.value as Role})}>{Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-medium text-slate-700">Codice NFC (Badge)</label><input type="text" placeholder="Es. TAG_123" className="w-full border p-2 rounded font-mono" value={isEditingEmp.nfcCode || ''} onChange={e => setIsEditingEmp({...isEditingEmp, nfcCode: e.target.value})} /></div>
                                            <div><label className="block text-sm font-medium text-slate-700">PIN Accesso</label><input type="text" placeholder="Es. 1234" maxLength={6} className="w-full border p-2 rounded font-mono" value={isEditingEmp.pin || ''} onChange={e => setIsEditingEmp({...isEditingEmp, pin: e.target.value})} /></div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsEditingEmp(null)} className="px-4 py-2 text-slate-600">Annulla</button><button onClick={handleSaveEmpForm} className="px-4 py-2 bg-blue-600 text-white rounded">Salva</button></div>
                                </div>
                            </div>
                        )}
                        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Nome</th><th className="px-4 py-3 text-left">Ruolo</th><th className="px-4 py-3 text-left">Badge / PIN</th><th className="px-4 py-3"></th></tr></thead><tbody>{employees.map(emp => <tr key={emp.id} className="border-b"><td className="px-4 py-3">{emp.name}</td><td className="px-4 py-3">{emp.role}</td><td className="px-4 py-3 font-mono text-xs">{emp.nfcCode ? <span className="bg-green-100 text-green-800 px-1 rounded">NFC</span> : ''} {emp.pin ? <span className="bg-blue-100 text-blue-800 px-1 rounded">PIN</span> : ''}</td><td className="px-4 py-3 text-right"><button onClick={() => setIsEditingEmp(emp)} className="text-blue-600"><Edit2 size={16}/></button></td></tr>)}</tbody></table>
                     </div>
                )}
            </div>
        )}

        {activeTab === 'CONFIG' && isSystem && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-slate-800 text-white p-2 rounded-lg"><Settings size={24} /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Configurazione Sistema</h2>
                        <p className="text-slate-500 text-sm">Gestisci visibilità delle dashboard e impostazioni hardware.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                     {/* Hardware / Global Settings */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Wrench size={18}/> Impostazioni Hardware</h3>
                        <div className="flex items-center justify-between bg-white p-3 rounded shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${settings.nfcEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Scan size={20} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">Attiva Modalità NFC/Badge</p>
                                    <p className="text-xs text-slate-500">Nasconde le liste utenti e attiva la lettura badge per Totem e Login.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => onSaveSettings({...settings, nfcEnabled: !settings.nfcEnabled})} 
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.nfcEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.nfcEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Backup & Restore */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                         <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Database size={18}/> Backup & Ripristino</h3>
                         <div className="space-y-3">
                             <button onClick={handleBackupDownload} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 p-3 rounded font-medium transition shadow-sm">
                                 <Download size={18}/> Scarica Backup Completo (.json)
                             </button>
                             <div className="relative">
                                 <input type="file" ref={backupInputRef} onChange={handleBackupRestore} accept=".json" className="hidden" />
                                 <button onClick={() => backupInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white p-3 rounded font-medium transition shadow-sm">
                                     <Upload size={18}/> Importa e Ripristina
                                 </button>
                             </div>
                             <p className="text-xs text-slate-400 text-center">Attenzione: il ripristino sovrascriverà tutti i dati attuali.</p>
                         </div>
                    </div>
                </div>

                <h3 className="font-bold text-slate-700 mb-4">Permessi Ruoli</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-3 text-left font-semibold text-slate-600">Ruolo</th>
                                {allPossibleTabs.filter(t => t.id !== 'CONFIG').map(tab => (
                                    <th key={tab.id} className="p-3 text-center font-semibold text-slate-600 text-xs uppercase">{tab.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(Role).map(role => (
                                <tr key={role} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{role}</td>
                                    {allPossibleTabs.filter(t => t.id !== 'CONFIG').map(tab => {
                                        const isChecked = (tempPermissions[role] || []).includes(tab.id);
                                        return (
                                            <td key={tab.id} className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => togglePermission(role, tab.id)}
                                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={savePermissions} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">
                        <Save size={18}/> Salva Configurazione
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
