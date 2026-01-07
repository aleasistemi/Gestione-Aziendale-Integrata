
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser, BrainCircuit, Timer, Search, Archive, RotateCcw, Truck, MapPin, User, ChevronLeft, ChevronRight, Wifi, UploadCloud } from 'lucide-react';
import { analyzeBusinessData } from '../services/geminiService';
import { read, utils, writeFile } from 'xlsx';
import { dbService } from '../services/db';

interface Props {
  jobs: Job[];
  logs: WorkLog[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  vehicles?: Vehicle[];
  vehicleLogs?: VehicleLog[];
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
  onSaveVehicle?: (vehicle: Vehicle) => void;
  onDeleteVehicle?: (id: string) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EC1D25'];

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

const TimeInput = ({ value, onChange, className, placeholder }: { value: string, onChange: (val: string) => void, className?: string, placeholder?: string }) => {
    const [localVal, setLocalVal] = useState(value || '');

    useEffect(() => {
        setLocalVal(value || '');
    }, [value]);

    const handleBlur = () => {
        let v = localVal.trim();
        if (!v) {
            if (value) onChange(''); 
            return;
        }
        v = v.replace('.', ':').replace(',', ':');
        if (v.length === 4 && !v.includes(':') && !isNaN(Number(v))) {
            v = v.slice(0, 2) + ':' + v.slice(2);
        }
        if (v.length === 3 && !v.includes(':') && !isNaN(Number(v))) {
            v = '0' + v.slice(0, 1) + ':' + v.slice(1);
        }
        if (v.length <= 2 && !v.includes(':') && !isNaN(Number(v))) {
             v = v.padStart(2, '0') + ':00';
        }
        const parts = v.split(':');
        if (parts.length === 2) {
            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]);
            if (!isNaN(h) && !isNaN(m)) {
                if (h < 0) h = 0; if (h > 23) h = 23;
                if (m < 0) m = 0; if (m > 59) m = 59;
                const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (formatted !== value) onChange(formatted);
                setLocalVal(formatted);
                return;
            }
        }
        setLocalVal(value || '');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    }

    return (
        <input 
            type="text" 
            className={className}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "--:--"}
        />
    );
};

