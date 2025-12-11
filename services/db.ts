
import { AppDatabase, Employee, Job, WorkLog, AttendanceRecord, Role, JobStatus, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { MOCK_EMPLOYEES, MOCK_JOBS, MOCK_LOGS, MOCK_ATTENDANCE } from '../constants';

const DB_KEY = 'aziendale_db_v9'; // Bumped version to v9 for NFC Settings

const DEFAULT_AI_PROMPTS: AIQuickPrompt[] = [
  { id: '1', label: 'Analisi Margine', prompt: 'Analizza il margine di profitto di tutte le commesse attive e dimmi quali sono in perdita.' },
  { id: '2', label: 'Efficienza Officina', prompt: 'Analizza le ore lavorate dal reparto Officina e identifica eventuali colli di bottiglia.' },
  { id: '3', label: 'Analisi Costi', prompt: 'Quali sono i costi maggiori sostenuti questo mese in termini di ore lavorate?' },
  { id: '4', label: 'Clienti Top', prompt: 'Identifica i 3 clienti migliori per fatturato generato.' },
  { id: '5', label: 'Sforamento Budget', prompt: 'Elenca le commesse che hanno superato il budget ore previsto.' },
  { id: '6', label: 'Straordinari', prompt: 'Ci sono dipendenti che stanno facendo troppi straordinari o ore eccessive?' },
  { id: '7', label: 'Previsione Chiusura', prompt: 'In base al ritmo attuale, quando prevedi che chiuderemo le commesse in corso?' },
  { id: '8', label: 'Ritardi Dipendenti', prompt: 'Analizza i ritardi dei dipendenti e suggerisci azioni correttive.' },
  { id: '9', label: 'Budget vs Reale', prompt: 'Confronta il budget preventivato con le ore reali lavorate per le commesse concluse di recente.' },
  { id: '10', label: 'Ottimizzazione', prompt: 'Dammi 3 suggerimenti per ottimizzare i costi operativi basandoti sui dati attuali.' },
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  [Role.SYSTEM_ADMIN]: ['OVERVIEW', 'JOBS', 'HR', 'AI', 'MANAGE', 'CONFIG'],
  [Role.DIRECTION]: ['OVERVIEW', 'JOBS', 'HR', 'AI', 'MANAGE'],
  [Role.ADMIN]: ['HR'],
  [Role.ACCOUNTING]: ['HR'],
  [Role.SALES]: ['OVERVIEW', 'JOBS', 'MANAGE'],
  [Role.TECHNICAL]: ['OVERVIEW', 'JOBS', 'MANAGE'],
  [Role.WORKSHOP]: [],
  [Role.EMPLOYEE]: []
};

const DEFAULT_SETTINGS: GlobalSettings = {
  nfcEnabled: false
};

const SEED_DATA: AppDatabase = {
  employees: MOCK_EMPLOYEES,
  jobs: MOCK_JOBS,
  logs: MOCK_LOGS, 
  attendance: MOCK_ATTENDANCE,
  justifications: [],
  customPrompts: DEFAULT_AI_PROMPTS,
  permissions: DEFAULT_PERMISSIONS,
  settings: DEFAULT_SETTINGS
};

class DatabaseService {
  private getDB(): AppDatabase {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
      this.saveDB(SEED_DATA);
      return SEED_DATA;
    }
    const parsed = JSON.parse(data);
    // Migration helpers
    if (!parsed.justifications) parsed.justifications = [];
    if (!parsed.customPrompts || parsed.customPrompts.length === 0) parsed.customPrompts = DEFAULT_AI_PROMPTS;
    if (!parsed.permissions) parsed.permissions = DEFAULT_PERMISSIONS;
    if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
    return parsed;
  }

  private saveDB(data: AppDatabase) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('storage')); 
  }

  async getAllData(): Promise<AppDatabase> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.getDB()), 50); 
    });
  }

  async saveWorkLog(log: WorkLog): Promise<void> {
    const db = this.getDB();
    const existingIdx = db.logs.findIndex(l => l.id === log.id);
    if (existingIdx !== -1) {
        db.logs[existingIdx] = log;
    } else {
        db.logs.push(log);
    }
    this.saveDB(db);
  }

  async deleteWorkLog(logId: string): Promise<void> {
      const db = this.getDB();
      db.logs = db.logs.filter(l => l.id !== logId);
      this.saveDB(db);
  }

  async saveAttendance(record: AttendanceRecord): Promise<void> {
    const db = this.getDB();
    db.attendance.push(record);
    this.saveDB(db);
  }

  async saveJob(job: Job): Promise<void> {
    const db = this.getDB();
    const existingIndex = db.jobs.findIndex(j => j.id === job.id);
    if (existingIndex >= 0) {
      db.jobs[existingIndex] = job;
    } else {
      db.jobs.push(job);
    }
    this.saveDB(db);
  }

  async saveEmployee(employee: Employee): Promise<void> {
    const db = this.getDB();
    const existingIndex = db.employees.findIndex(e => e.id === employee.id);
    if (existingIndex >= 0) {
      db.employees[existingIndex] = employee;
    } else {
      db.employees.push(employee);
    }
    this.saveDB(db);
  }

  async saveJustification(justification: DayJustification): Promise<void> {
    const db = this.getDB();
    const existingIndex = db.justifications.findIndex(j => j.date === justification.date && j.employeeId === justification.employeeId);
    
    if (existingIndex >= 0) {
        db.justifications[existingIndex] = justification;
    } else {
        db.justifications.push(justification);
    }
    this.saveDB(db);
  }

  async saveAiPrompts(prompts: AIQuickPrompt[]): Promise<void> {
      const db = this.getDB();
      db.customPrompts = prompts;
      this.saveDB(db);
  }

  async savePermissions(permissions: RolePermissions): Promise<void> {
      const db = this.getDB();
      db.permissions = permissions;
      this.saveDB(db);
  }

  async saveSettings(settings: GlobalSettings): Promise<void> {
      const db = this.getDB();
      db.settings = settings;
      this.saveDB(db);
  }

  async bulkImport(newJobs: Job[], newLogs: WorkLog[], newEmployees: Employee[]): Promise<void> {
      const db = this.getDB();
      
      newEmployees.forEach(emp => {
          const idx = db.employees.findIndex(e => e.name.toLowerCase() === emp.name.toLowerCase());
          if (idx === -1) db.employees.push(emp);
      });

      newJobs.forEach(job => {
          const idx = db.jobs.findIndex(j => j.code === job.code);
          if (idx !== -1) {
              db.jobs[idx] = { ...db.jobs[idx], ...job };
          } else {
              db.jobs.push(job);
          }
      });

      newLogs.forEach(log => {
          if (!db.logs.find(l => l.id === log.id)) {
              db.logs.push(log);
          }
      });

      this.saveDB(db);
  }
}

export const dbService = new DatabaseService();