export const AdminDashboard: React.FC<Props> = ({ jobs, logs, employees, attendance, vehicles = [], vehicleLogs = [], justifications = [], customPrompts = [], permissions = {}, onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, onSavePermissions, onUpdateLog, currentUserRole, settings, onSaveSettings, onSaveAttendance, onDeleteAttendance, onSaveVehicle, onDeleteVehicle }) => {
  
  // Permissions Logic
  const isGodMode = currentUserRole === Role.SYSTEM_ADMIN || currentUserRole === Role.DIRECTION;
  const isSystem = currentUserRole === Role.SYSTEM_ADMIN;
  const canManageEmployees = currentUserRole === Role.DIRECTION || currentUserRole === Role.SYSTEM_ADMIN;

  const getAllowedTabs = () => {
      if (isSystem) return ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE', 'CONFIG'];
      if (currentUserRole === Role.DIRECTION) return ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE'];
      
      const rolePerms = permissions[currentUserRole];
      if (rolePerms && rolePerms.length > 0) return rolePerms;
      
      return [];
  }

  const allowedTabsList = getAllowedTabs();

  const allPossibleTabs = [
    {id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard},
    {id: 'JOBS', label: 'Analisi Commesse', icon: Briefcase},
    {id: 'HR', label: 'HR & PAGHE', icon: Users},
    {id: 'FLEET', label: 'PARCO MEZZI', icon: Truck},
    {id: 'AI', label: 'AI Analyst', icon: BrainCircuit},
    {id: 'MANAGE', label: 'GESTIONE DATI', icon: Settings},
    {id: 'CONFIG', label: 'CONFIGURAZIONE', icon: Wrench}
  ];

  const availableTabs = allPossibleTabs.filter(t => allowedTabsList.includes(t.id));

  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
      if (availableTabs.length > 0) {
          if (!activeTab || !availableTabs.find(t => t.id === activeTab)) {
              setActiveTab(availableTabs[0].id);
          }
      } else {
          setActiveTab(null);
      }
  }, [currentUserRole, permissions, availableTabs]);

  const [manageSubTab, setManageSubTab] = useState<'JOBS' | 'EMPLOYEES'>('JOBS');
  
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [tempPhase, setTempPhase] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  
  const [jobSort, setJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  const [manageJobSort, setManageJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');

  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [viewArchiveYear, setViewArchiveYear] = useState<string>('active');
  const [clientSearchTerm, setClientSearchTerm] = useState(''); 
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const [isEditingVehicle, setIsEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [isWritingNfc, setIsWritingNfc] = useState<Partial<Employee> | null>(null);
  const [nfcWriteStatus, setNfcWriteStatus] = useState<'IDLE'|'WRITING'|'SUCCESS'|'ERROR'>('IDLE');
  
  const [fleetCurrentMonth, setFleetCurrentMonth] = useState(new Date());
  const [fleetSelectedDate, setFleetSelectedDate] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [tempPromptText, setTempPromptText] = useState('');
  const [tempPromptLabel, setTempPromptLabel] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<string | null>(null);

  const [isEditingJob, setIsEditingJob] = useState<Partial<Job> | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState<Partial<Employee> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [tempPermissions, setTempPermissions] = useState<RolePermissions>(permissions);

  const availableArchiveYears = useMemo(() => {
      const years = new Set<number>();
      jobs.filter(j => j.isArchived).forEach(j => {
          if (j.archiveYear) years.add(j.archiveYear);
      });
      return Array.from(years).sort((a,b) => b - a);
  }, [jobs]);

  const uniqueClients = useMemo(() => {
      return Array.from(new Set(jobs.map(j => j.clientName))).sort();
  }, [jobs]);

  const handleWriteNfc = async (emp: Employee) => {
      setIsWritingNfc(emp);
      setNfcWriteStatus('IDLE');

      if ('NDEFReader' in window) {
          try {
              const ndef = new window.NDEFReader();
              await ndef.scan(); 
              setNfcWriteStatus('WRITING');
              
              const codeToWrite = emp.nfcCode || emp.nfcCode2 || emp.id;
              
              await (ndef as any).write({
                  records: [{ recordType: "text", data: codeToWrite }]
              });
              
              setNfcWriteStatus('SUCCESS');
              setTimeout(() => {
                  setIsWritingNfc(null);
                  setNfcWriteStatus('IDLE');
              }, 2000);

          } catch (error) {
              console.error(error);
              setNfcWriteStatus('ERROR');
          }
      } else {
          alert("NFC non supportato su questo dispositivo. Usa un telefono Android.");
          setIsWritingNfc(null);
      }
  }

  const filteredLogsInDateRange = useMemo(() => {
      if (!filterStartDate && !filterEndDate) return logs;
      return logs.filter(l => {
          const logDate = l.date;
          const isAfterStart = !filterStartDate || logDate >= filterStartDate;
          const isBeforeEnd = !filterEndDate || logDate <= filterEndDate;
          return isAfterStart && isBeforeEnd;
      });
  }, [logs, filterStartDate, filterEndDate]);

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

      const sortedLogs = [...jobLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const startDate = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length-1].date : job.creationDate || '-';
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastPhase = lastLog ? lastLog.phase : '-';

      return { ...job, totalHoursUsed, totalCost, profitMargin, isOverBudget, startDate, lastPhase };
    });
  }, [jobs, logs, employees]);

  const overviewJobStats = useMemo(() => {
      const relevantJobIds = new Set(filteredLogsInDateRange.map(l => l.jobId));
      jobs.forEach(j => {
          if ((!filterStartDate || (j.creationDate && j.creationDate >= filterStartDate)) && 
              (!filterEndDate || (j.creationDate && j.creationDate <= filterEndDate))) {
              relevantJobIds.add(j.id);
          }
      });
      const relevantJobs = jobStats.filter(j => relevantJobIds.has(j.id) && !j.isArchived);
      return relevantJobs;
  }, [jobStats, filteredLogsInDateRange, filterStartDate, filterEndDate, jobs]);


  const filterJobsForTable = (jobList: typeof jobStats, isManageTable: boolean) => {
      return jobList.filter(j => {
          if (isManageTable) {
              if (viewArchiveYear === 'active') {
                  if (j.isArchived) return false;
              } else {
                  if (!j.isArchived || j.archiveYear !== parseInt(viewArchiveYear)) return false;
              }
          } else {
              if (j.isArchived) return false;
          }

          if (globalSearchTerm.length >= 3) {
              const searchLower = globalSearchTerm.toLowerCase();
              const matchesCode = j.code.toLowerCase().includes(searchLower);
              const matchesClient = j.clientName.toLowerCase().includes(searchLower);
              if (!matchesCode && !matchesClient) return false;
          }

          if (filterStartDate && j.startDate !== '-' && j.startDate < filterStartDate) return false;
          if (filterEndDate && j.startDate !== '-' && j.startDate > filterEndDate) return false;

          return true;
      });
  };

  const sortData = (data: any[], config: SortConfig) => {
      if (!config) return data;
      return [...data].sort((a, b) => {
          let valA = a[config.key];
          let valB = b[config.key];
          if (config.key === 'creationDate' || config.key === 'deadline' || config.key === 'startDate') {
              valA = valA || ''; valB = valB || '';
          }
          if (valA < valB) return config.direction === 'asc' ? -1 : 1;
          if (valA > valB) return config.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const filteredJobStats = useMemo(() => filterJobsForTable(jobStats, false), [jobStats, filterStartDate, filterEndDate, globalSearchTerm]);
  const sortedJobStats = useMemo(() => sortData(filteredJobStats, jobSort), [filteredJobStats, jobSort]);
  
  const manageFilteredStats = useMemo(() => filterJobsForTable(jobStats, true), [jobStats, filterStartDate, filterEndDate, globalSearchTerm, viewArchiveYear]);
  const sortedManageJobs = useMemo(() => sortData(manageFilteredStats, manageJobSort), [manageFilteredStats, manageJobSort]); 

  const requestSort = (key: string, currentSort: SortConfig, setSort: any) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (currentSort && currentSort.key === key && currentSort.direction === 'asc') { direction = 'desc'; }
      setSort({ key, direction });
  }

  const renderSortArrow = (key: string, currentSort: SortConfig) => {
      if (!currentSort || currentSort.key !== key) return <span className="text-slate-300 ml-1">↕</span>;
      return currentSort.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1"/> : <ArrowDown size={14} className="inline ml-1"/>;
  }
  
  const clientData = useMemo(() => {
    const data: {[key: string]: number} = {};
    filteredLogsInDateRange.forEach(log => {
      const job = jobs.find(j => j.id === log.jobId);
      if (job) {
          data[job.clientName] = (data[job.clientName] || 0) + log.hours;
      }
    });
    return Object.keys(data).map(key => ({ name: key, hours: data[key] }));
  }, [filteredLogsInDateRange, jobs]);

  const statusData = useMemo(() => {
    const counts: {[key: string]: number} = {};
    overviewJobStats.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [overviewJobStats]);

  const topClientsByRevenue = useMemo(() => {
      const map: {[key:string]: number} = {};
      overviewJobStats.forEach(j => {
          map[j.clientName] = (map[j.clientName] || 0) + j.budgetValue;
      });
      return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [overviewJobStats]);

  const overBudgetClients = useMemo(() => {
      const map: {[key:string]: {over: number, total: number}} = {};
      overviewJobStats.filter(j => j.isOverBudget).forEach(j => {
          if (!map[j.clientName]) map[j.clientName] = {over: 0, total: 0};
          map[j.clientName].over += (j.totalHoursUsed - j.budgetHours);
          map[j.clientName].total += j.totalHoursUsed;
      });
      return Object.entries(map).sort((a,b) => b[1].over - a[1].over).slice(0, 5);
  }, [overviewJobStats]);

  const packagingJobs = useMemo(() => {
      return overviewJobStats.filter(j => j.status === JobStatus.IN_PROGRESS && j.lastPhase.toLowerCase().includes('imballaggio'));
  }, [overviewJobStats]);

  const phaseEfficiency = useMemo(() => {
      const map: {[phase:string]: {[emp:string]: number}} = {};
      filteredLogsInDateRange.forEach(l => {
          const empName = employees.find(e => e.id === l.employeeId)?.name || 'Unknown';
          if (!map[l.phase]) map[l.phase] = {};
          map[l.phase][empName] = (map[l.phase][empName] || 0) + l.hours;
      });
      return Object.entries(map).map(([phase, emps]) => {
          const topEmp = Object.entries(emps).sort((a,b) => b[1] - a[1])[0];
          return { phase, champion: topEmp[0], hours: topEmp[1] };
      });
  }, [filteredLogsInDateRange, employees]);

  const expiringJobs = useMemo(() => {
      return overviewJobStats
        .filter(j => j.status === JobStatus.IN_PROGRESS && j.deadline)
        .sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 5);
  }, [overviewJobStats]);

  const activeOperators = useMemo(() => {
     const map: {[id:string]: number} = {};
     filteredLogsInDateRange.forEach(l => {
         map[l.employeeId] = (map[l.employeeId] || 0) + l.hours;
     });
     return Object.entries(map)
        .map(([id, hours]) => ({ name: employees.find(e=>e.id===id)?.name || 'Unknown', hours }))
        .sort((a,b) => b.hours - a.hours)
        .slice(0, 5);
  }, [filteredLogsInDateRange, employees]);

  const recentActivities = useMemo(() => {
      return [...filteredLogsInDateRange]
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(l => ({
            ...l,
            empName: employees.find(e => e.id === l.employeeId)?.name,
            jobCode: jobs.find(j => j.id === l.jobId)?.code
        }));
  }, [filteredLogsInDateRange, employees, jobs]);

  const handleAskAI = async (promptText: string = aiPrompt) => {
    if (!settings.geminiApiKey) {
        alert("Per utilizzare AI Analyst, devi prima inserire una API Key valida nella sezione CONFIGURAZIONE.");
        return;
    }
    if (!promptText.trim()) return;
    setAiPrompt(promptText);
    setIsLoadingAi(true);
    setAiResponse('');
    const context = { jobs: jobStats, logs, employees };
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
          'Data Inizio': j.creationDate || j.startDate, 
          'Priorità': j.priority || 3,
          'Archiviata': j.isArchived ? `Sì (${j.archiveYear})` : 'No'
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

  const handleCloudBackupTest = async () => {
      if (!settings.backupWebhookUrl) {
          alert("Inserisci prima un URL Webhook valido (Pabbly/Zapier).");
          return;
      }
      try {
          const data = await dbService.exportDatabase();
          
          const blob = new Blob([data], { type: 'application/json' });
          const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
          const formData = new FormData();
          
          formData.append('file', blob, filename);

          await fetch(settings.backupWebhookUrl, {
              method: 'POST',
              body: formData
          });
          alert("Backup inviato correttamente al Webhook! Controlla Pabbly.");
      } catch (e) {
          alert("Errore invio backup: " + e);
      }
  }

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

  const handleResetFleet = async () => {
      if (window.confirm("Sei sicuro di voler ripulire tutto lo storico dei mezzi e resettare lo stato di tutti i veicoli a 'Disponibile'?")) {
          try {
              await dbService.resetFleetLogs();
              alert("Registro mezzi ripulito con successo. La pagina verrà ricaricata.");
              window.location.reload();
          } catch(e) {
              alert("Errore durante il reset del parco mezzi.");
          }
      }
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws, { header: 1 }); 

          const jobsBatchMap = new Map<string, Job>();
          const empsBatchMap = new Map<string, Employee>();
          const logsBatchList: WorkLog[] = [];
          
          let jobsCreated = 0; let jobsUpdated = 0; let logsCreated = 0;
          let lastJobContext: { id: string, code: string } | null = null;

          let headerIndex = -1;
          for(let i=0; i<Math.min(data.length, 50); i++) {
              const row = data[i] as any[];
              if(row && row.some(cell => cell && cell.toString().trim().toLowerCase() === 'riferimento')) {
                  headerIndex = i;
                  break;
              }
          }
          
          if(headerIndex === -1) { 
              alert("Intestazione 'Riferimento' non trovata. Assicurati che il file abbia le colonne corrette."); 
              return; 
          }

          const headerRow = data[headerIndex] as string[];
          const colMap: {[key:string]: number} = {};
          headerRow.forEach((cell, idx) => { 
              if(cell) colMap[cell.toString().trim().toLowerCase()] = idx; 
          });

          const getCol = (row: any[], name: string) => { 
              const idx = colMap[name.toLowerCase()]; 
              return (idx !== undefined && row[idx] !== undefined && row[idx] !== null) ? row[idx] : null; 
          };
          
          const formatDateStr = (val: any) => {
              if(!val) return '';
              if (val instanceof Date) return val.toISOString().split('T')[0];
              const s = String(val).trim();
              const parts = s.split(/[./-]/);
              if (parts.length === 3) {
                  let day = parts[0].padStart(2, '0');
                  let month = parts[1].padStart(2, '0');
                  let year = parts[2];
                  if (year.length === 2) year = "20" + year;
                  return `${year}-${month}-${day}`;
              }
              return '';
          };

          const parseHours = (val: any) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string' && val.includes(':')) {
                  const [h, m] = val.split(':').map(Number);
                  return (h || 0) + (m || 0) / 60;
              }
              return Number(val) || 0;
          };

          for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0) continue;
              
              const codeRaw = getCol(row, 'Riferimento');
              const operatorRaw = getCol(row, 'Operatore');
              const hoursRaw = getCol(row, 'Ore');

              if (codeRaw && String(codeRaw).trim() !== "") {
                  const code = String(codeRaw).trim();
                  let existingJob = jobs.find(j => j.code === code) || Array.from(jobsBatchMap.values()).find(j => j.code === code);
                  
                  let jobId: string;
                  if (existingJob) {
                      jobId = existingJob.id;
                      if (!jobsBatchMap.has(jobId)) jobsUpdated++;
                  } else {
                      jobId = "job-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
                      jobsCreated++;
                  }

                  const jobData: Job = {
                      id: jobId,
                      code: code,
                      clientName: String(getCol(row, 'Cliente') || 'Sconosciuto'),
                      description: String(getCol(row, 'Descrizione') || ''),
                      status: existingJob?.status || JobStatus.IN_PROGRESS,
                      budgetHours: Number(getCol(row, 'Monte Ore') || 0),
                      budgetValue: Number(getCol(row, 'Valore') || 0),
                      deadline: formatDateStr(getCol(row, 'Data Consegna')),
                      creationDate: formatDateStr(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0],
                      priority: existingJob?.priority || 3
                  };
                  jobsBatchMap.set(jobId, jobData);
                  lastJobContext = { id: jobId, code: code };
              }

              if (lastJobContext && operatorRaw && hoursRaw) {
                  const hours = parseHours(hoursRaw);
                  if (hours > 0) {
                      const opName = String(operatorRaw).trim();
                      let emp = employees.find(e => e.name.toLowerCase().includes(opName.toLowerCase())) || 
                                Array.from(empsBatchMap.values()).find(e => e.name.toLowerCase().includes(opName.toLowerCase()));
                      
                      if (!emp) {
                          const newEmpId = "imp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
                          emp = {
                              id: newEmpId,
                              name: opName,
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

                      const logDate = formatDateStr(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0];
                      logsBatchList.push({
                          id: `log-${lastJobContext.id}-${emp.id}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                          jobId: lastJobContext.id,
                          employeeId: emp.id,
                          date: logDate,
                          hours: hours,
                          phase: 'Generica (Import)',
                          notes: 'Importato da Excel'
                      });
                      logsCreated++;
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
                  alert(`Importazione riuscita!\n- Commesse: ${jobsCreated} nuove, ${jobsUpdated} aggiornate\n- Ore registrate: ${logsCreated}\n- Nuovi dipendenti: ${empsBatchMap.size}`);
                  window.location.reload();
              } catch (err) {
                  console.error("Errore Database:", err);
                  alert("Errore tecnico durante il salvataggio su Firebase. Verifica la console.");
              }
          } else {
              alert("Nessun dato valido trovato nel file.");
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

  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { standardHours: 0, overtime: 0, isLate: false, isAnomaly: false, isAbsent: false, firstIn: null, lastOut: null, lunchOut: null, lunchIn: null, records: [], justification: null, firstInId: null, lunchOutId: null, lunchInId: null, lastOutId: null };

    const overtimeSnap = settings.overtimeSnapMinutes || 30;
    const permessoSnap = settings.permessoSnapMinutes || 15;
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); 
    const todayStr = new Date().toISOString().split('T')[0];
    const isWorkDay = (emp.workDays || [1,2,3,4,5]).includes(dayOfWeek);
    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    
    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let firstIn = null, firstInId = null, firstInMins = 0;
    let lunchOut = null, lunchOutId = null, lunchOutMins = 0;
    let lunchIn = null, lunchInId = null, lunchInMins = 0;
    let lastOut = null, lastOutId = null, lastOutMins = 0;

    const getMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
    
    const parseTimeStr = (t: string | undefined | null) => { 
        if (!t) return 0;
        const parts = t.split(':');
        if (parts.length < 2) return 0;
        const [h, m] = parts.map(Number); 
        if (isNaN(h) || isNaN(m)) return 0;
        return h * 60 + m; 
    };

    if (dayAttendance.length > 0 && dayAttendance[0].type === 'ENTRATA') {
        const d = new Date(dayAttendance[0].timestamp);
        firstIn = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        firstInMins = getMinutes(d);
        firstInId = dayAttendance[0].id;
    }
    
    if (dayAttendance.length >= 2 && dayAttendance[1].type === 'USCITA') {
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

    let standardHours = 0;
    let overtime = 0;
    const schStartM = parseTimeStr(emp.scheduleStartMorning || "08:30");
    const schEndM = parseTimeStr(emp.scheduleEndMorning || "12:30");
    const schStartA = parseTimeStr(emp.scheduleStartAfternoon || "13:30");
    const schEndA = parseTimeStr(emp.scheduleEndAfternoon || "17:30");

    if (firstIn && (lunchOut || lastOut)) {
        const exitMins = lunchOut ? lunchOutMins : lastOutMins; 
        const effectiveStart = Math.max(firstInMins, schStartM);
        const effectiveEnd = Math.min(exitMins, schEndM);
        if (effectiveEnd > effectiveStart) standardHours += (effectiveEnd - effectiveStart) / 60;
    }

    if (lunchIn && lastOut) {
        const effectiveStart = Math.max(lunchInMins, schStartA);
        let effectiveEnd = lastOutMins;
        if (lastOutMins < schEndA) {
            const rawMissing = schEndA - lastOutMins;
            const deductionMinutes = Math.ceil(rawMissing / permessoSnap) * permessoSnap;
            effectiveEnd = schEndA - deductionMinutes;
        } else {
            effectiveEnd = schEndA;
        }
        if (effectiveEnd > effectiveStart) standardHours += (effectiveEnd - effectiveStart) / 60;
        if (lastOutMins > schEndA) {
            const diffMinutes = lastOutMins - schEndA;
            const blocks = Math.floor(diffMinutes / overtimeSnap);
            overtime += blocks * (overtimeSnap / 60);
        }
    } else if (!lunchOut && firstIn && lastOut) {
        if (lastOutMins > schEndA) {
             const diffMinutes = lastOutMins - schEndA;
             const blocks = Math.floor(diffMinutes / overtimeSnap);
             overtime += blocks * (overtimeSnap / 60);
        }
    }

    let isLate = false, isAnomaly = false, isAbsent = false;
    if (firstIn && !justification) {
        const limitMinutes = schStartM + (emp.toleranceMinutes || 10);
        if (firstInMins > limitMinutes) isLate = true;
    }
    if (dateStr < todayStr && dayAttendance.length % 2 !== 0) isAnomaly = true;
    if (dateStr < todayStr && isWorkDay && dayAttendance.length === 0 && !justification) isAbsent = true;

    return { standardHours, overtime, isLate, isAnomaly, isAbsent, firstIn, lunchOut, lunchIn, lastOut, firstInId, lunchOutId, lunchInId, lastOutId, records: dayAttendance, justification };
  };

  const getPayrollData = () => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let totalWorked = 0, totalOvertime = 0, ferieCount = 0, malattiaCount = 0, permessoHours = 0, lateCount = 0, absenceCount = 0, daysWorked = 0;
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

  const handleTimeChange = (empId: string, dateStr: string, newTime: string, existingId: string | null, type: 'ENTRATA' | 'USCITA') => {
      if (!newTime) { if (existingId) onDeleteAttendance(existingId); return; }
      const record: AttendanceRecord = { id: existingId || Date.now().toString() + Math.random().toString().slice(2,5), employeeId: empId, type: type, timestamp: `${dateStr}T${newTime}:00` };
      onSaveAttendance(record);
  }
  const setJustificationForDay = (empId: string, dateStr: string, type: JustificationType, hours: number = 0) => { onSaveJustification({ id: `${empId}-${dateStr}`, employeeId: empId, date: dateStr, type, hoursOffset: hours }); };
  
  const handleSaveJobForm = () => { 
      if (!isEditingJob?.code) return; 
      onSaveJob({
          ...isEditingJob, 
          id: isEditingJob.id || Date.now().toString(), 
          status: isEditingJob.status || JobStatus.PLANNED, 
          priority: isEditingJob.priority || 3,
          creationDate: isEditingJob.creationDate || new Date().toISOString().split('T')[0] 
      } as Job); 
      setIsEditingJob(null); 
  };

  const handleSaveVehicleForm = () => {
      if (!isEditingVehicle?.name || !onSaveVehicle) return;
      onSaveVehicle({
          id: isEditingVehicle.id || Date.now().toString(),
          name: isEditingVehicle.name,
          plate: isEditingVehicle.plate || '',
          status: isEditingVehicle.status || 'AVAILABLE',
          currentDriverId: isEditingVehicle.currentDriverId,
          lastCheckOut: isEditingVehicle.lastCheckOut
      });
      setIsEditingVehicle(null);
  }

  const handleDeleteVehicle = (id: string) => {
      if (confirm("Sei sicuro di voler eliminare questo mezzo?") && onDeleteVehicle) {
          onDeleteVehicle(id);
      }
  }

  const handleArchiveJob = (job: Job) => {
      if (confirm(`Vuoi archiviare la commessa ${job.code}? Sparirà dalla lista principale ma rimarrà nei report.`)) {
          const archiveYear = new Date().getFullYear();
          onSaveJob({ ...job, isArchived: true, archiveYear });
      }
  };

  const handleRestoreJob = (job: Job) => {
      if (confirm(`Vuoi ripristinare la commessa ${job.code}?`)) {
          onSaveJob({ ...job, isArchived: false, archiveYear: undefined });
      }
  }

  const handleSaveEmpForm = () => { if (!isEditingEmp?.name) return; onSaveEmployee({...isEditingEmp, id: isEditingEmp.id || Date.now().toString(), scheduleStartMorning: isEditingEmp.scheduleStartMorning || "08:30", scheduleEndMorning: isEditingEmp.scheduleEndMorning || "12:30", scheduleStartAfternoon: isEditingEmp.scheduleStartAfternoon || "13:30", scheduleEndAfternoon: isEditingEmp.scheduleEndAfternoon || "17:30", toleranceMinutes: isEditingEmp.toleranceMinutes || 10, workDays: isEditingEmp.workDays || [1,2,3,4,5]} as Employee); setIsEditingEmp(null); }
  const handleBulkStatusChange = (status: JobStatus) => { selectedJobIds.forEach(id => { const job = jobs.find(j => j.id === id); if (job) onSaveJob({ ...job, status }); }); setSelectedJobIds(new Set()); }
  const handleUpdatePhase = (log: WorkLog) => { onUpdateLog({ ...log, phase: tempPhase }); setEditingLogId(null); setTempPhase(''); }
  const togglePermission = (role: string, tabId: string) => { const currentTabs = tempPermissions[role] || []; setTempPermissions({ ...tempPermissions, [role]: currentTabs.includes(tabId) ? currentTabs.filter(t => t !== tabId) : [...currentTabs, tabId] }); }
  const savePermissions = () => { onSavePermissions(tempPermissions); alert("Permessi aggiornati!"); }
  
  const payrollStats = useMemo(() => getPayrollData(), [employees, attendance, justifications, selectedMonth]);

  const handleExportSummary = () => {
      const data = payrollStats.map(stat => ({
          'Dipendente': stat.name,
          'Ruolo': stat.role,
          'Giorni Presenza': stat.daysWorked,
          'Ore Ordinarie': stat.totalWorked.toFixed(2),
          'Straordinari': stat.totalOvertime.toFixed(2),
          'Ferie (gg)': stat.ferieCount,
          'Malattia (gg)': stat.malattiaCount,
          'Permessi (h)': stat.permessoHours,
          'Assenze Ingiustificate': stat.absenceCount,
          'Ritardi': stat.lateCount
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Riepilogo Paghe");
      writeFile(wb, `Riepilogo_Paghe_${selectedMonth}.xlsx`);
  };

  const handleExportTimecard = (empId: string) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const rows = [];
      
      for(let d=1; d<=daysInMonth; d++) {
          const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
          const stats = calculateDailyStats(emp.id, dateStr);
          rows.push({
              'Data': dateStr,
              'Entrata': stats.firstIn || '',
              'Uscita Pausa': stats.lunchOut || '',
              'Rientro Pausa': stats.lunchIn || '',
              'Uscita': stats.lastOut || '',
              'Ore Ordinarie': stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '',
              'Straordinari': stats.overtime > 0 ? stats.overtime.toFixed(2) : '',
              'Giustificativo': stats.justification ? stats.justification.type : '',
              'Note': [stats.isLate ? 'RITARDO' : '', stats.isAbsent ? 'ASSENZA' : '', stats.isAnomaly ? 'ANOMALIA' : ''].filter(Boolean).join(', ')
          });
      }

      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, `Cartellino_${emp.name.replace(/\s+/g, '_')}`);
      writeFile(wb, `Cartellino_${emp.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
  };

  if (availableTabs.length === 0 && !isGodMode) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
              <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm max-w-md">
                  <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
                  <p className="text-slate-600 mb-6 italic">Il tuo profilo non ha permessi configurati per accedere alla Dashboard Amministrativa.</p>
                  <p className="text-sm text-slate-400">Contatta l'amministratore del sistema.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:max-w-none bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING ? 'Pannello Amministrazione' : 'Dashboard Aziendale'}</h1>
          <p className="text-slate-500">
              {(currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING) && 'Gestione Presenze e Paghe'}
              {currentUserRole === Role.DIRECTION && 'Business Intelligence Completa'}
              {currentUserRole === Role.SYSTEM_ADMIN && 'Pannello di Controllo Sistemista'}
              {currentUserRole !== Role.SYSTEM_ADMIN && currentUserRole !== Role.DIRECTION && currentUserRole !== Role.ADMIN && 'Gestione Commesse e Clienti'}
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200 print:hidden bg-white px-6 rounded-t-xl">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              {tab.icon && <tab.icon size={16}/>} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'OVERVIEW' && (
             <>
            <div className="flex justify-between items-center mb-6 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    <Filter size={18} /> <span className="font-semibold text-sm">Filtra Report per Data:</span>
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
                        <div><p className="text-slate-500 text-sm font-medium">Commesse Attive</p><h3 className="text-2xl font-bold text-slate-800">{overviewJobStats.filter(j => j.status === JobStatus.IN_PROGRESS).length}</h3></div>
                        <Briefcase className="text-blue-500 bg-blue-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">In Imballaggio</p><h3 className="text-2xl font-bold text-orange-600">{packagingJobs.length}</h3></div>
                        <Package className="text-orange-500 bg-orange-50 p-2 rounded-lg" size={40} />
                    </div>
                    {packagingJobs.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 border-t pt-2 max-h-20 overflow-y-auto">
                            {packagingJobs.map(j => <div key={j.id} className="truncate">• {j.code} - <span className="font-semibold">{j.clientName}</span></div>)}
                        </div>
                    )}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">Valore Produzione</p><h3 className="text-2xl font-bold text-slate-800">€ {overviewJobStats.reduce((acc, j) => acc + j.budgetValue, 0).toLocaleString()}</h3></div>
                        <TrendingUp className="text-green-500 bg-green-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">Commesse a Rischio</p><h3 className="text-2xl font-bold text-red-600">{overviewJobStats.filter(j => j.profitMargin < 0 || j.isOverBudget).length}</h3></div>
                        <AlertTriangle className="text-red-500 bg-red-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:grid-cols-2 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-6 text-slate-700">Ore Lavorate per Cliente</h3>
                    <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={clientData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-6 text-slate-700">Stato Avanzamento Commesse</h3>
                    <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5} dataKey="value" label>{statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:border-none print:shadow-none print:p-0 print-section">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <h3 className="text-xl font-bold text-slate-800">Report Aziendale Dettagliato</h3>
                    <button onClick={() => window.print()} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 border p-2 rounded hover:bg-slate-50"><Printer size={18} /> Stampa Report</button>
                </div>
                <div className="hidden print:block mb-8 border-b pb-4">
                    <h1 className="text-2xl font-bold">Report Aziendale Integrato</h1>
                    <p className="text-slate-500">Data Stampa: {new Date().toLocaleDateString()} {filterStartDate ? ` | Filtro: ${new Date(filterStartDate).toLocaleDateString()} - ${filterEndDate ? new Date(filterEndDate).toLocaleDateString() : 'Oggi'}` : ''}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                    <div className="border rounded-lg p-4 bg-slate-50 print:bg-white print:border-slate-300">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-green-600"/> Top Clienti (Fatturato)</h4>
                        <ul className="space-y-2 text-sm">{topClientsByRevenue.map(([client, value], idx) => (<li key={client} className="flex justify-between border-b border-slate-200 pb-1"><span className="font-medium text-slate-700">{idx+1}. {client}</span><span className="font-bold text-green-700">€ {value.toLocaleString()}</span></li>))}</ul>
                    </div>
                    <div className="border rounded-lg p-4 bg-red-50 print:bg-white print:border-red-200">
                        <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-red-600"/> Sforamento Budget</h4>
                        <ul className="space-y-2 text-sm">{overBudgetClients.map(([client, stats], idx) => (<li key={client} className="flex justify-between border-b border-red-100 pb-1"><span className="font-medium text-red-900">{client}</span><span className="font-bold text-red-700">+{stats.over.toFixed(0)} h</span></li>))} {overBudgetClients.length === 0 && <li className="text-slate-500 italic">Nessun cliente fuori budget.</li>}</ul>
                    </div>
                    <div className="border rounded-lg p-4 bg-blue-50 print:bg-white print:border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><Users size={18} className="text-blue-600"/> Efficienza per Fase</h4>
                        <div className="space-y-2 text-sm max-h-48 overflow-y-auto print:max-h-none print:overflow-visible">{phaseEfficiency.map((stat) => (<div key={stat.phase} className="flex justify-between border-b border-blue-100 pb-1"><span className="font-medium text-blue-900 text-xs uppercase">{stat.phase}</span><span className="text-slate-600 text-xs text-right"><span className="font-bold">{stat.champion}</span> ({stat.hours}h)</span></div>))}</div>
                    </div>
                    <div className="border rounded-lg p-4 bg-orange-50 print:bg-white print:border-orange-200">
                         <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Timer size={18} className="text-orange-600"/> Scadenze Imminenti</h4>
                         <ul className="space-y-2 text-sm">
                            {expiringJobs.map(j => (
                                <li key={j.id} className="flex justify-between items-center border-b border-orange-100 pb-1">
                                    <div className="flex flex-col overflow-hidden mr-2">
                                        <span className="font-bold text-orange-900 truncate text-xs">{j.code}</span>
                                        <span className="text-[10px] text-orange-800 truncate">{j.clientName}</span>
                                    </div>
                                    <span className="font-bold text-orange-700 whitespace-nowrap text-xs">{new Date(j.deadline).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'})}</span>
                                </li>
                            ))}
                            {expiringJobs.length === 0 && <li className="text-slate-500 italic">Nessuna scadenza prossima.</li>}
                        </ul>
                    </div>
                    <div className="border rounded-lg p-4 bg-purple-50 print:bg-white print:border-purple-200">
                        <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2"><Star size={18} className="text-purple-600"/> Top Operatori (Ore)</h4>
                         <ul className="space-y-2 text-sm">{activeOperators.map((op, idx) => (<li key={idx} className="flex justify-between border-b border-purple-100 pb-1"><span className="font-medium text-purple-900">{op.name}</span><span className="font-bold text-purple-700">{op.hours.toFixed(1)} h</span></li>))}</ul>
                    </div>
                     <div className="border rounded-lg p-4 bg-gray-50 print:bg-white print:border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Clock size={18} className="text-gray-600"/> Ultime Attività</h4>
                         <ul className="space-y-2 text-sm">{recentActivities.map((log, idx) => (<li key={idx} className="flex justify-between border-b border-gray-200 pb-1"><div className="flex flex-col"><span className="font-medium text-gray-900 text-xs">{log.jobCode}</span><span className="text-[10px] text-gray-500">{log.empName}</span></div><span className="font-bold text-gray-700 text-xs">{log.phase}</span></li>))}</ul>
                    </div>
                </div>
            </div>
            </>
        )}
        
        {activeTab === 'JOBS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <div className="flex items-center gap-4 flex-wrap flex-1">
                        <h3 className="font-bold text-slate-700">Analisi Dettagliata Commesse</h3>
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

                        <div className="flex items-center gap-2 text-sm bg-white p-1 rounded border border-slate-200">
                            <Calendar size={14} className="text-slate-400 ml-1"/>
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                            <span className="text-slate-300">-</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="outline-none text-slate-600 w-28"/>
                            {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                        </div>
                        {selectedJobIds.size > 0 && (<div className="flex items-center gap-2 bg-white px-3 py-1 rounded shadow-sm border border-slate-200"><span className="text-xs font-bold text-blue-600">{selectedJobIds.size} selezionati</span><div className="h-4 w-px bg-slate-300 mx-1"></div><button onClick={() => handleBulkStatusChange(JobStatus.COMPLETED)} className="text-xs hover:text-green-600 font-medium">Completata</button><button onClick={() => handleBulkStatusChange(JobStatus.IN_PROGRESS)} className="text-xs hover:text-blue-600 font-medium">In Corso</button><button onClick={() => handleBulkStatusChange(JobStatus.ON_HOLD)} className="text-xs hover:text-orange-600 font-medium">Sospesa</button></div>)}
                    </div>
                    <div className="flex gap-2">{isGodMode && <button onClick={() => handleExcelExportJobs(sortedJobStats)} className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-100 border border-green-200 transition"><FileSpreadsheet size={16}/> Esporta Excel</button>}</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 w-10"><input type="checkbox" className="rounded border-slate-300" onChange={(e) => {if(e.target.checked) setSelectedJobIds(new Set(sortedJobStats.map(j => j.id))); else setSelectedJobIds(new Set());}} checked={selectedJobIds.size === sortedJobStats.length && sortedJobStats.length > 0}/></th>
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
                                    <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300" checked={selectedJobIds.has(job.id)} onChange={(e) => {const newSet = new Set(selectedJobIds); if (e.target.checked) newSet.add(job.id); else newSet.delete(job.id); setSelectedJobIds(newSet);}}/></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)}>{job.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{job.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500"><div className="flex items-center gap-2"><div className="w-24 bg-slate-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${job.isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((job.totalHoursUsed / job.budgetHours) * 100, 100)}%` }}></div></div><span>{job.totalHoursUsed.toFixed(1)}/{job.budgetHours}</span></div></td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${job.profitMargin < 0 ? 'text-red-600' : 'text-green-600'}`}>€ {job.profitMargin.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{job.deadline ? new Date(job.deadline).toLocaleDateString('it-IT') : '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.status === JobStatus.IN_PROGRESS ? 'bg-green-100 text-green-800' : job.status === JobStatus.PLANNED ? 'bg-blue-100 text-blue-800' : job.status === JobStatus.COMPLETED ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}>{job.status}</span></td>
                                    <td className="px-6 py-4 text-right"><Info size={16} className="text-slate-400 hover:text-blue-500 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {selectedJobForAnalysis && (
                     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                <div><h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="text-blue-600" /> Dettaglio Commessa: {jobs.find(j => j.id === selectedJobForAnalysis)?.code}</h3><p className="text-slate-500">{jobs.find(j => j.id === selectedJobForAnalysis)?.clientName} - {jobs.find(j => j.id === selectedJobForAnalysis)?.description}</p></div>
                                <button onClick={() => setSelectedJobForAnalysis(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-500"/></button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-8">
                                <div><h4 className="text-lg font-semibold mb-3 text-slate-700">Riepilogo per Operatore</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Object.entries(logs.filter(l => l.jobId === selectedJobForAnalysis).reduce((acc, log) => {const empName = employees.find(e => e.id === log.employeeId)?.name || 'Sconosciuto'; acc[empName] = (acc[empName] || 0) + log.hours; return acc;}, {} as {[key:string]: number})).map(([name, hours]) => (<div key={name} className="bg-slate-50 p-4 rounded-lg border border-slate-100"><div className="text-sm text-slate-500 font-medium">Operatore</div><div className="font-bold text-slate-800 truncate">{name}</div><div className="text-2xl font-bold text-blue-600 mt-1">{(hours as number).toFixed(1)} <span className="text-sm font-normal text-slate-500">h</span></div></div>))}</div></div>
                                <div><h4 className="text-lg font-semibold mb-3 text-slate-700">Cronologia Lavori</h4><div className="border border-slate-200 rounded-lg overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Operatore</th><th className="px-4 py-3">Fase</th><th className="px-4 py-3">Ore</th><th className="px-4 py-3">Note</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.filter(l => l.jobId === selectedJobForAnalysis).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(log => (<tr key={log.id} className="hover:bg-slate-50 group"><td className="px-4 py-3 text-slate-600">{new Date(log.date).toLocaleDateString()}</td><td className="px-4 py-3 font-medium">{employees.find(e => e.id === log.employeeId)?.name}</td><td className="px-4 py-3">{editingLogId === log.id ? (<select autoFocus value={tempPhase} onChange={(e) => setTempPhase(e.target.value)} onBlur={() => handleUpdatePhase(log)} className="border rounded p-1 text-xs">{['Generica (Import)', ...settings.workPhases].map(p => <option key={p} value={p}>{p}</option>)}</select>) : (<button onClick={() => { setEditingLogId(log.id); setTempPhase(log.phase); }} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 hover:bg-blue-100 flex items-center gap-1">{log.phase} <Edit2 size={10} className="opacity-0 group-hover:opacity-50"/></button>)}</td><td className="px-4 py-3 font-bold">{log.hours}</td><td className="px-4 py-3 text-slate-500 italic truncate max-w-xs">{log.notes}</td></tr>))}</tbody></table></div></div>
                            </div>
                             <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end"><button onClick={() => setSelectedJobForAnalysis(null)} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition">Chiudi Dettaglio</button></div>
                        </div>
                     </div>
                )}
            </div>
        )}

        {activeTab === 'HR' && (
             <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="text-blue-600"/>
                    <label className="text-sm font-medium text-slate-700">Mese di Competenza:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-2 py-1"/>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-700">Riepilogo Presenze Mensile</h3><button onClick={handleExportSummary} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition"><FileSpreadsheet size={16}/> Export Riepilogo Paghe</button></div>
                    <table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dipendente</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Giorni Pres.</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ore Ordinarie</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Straordinari</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assenze/Ferie/Mal.</th><th className="px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-slate-200">{payrollStats.map(stat => (<tr key={stat.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium text-slate-900">{stat.name}<div className="text-xs text-slate-400">{stat.role}</div></td><td className="px-6 py-4 text-slate-500">{stat.daysWorked}</td><td className="px-6 py-4 font-bold text-slate-700">{stat.totalWorked.toFixed(2)}</td><td className="px-6 py-4 text-slate-500">{stat.totalOvertime > 0 ? <span className="text-orange-600 font-bold">{stat.totalOvertime.toFixed(2)}</span> : '-'}</td><td className="px-6 py-4 text-xs space-y-1">{stat.absenceCount > 0 && <div className="text-red-600 font-bold">Assenze Ing.: {stat.absenceCount} gg</div>}{stat.ferieCount > 0 && <div className="text-blue-600">Ferie: {stat.ferieCount} gg</div>}{stat.malattiaCount > 0 && <div className="text-purple-600">Malattia: {stat.malattiaCount} gg</div>}</td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedEmpForDetail(stat.id)} className="bg-slate-100 hover:bg-blue-50 text-blue-600 px-3 py-1 rounded border border-slate-200 text-sm font-medium transition">Gestisci / Cartellino</button></td></tr>))}</tbody></table>
                </div>
                {selectedEmpForDetail && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl"><div><h3 className="text-2xl font-bold text-slate-800">{employees.find(e => e.id === selectedEmpForDetail)?.name}</h3><p className="text-slate-500 text-sm">Cartellino Presenze: {new Date(selectedMonth).toLocaleDateString('it-IT', {month:'long', year:'numeric'})}</p></div><div className="flex gap-2"><button onClick={() => handleExportTimecard(selectedEmpForDetail)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><FileSpreadsheet size={18}/> Scarica Excel</button><button onClick={() => setSelectedEmpForDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-500"/></button></div></div>
                            <div className="flex-1 overflow-auto p-6"><table className="w-full text-sm border-collapse"><thead><tr className="bg-slate-100 text-slate-600 border-b border-slate-300"><th className="p-2 border border-slate-200 text-left">Data</th><th className="p-2 border border-slate-200 text-center w-20">Entrata</th><th className="p-2 border border-slate-200 text-center w-20">Uscita (P)</th><th className="p-2 border border-slate-200 text-center w-20">Entrata (P)</th><th className="p-2 border border-slate-200 text-center w-20">Uscita</th><th className="p-2 border border-slate-200 text-center w-20 bg-blue-50 font-bold text-blue-800">Ore Ord.</th><th className="p-2 border border-slate-200 text-center w-20 bg-orange-50 font-bold text-orange-800">Straord.</th><th className="p-2 border border-slate-200 text-center w-24">Giustificativo</th><th className="p-2 border border-slate-200 text-center w-16">Note</th></tr></thead><tbody>{Array.from({length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()}, (_, i) => i + 1).map(day => {const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`; const stats = calculateDailyStats(selectedEmpForDetail, dateStr); const dateObj = new Date(dateStr); const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6; let rowClass = "hover:bg-slate-50"; if (isWeekend) rowClass = "bg-slate-50 text-slate-400"; if (stats.isAbsent) rowClass = "bg-red-50"; if (stats.isAnomaly) rowClass = "bg-orange-50"; return (<tr key={day} className={`border-b border-slate-200 ${rowClass}`}><td className="p-2 border border-slate-200"><div className="font-bold">{String(day).padStart(2,'0')}</div><div className="text-xs uppercase">{dateObj.toLocaleDateString('it-IT', {weekday:'short'})}</div></td><td className={`p-1 border border-slate-200 text-center ${stats.isLate ? 'text-orange-600 font-bold' : ''}`}><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.firstIn || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.firstInId, 'ENTRATA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lunchOut || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lunchOutId, 'USCITA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lunchIn || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lunchInId, 'ENTRATA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lastOut || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lastOutId, 'USCITA')} /></td><td className="p-2 border border-slate-200 text-center font-bold">{stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '-'}</td><td className="p-2 border border-slate-200 text-center text-orange-600 font-bold">{stats.overtime > 0 ? stats.overtime.toFixed(2) : ''}</td><td className="p-2 border border-slate-200 text-center"><select className={`w-full text-xs p-1 border rounded ${stats.justification ? 'bg-blue-100 font-bold text-blue-800 border-blue-300' : 'bg-white'}`} value={stats.justification?.type || ''} onChange={(e) => {if (e.target.value) setJustificationForDay(selectedEmpForDetail, dateStr, e.target.value as JustificationType); else onSaveJustification({ ...stats.justification!, id: `${selectedEmpForDetail}-${dateStr}`, type: JustificationType.STANDARD });}}><option value="">-</option><option value={JustificationType.FERIE}>FERIE</option><option value={JustificationType.MALATTIA}>MALATTIA</option><option value={JustificationType.PERMESSO}>PERMESSO</option><option value={JustificationType.FESTIVO}>FESTIVO</option><option value={JustificationType.INGIUSTIFICATO}>INGIUSTIFICATO</option></select></td><td className="p-2 border border-slate-200 text-center text-xs">{stats.isLate && <span className="block text-orange-600 font-bold">RITARDO</span>}{stats.isAbsent && <span className="block text-red-600 font-bold">ASSENZA</span>}{stats.isAnomaly && <span className="block text-orange-500 font-bold">ANOMALIA</span>}</td></tr>)})}</tbody></table></div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {activeTab === 'FLEET' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> Stato Parco Mezzi</h2>
                            <button onClick={() => setIsEditingVehicle({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuovo Mezzo</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehicles.map(vehicle => {
                                const isAvailable = vehicle.status === 'AVAILABLE';
                                const driver = employees.find(e => e.id === vehicle.currentDriverId);
                                
                                return (
                                    <div key={vehicle.id} className={`p-4 rounded-xl border flex flex-col gap-2 relative group ${isAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-800">{vehicle.name}</h3>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {isAvailable ? 'DISPONIBILE' : 'IN USO'}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 font-mono text-sm">{vehicle.plate}</p>
                                        {!isAvailable && driver && (
                                            <div className="mt-2 flex items-center gap-2 text-red-700 font-medium text-sm">
                                                <User size={16} /> In uso da: {driver.name}
                                                <br/>
                                                <span className="text-xs opacity-70">dal {vehicle.lastCheckOut ? new Date(vehicle.lastCheckOut).toLocaleString() : '-'}</span>
                                            </div>
                                        )}
                                        {isAvailable && (
                                            <div className="mt-2 flex items-center gap-2 text-green-700 font-medium text-sm">
                                                <CheckCircle2 size={16} /> Parcheggiato in sede
                                            </div>
                                        )}
                                        
                                        <div className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-white/80 p-1 rounded shadow-sm">
                                            <button onClick={() => setIsEditingVehicle(vehicle)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14}/></button>
                                            <button onClick={() => handleDeleteVehicle(vehicle.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                )
                            })}
                            {vehicles.length === 0 && <p className="text-slate-400 italic col-span-2 text-center py-8">Nessun veicolo registrato.</p>}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-slate-600"/> Registro Storico</h2>
                            {fleetSelectedDate && (
                                <button onClick={() => setFleetSelectedDate(null)} className="text-xs text-red-600 hover:underline">Rimuovi Filtro</button>
                            )}
                        </div>
                        
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            <div className="w-full md:w-1/2 p-4 border-r border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => setFleetCurrentMonth(new Date(fleetCurrentMonth.getFullYear(), fleetCurrentMonth.getMonth() - 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20}/></button>
                                    <span className="font-bold text-slate-700">{fleetCurrentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={() => setFleetCurrentMonth(new Date(fleetCurrentMonth.getFullYear(), fleetCurrentMonth.getMonth() + 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20}/></button>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
                                    {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => <div key={d}>{d}</div>)}
                                </div>
                                <div className="grid grid-cols-7 gap-1 flex-1 content-start">
                                    {Array.from({ length: new Date(fleetCurrentMonth.getFullYear(), fleetCurrentMonth.getMonth(), 1).getDay() === 0 ? 6 : new Date(fleetCurrentMonth.getFullYear(), fleetCurrentMonth.getMonth(), 1).getDay() - 1 }).map((_, i) => <div key={`empty-${i}`} />)}
                                    {Array.from({ length: new Date(fleetCurrentMonth.getFullYear(), fleetCurrentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                        const day = i + 1;
                                        const y = fleetCurrentMonth.getFullYear();
                                        const m = String(fleetCurrentMonth.getMonth() + 1).padStart(2, '0');
                                        const d = String(day).padStart(2, '0');
                                        const dateStr = `${y}-${m}-${d}`;
                                        
                                        const hasActivity = vehicleLogs?.some(l => l.timestampOut.startsWith(dateStr));
                                        const isSelected = fleetSelectedDate === dateStr;
                                        
                                        return (
                                            <button 
                                                key={day} 
                                                onClick={() => setFleetSelectedDate(isSelected ? null : dateStr)}
                                                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition relative mx-auto
                                                    ${isSelected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}
                                                    ${hasActivity && !isSelected ? 'font-bold' : ''}
                                                `}
                                            >
                                                {day}
                                                {hasActivity && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 text-xs text-slate-400 text-center border-t pt-2">
                                    Clicca su un giorno per filtrare i movimenti (utile per controllo multe)
                                </div>
                            </div>

                            <div className="w-full md:w-1/2 overflow-y-auto p-4 bg-slate-50/50">
                                {fleetSelectedDate && <div className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider">Movimenti del {new Date(fleetSelectedDate).toLocaleDateString()}</div>}
                                <div className="space-y-3">
                                    {vehicleLogs
                                        .filter(log => !fleetSelectedDate || log.timestampOut.startsWith(fleetSelectedDate))
                                        .sort((a,b) => new Date(b.timestampOut).getTime() - new Date(a.timestampOut).getTime())
                                        .map(log => {
                                            const v = vehicles.find(v => v.id === log.vehicleId);
                                            const e = employees.find(e => e.id === log.employeeId);
                                            return (
                                                <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-slate-800 text-sm">{e?.name || 'Sconosciuto'}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(log.timestampOut).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 flex items-center gap-1 mb-2"><Truck size={12}/> {v?.name || 'Veicolo Eliminato'} <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">({v?.plate})</span></div>
                                                    <div className="text-xs grid grid-cols-2 gap-2 border-t pt-2">
                                                        <div>
                                                            <div className="text-[10px] text-slate-400 uppercase">Ritiro</div>
                                                            <div className="font-mono">{new Date(log.timestampOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 uppercase">Riconsegna</div>
                                                            <div className={`font-mono ${!log.timestampIn ? 'text-orange-500 font-bold' : ''}`}>
                                                                {log.timestampIn ? new Date(log.timestampIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'IN CORSO'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                    })}
                                    {vehicleLogs.filter(log => !fleetSelectedDate || log.timestampOut.startsWith(fleetSelectedDate)).length === 0 && (
                                        <p className="text-slate-400 italic text-sm text-center py-4">Nessun movimento trovato.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {isEditingVehicle && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                            <h3 className="text-lg font-bold mb-4">{isEditingVehicle.id ? 'Modifica Veicolo' : 'Nuovo Veicolo'}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Nome Modello</label>
                                    <input type="text" className="w-full border p-2 rounded" value={isEditingVehicle.name || ''} onChange={e => setIsEditingVehicle({...isEditingVehicle, name: e.target.value})} placeholder="Es. Fiat Ducato"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Targa</label>
                                    <input type="text" className="w-full border p-2 rounded" value={isEditingVehicle.plate || ''} onChange={e => setIsEditingVehicle({...isEditingVehicle, plate: e.target.value})} placeholder="AA 000 BB"/>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button onClick={() => setIsEditingVehicle(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded">Annulla</button>
                                <button onClick={handleSaveVehicleForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'AI' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 {!settings.geminiApiKey ? (<div className="flex flex-col items-center justify-center py-12 text-center"><div className="bg-orange-100 p-4 rounded-full mb-4"><Key className="text-orange-500" size={32}/></div><h3 className="text-xl font-bold text-slate-800 mb-2">Configurazione Richiesta</h3><p className="text-slate-500 max-w-md mb-6">Per utilizzare l'analista AI, è necessario inserire una API Key di Google Gemini valida nelle impostazioni.</p><button onClick={() => {if(isSystem) setActiveTab('CONFIG')}} className="text-blue-600 font-bold hover:underline">Vai alla Configurazione</button></div>) : (
                 <>
                    <div className="flex items-center gap-3 mb-6"><div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg"><BrainCircuit size={24} /></div><div><h2 className="text-xl font-bold text-slate-800">Analista Aziendale IA</h2><p className="text-slate-500 text-sm">Analisi predittiva e insight sui dati aziendali</p></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">{customPrompts.map((prompt) => (<div key={prompt.id} className="relative group">{editingPromptId === prompt.id ? (<div className="p-3 bg-white border-2 border-blue-500 rounded-lg shadow-lg z-10 absolute top-0 left-0 w-full min-w-[200px]"><input type="text" className="w-full text-xs font-bold mb-2 border-b outline-none" value={tempPromptLabel} onChange={(e) => setTempPromptLabel(e.target.value)} placeholder="Etichetta"/><textarea className="w-full text-xs p-1 border rounded resize-none outline-none mb-2" rows={3} value={tempPromptText} onChange={(e) => setTempPromptText(e.target.value)} placeholder="Domanda per IA..."/><div className="flex justify-end gap-1"><button onClick={() => setEditingPromptId(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X size={14}/></button><button onClick={() => handleSavePrompt(prompt.id)} className="p-1 hover:bg-green-100 text-green-600 rounded"><Save size={14}/></button></div></div>) : (<button onClick={() => handleAskAI(prompt.prompt)} className="w-full p-3 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-lg text-left transition relative h-full flex flex-col justify-between group-hover:shadow-md"><span className="text-sm font-semibold text-slate-700 block mb-1">{prompt.label}</span><span className="text-xs text-slate-400 line-clamp-2">{prompt.prompt}</span><div onClick={(e) => { e.stopPropagation(); setEditingPromptId(prompt.id); setTempPromptLabel(prompt.label); setTempPromptText(prompt.prompt); }} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition"><Pencil size={12} /></div></button>)}</div>))}</div>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 min-h-[200px] mb-4 shadow-inner">{aiResponse ? (<div className="prose prose-sm max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />) : (<div className="text-center text-slate-400 py-16 flex flex-col items-center gap-3">{isLoadingAi ? <Loader2 className="animate-spin text-blue-500" size={32}/> : <div className="flex flex-col items-center"><BrainCircuit size={48} className="text-slate-300 mb-2"/><span>Seleziona una domanda rapida o scrivi la tua richiesta qui sotto.</span></div>}</div>)}</div>
                    <div className="flex gap-2 relative"><input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Fai una domanda libera sui tuoi dati..." className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none pl-12 shadow-sm"/><div className="absolute left-4 top-3.5 text-slate-400"><Info size={20}/></div><button onClick={() => handleAskAI()} disabled={!aiPrompt || isLoadingAi} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-sm">{isLoadingAi ? 'Analisi...' : 'Chiedi'}</button></div>
                 </>)}
            </div>
        )}

        {activeTab === 'MANAGE' && (
            <div className="space-y-6">
                <div className="flex gap-4 mb-6"><button onClick={() => setManageSubTab('JOBS')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'JOBS' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Commesse</button>{(canManageEmployees || isSystem) && <button onClick={() => setManageSubTab('EMPLOYEES')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'EMPLOYEES' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Dipendenti</button>}</div>
                {manageSubTab === 'JOBS' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Elenco Commesse</h2>
                            
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

                            <div className="flex gap-2">
                                <input type="file" accept=".xlsx, .xls, .xml" onChange={handleExcelImport} className="hidden" ref={fileInputRef} />
                                {(isGodMode) && <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"><FileSpreadsheet size={18} /> Importa/Aggiorna</button>}
                                {(isGodMode) && <button onClick={() => handleExcelExportJobs(sortedManageJobs)} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"><Download size={18} /> Export</button>}
                                {(isSystem) && <button onClick={handleResetJobs} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"><Eraser size={18} /> Svuota</button>}
                                <button onClick={() => { setIsEditingJob({}); setClientSearchTerm(''); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuova</button>
                            </div>
                        </div>
                        {isEditingJob && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingJob.id ? 'Modifica Commessa' : 'Nuova Commessa'}</h3><button onClick={() => setIsEditingJob(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Codice</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.code || ''} onChange={e => setIsEditingJob({...isEditingJob, code: e.target.value})} /></div>
                                        
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-slate-700">Cliente</label>
                                            <input 
                                                type="text" 
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                                value={isEditingJob.clientName || clientSearchTerm} 
                                                onChange={e => {
                                                    setClientSearchTerm(e.target.value);
                                                    setIsEditingJob({...isEditingJob, clientName: e.target.value});
                                                    setShowClientSuggestions(true);
                                                }}
                                                onFocus={() => setShowClientSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                                                placeholder="Cerca o inserisci nuovo..."
                                            />
                                            {showClientSuggestions && (isEditingJob.clientName || clientSearchTerm) && (
                                                <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-b-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                                                    {uniqueClients.filter(c => c.toLowerCase().includes((isEditingJob.clientName || clientSearchTerm).toLowerCase())).map(client => (
                                                        <li 
                                                            key={client} 
                                                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                            onClick={() => {
                                                                setIsEditingJob({...isEditingJob, clientName: client});
                                                                setClientSearchTerm(client);
                                                                setShowClientSuggestions(false);
                                                            }}
                                                        >
                                                            {client}
                                                        </li>
                                                    ))}
                                                    {uniqueClients.filter(c => c.toLowerCase().includes((isEditingJob.clientName || clientSearchTerm).toLowerCase())).length === 0 && (
                                                        <li className="px-3 py-2 text-slate-400 text-xs italic">Nessun cliente esistente trovato. Sarà creato nuovo.</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>

                                        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700">Descrizione</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.description || ''} onChange={e => setIsEditingJob({...isEditingJob, description: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Budget Ore</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetHours || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetHours: parseFloat(e.target.value)})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Valore (€)</label><input type="number" className="w-full border p-2 rounded" value={isEditingJob.budgetValue || ''} onChange={e => setIsEditingJob({...isEditingJob, budgetValue: parseFloat(e.target.value)})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Scadenza</label><input type="date" className="w-full border p-2 rounded" value={isEditingJob.deadline || ''} onChange={e => setIsEditingJob({...isEditingJob, deadline: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Data Inizio</label><input type="date" className="w-full border p-2 rounded" value={isEditingJob.creationDate || new Date().toISOString().split('T')[0]} onChange={e => setIsEditingJob({...isEditingJob, creationDate: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Priorità</label><div className="flex gap-1 mt-2">{[1,2,3,4,5].map(star => (<Star key={star} size={24} className={`cursor-pointer ${star <= (isEditingJob.priority || 3) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} onClick={() => setIsEditingJob({...isEditingJob, priority: star})}/>))}</div></div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Assegna a Operatore</label>
                                            <select className="w-full border p-2 rounded" value={isEditingJob.suggestedOperatorId || ''} onChange={e => setIsEditingJob({...isEditingJob, suggestedOperatorId: e.target.value})}>
                                                <option value="">Nessuno</option>
                                                {employees.filter(e => e.role !== Role.SYSTEM_ADMIN && e.role !== Role.DIRECTION && e.role !== Role.ADMIN && e.role !== Role.ACCOUNTING).map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Note Interne</label><textarea className="w-full border p-2 rounded resize-y min-h-[80px]" value={isEditingJob.notes || ''} onChange={e => setIsEditingJob({...isEditingJob, notes: e.target.value})} placeholder="Eventuali note tecniche o amministrative..."/></div>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsEditingJob(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annulla</button><button onClick={handleSaveJobForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button></div>
                                </div>
                            </div>
                        )}
                        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th onClick={() => requestSort('code', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Codice {renderSortArrow('code', manageJobSort)}</th><th onClick={() => requestSort('clientName', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Cliente {renderSortArrow('clientName', manageJobSort)}</th><th onClick={() => requestSort('priority', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer">Priorità {renderSortArrow('priority', manageJobSort)}</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data Inizio</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Budget/Valore</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stato</th><th className="px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-slate-200">{sortedManageJobs.map((job) => (<tr key={job.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium text-slate-900">{job.code}</td><td className="px-6 py-4 text-slate-500">{job.clientName}</td><td className="px-6 py-4 text-slate-500 flex gap-1">{Array.from({length: job.priority || 3}).map((_, i) => <Star key={i} size={12} className="fill-orange-400 text-orange-400"/>)}</td><td className="px-6 py-4 text-slate-500 text-xs">{job.creationDate ? new Date(job.creationDate).toLocaleDateString('it-IT') : '-'}</td><td className="px-6 py-4 text-slate-500">{job.budgetHours}h / €{job.budgetValue}</td><td className="px-6 py-4"><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{job.status}</span></td><td className="px-6 py-4 flex gap-2">
                            <button onClick={() => setIsEditingJob(job)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button>
                            {!job.isArchived && job.status === JobStatus.COMPLETED && (
                                <button onClick={() => handleArchiveJob(job)} className="text-slate-400 hover:text-orange-600" title="Archivia"><Archive size={18}/></button>
                            )}
                            {job.isArchived && (
                                <button onClick={() => handleRestoreJob(job)} className="text-orange-600 hover:text-green-600" title="Ripristina da Archivio"><RotateCcw size={18}/></button>
                            )}
                        </td></tr>))}
                        {sortedManageJobs.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-400 italic">Nessuna commessa trovata.</td></tr>
                        )}
                        </tbody></table></div>
                    </div>
                )}
                {manageSubTab === 'EMPLOYEES' && (canManageEmployees || isSystem) && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-800">Elenco Dipendenti</h2><button onClick={() => setIsEditingEmp({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><Plus size={18} /> Nuovo Dipendente</button></div>
                         {isEditingEmp && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingEmp.id ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h3><button onClick={() => setIsEditingEmp(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700">Nome e Cognome</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.name || ''} onChange={e => setIsEditingEmp({...isEditingEmp, name: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Ruolo</label><select className="w-full border p-2 rounded" value={isEditingEmp.role || Role.EMPLOYEE} onChange={e => setIsEditingEmp({...isEditingEmp, role: e.target.value as Role})}>{Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="block text-sm font-medium text-slate-700">Reparto</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.department || ''} onChange={e => setIsEditingEmp({...isEditingEmp, department: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Costo Orario (€)</label><input type="number" className="w-full border p-2 rounded" value={isEditingEmp.hourlyRate || ''} onChange={e => setIsEditingEmp({...isEditingEmp, hourlyRate: parseFloat(e.target.value)})} /></div><div className="border-t col-span-2 pt-4 mt-2 mb-2"><h4 className="font-bold text-slate-700 text-sm">Sicurezza Accessi</h4></div><div><label className="block text-sm font-medium text-slate-700">Codice NFC Badge</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.nfcCode || ''} onChange={e => setIsEditingEmp({...isEditingEmp, nfcCode: e.target.value})} placeholder="Es. NFC_123" /></div><div><label className="block text-sm font-medium text-slate-700">Codice NFC Secondario</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.nfcCode2 || ''} onChange={e => setIsEditingEmp({...isEditingEmp, nfcCode2: e.target.value})} placeholder="Badge alternativo" /></div><div><label className="block text-sm font-medium text-slate-700">PIN Accesso (4-6 cifre)</label><input type="text" className="w-full border p-2 rounded" value={isEditingEmp.pin || ''} onChange={e => setIsEditingEmp({...isEditingEmp, pin: e.target.value})} placeholder="Es. 1234" /></div><div className="border-t col-span-2 pt-4 mt-2 mb-2"><h4 className="font-bold text-slate-700 text-sm">Configurazione Orari</h4></div><div><label className="block text-sm font-medium text-slate-700">Inizio Mattina</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleStartMorning || '08:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartMorning: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Fine Mattina</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleEndMorning || '12:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndMorning: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Inizio Pomeriggio</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleStartAfternoon || '13:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartAfternoon: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Fine Pomeriggio</label><input type="time" className="w-full border p-2 rounded" value={isEditingEmp.scheduleEndAfternoon || '17:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndAfternoon: e.target.value})} /></div><div><label className="block text-sm font-medium text-slate-700">Tolleranza Ritardo (min)</label><input type="number" className="w-full border p-2 rounded" value={isEditingEmp.toleranceMinutes || 10} onChange={e => setIsEditingEmp({...isEditingEmp, toleranceMinutes: parseInt(e.target.value)})} /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Giorni Lavorativi</label><div className="flex gap-4 flex-wrap">{['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((dayName, idx) => (<label key={idx} className="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" checked={(isEditingEmp.workDays || [1,2,3,4,5]).includes(idx)} onChange={(e) => {const currentDays = isEditingEmp.workDays || [1,2,3,4,5]; let newDays; if(e.target.checked) newDays = [...currentDays, idx]; else newDays = currentDays.filter(d => d !== idx); setIsEditingEmp({...isEditingEmp, workDays: newDays});}}/>{dayName}</label>))}</div></div></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsEditingEmp(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annulla</button><button onClick={handleSaveEmpForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button></div></div></div>)}
                        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ruolo</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reparto</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Costo/h</th><th className="px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-slate-200">{employees.map((emp) => (<tr key={emp.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium text-slate-900">{emp.name}</td><td className="px-6 py-4 text-slate-500">{emp.role}</td><td className="px-6 py-4 text-slate-500">{emp.department}</td><td className="px-6 py-4 text-slate-500">€{emp.hourlyRate}</td>
                        <td className="px-6 py-4 flex items-center gap-2">
                            <button onClick={() => handleWriteNfc(emp)} className="text-purple-600 hover:text-purple-800 bg-purple-50 p-2 rounded" title="Scrivi Badge NFC"><Wifi size={18}/></button>
                            <button onClick={() => setIsEditingEmp(emp)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded"><Edit2 size={18}/></button>
                        </td></tr>))}</tbody></table></div>
                    </div>
                )}
            </div>
        )}

         {isWritingNfc && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6">
                <div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl relative">
                    <button onClick={() => setIsWritingNfc(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    
                    <div className="mb-6 flex justify-center">
                        <div className={`p-6 rounded-full ${nfcWriteStatus === 'WRITING' ? 'bg-blue-100 animate-pulse' : nfcWriteStatus === 'SUCCESS' ? 'bg-green-100' : nfcWriteStatus === 'ERROR' ? 'bg-red-100' : 'bg-slate-100'}`}>
                            <Wifi size={64} className={`${nfcWriteStatus === 'WRITING' ? 'text-blue-600' : nfcWriteStatus === 'SUCCESS' ? 'text-green-600' : nfcWriteStatus === 'ERROR' ? 'text-red-600' : 'text-slate-400'}`} />
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">Scrivi Badge NFC</h3>
                    <p className="text-slate-500 mb-6 font-medium">{isWritingNfc.name}</p>
                    
                    {nfcWriteStatus === 'IDLE' && <p className="text-sm text-slate-600 mb-4">In attesa di avvio...</p>}
                    {nfcWriteStatus === 'WRITING' && (
                        <div>
                            <p className="font-bold text-blue-600 animate-pulse mb-2">AVVICINA IL BADGE AL TELEFONO</p>
                            <p className="text-xs text-slate-400">Sto scrivendo il codice: <span className="font-mono bg-slate-100 px-1">{isWritingNfc.nfcCode || isWritingNfc.nfcCode2 || isWritingNfc.id}</span></p>
                        </div>
                    )}
                    {nfcWriteStatus === 'SUCCESS' && <p className="font-bold text-green-600 text-lg">Badge scritto con successo!</p>}
                    {nfcWriteStatus === 'ERROR' && <p className="font-bold text-red-600">Errore scrittura. Riprova.</p>}

                </div>
            </div>
        )}

        {activeTab === 'CONFIG' && isSystem && (
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="text-slate-600"/> Impostazioni Globali</h2>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6"><div><h3 className="font-bold text-slate-800 flex items-center gap-2"><Scan size={20}/> Modalità Badge NFC</h3><p className="text-sm text-slate-500">Se attiva, nasconde la lista operatori e richiede la scansione del badge o PIN.</p></div><button onClick={() => onSaveSettings({ ...settings, nfcEnabled: !settings.nfcEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.nfcEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.nfcEnabled ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div><label className="block text-sm font-medium text-slate-700 mb-1">Scatto Straordinari (minuti)</label><input type="number" className="w-full border p-2 rounded" value={settings.overtimeSnapMinutes || 30} onChange={(e) => onSaveSettings({...settings, overtimeSnapMinutes: parseInt(e.target.value)})} /><p className="text-xs text-slate-500 mt-1">Gli straordinari serali verranno conteggiati a blocchi di questi minuti.</p></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Scatto Permessi/Uscita Anticipata (minuti)</label><input type="number" className="w-full border p-2 rounded" value={settings.permessoSnapMinutes || 15} onChange={(e) => onSaveSettings({...settings, permessoSnapMinutes: parseInt(e.target.value)})} /><p className="text-xs text-slate-500 mt-1">L'uscita anticipata verrà dedotta solo al raggiungimento di questo scatto.</p></div></div>
                    
                    <div className="mb-6 border-b pb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2"><Key size={20}/> Integrazioni Esterne</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key (AI Analyst)</label>
                                <input type="password" value={settings.geminiApiKey || ''} onChange={(e) => onSaveSettings({...settings, geminiApiKey: e.target.value})} placeholder="sk-..." className="w-full border p-2 rounded"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL Backup (Pabbly/Zapier)</label>
                                <div className="flex gap-2">
                                    <input type="text" value={settings.backupWebhookUrl || ''} onChange={(e) => onSaveSettings({...settings, backupWebhookUrl: e.target.value})} placeholder="https://connect.pabbly.com/..." className="flex-1 border p-2 rounded"/>
                                    <button onClick={handleCloudBackupTest} className="bg-purple-50 text-purple-600 px-3 py-2 rounded border border-purple-200 hover:bg-purple-100 flex items-center gap-2 transition" title="Test Invio Cloud"><UploadCloud size={20}/></button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Se inserito, il backup automatico delle 21:00 verrà inviato a questo URL invece di essere scaricato.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-800 mb-4">Gestione Fasi Lavorative</h3>
                        <div className="flex gap-2 mb-4">
                            <input type="text" value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="Nuova fase..." className="border p-2 rounded flex-1"/>
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
                                                <input type="checkbox" checked={(tempPermissions[role] || []).includes(tab.id)} onChange={() => togglePermission(role, tab.id)} className="w-4 h-4 text-blue-600 rounded"/>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Database className="text-slate-600"/> Manutenzione Dati</h2>
                    <p className="text-slate-500 mb-6 italic">Aree di reset per ripulire l'applicazione dopo i test iniziali.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-red-100 rounded-xl bg-red-50/30">
                            <h4 className="font-bold text-slate-800 mb-2">Registro Commesse e Ore</h4>
                            <button onClick={handleResetJobs} className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition w-full justify-center"><Eraser size={20}/> Elimina Commesse e Ore</button>
                        </div>
                        <div className="p-4 border border-orange-100 rounded-xl bg-orange-50/30">
                            <h4 className="font-bold text-slate-800 mb-2">Registro Parco Mezzi</h4>
                            <button onClick={handleResetFleet} className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition w-full justify-center"><Truck size={20}/> Svuota Registro Mezzi</button>
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t">
                        <h4 className="font-bold text-slate-800 mb-4">Backup Manuale</h4>
                        <div className="flex gap-4">
                            <button onClick={handleBackupDownload} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-900 transition flex-1 justify-center"><Download size={20}/> Scarica Backup JSON</button>
                            <div className="relative flex-1">
                                <input type="file" ref={backupInputRef} onChange={handleBackupRestore} accept=".json" className="hidden"/>
                                <button onClick={() => backupInputRef.current?.click()} className="flex items-center gap-2 bg-slate-200 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-300 transition w-full justify-center"><Upload size={20}/> Ripristina JSON</button>
                            </div>
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
