
export enum Role {
  SYSTEM_ADMIN = 'Sistemista', // God Mode tecnico
  DIRECTION = 'Direzione', // God Mode gestionale
  ADMIN = 'Amministrazione', // Solo HR/Paghe
  ACCOUNTING = 'Contabilità', // Simile ad Amministrazione
  SALES = 'Commerciale', // Gestione Commesse
  TECHNICAL = 'Tecnico', // Gestione Commesse come Sales
  WORKSHOP = 'Officina', // Operativi (include Magazzino)
  EMPLOYEE = 'Dipendente' // Generico
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  hourlyRate: number; // Costo orario aziendale
  department: string;
  // Gestione Orari e Ritardi
  toleranceMinutes: number; // Es. 10 minuti
  scheduleStartMorning: string; // "08:30"
  scheduleEndMorning: string; // "12:30"
  scheduleStartAfternoon: string; // "13:30"
  scheduleEndAfternoon: string; // "17:30"
  workDays: number[]; // 0=Sun, 1=Mon, etc. Default [1,2,3,4,5]
  // Auth
  nfcCode?: string;
  pin?: string;
}

export enum JobStatus {
  PLANNED = 'Pianificata',
  IN_PROGRESS = 'In Corso',
  COMPLETED = 'Completata',
  ON_HOLD = 'Sospesa'
}

export interface Job {
  id: string;
  code: string;
  clientName: string;
  description: string;
  status: JobStatus;
  budgetHours: number;
  budgetValue: number; // Valore commessa
  deadline: string;
  priority: number; // 1-5, default 3
  suggestedOperatorId?: string; // Visual note for assignment
  notes?: string; // Note interne aggiuntive
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string; // ISO String
  type: 'ENTRATA' | 'USCITA';
}

export interface WorkLog {
  id: string;
  employeeId: string;
  jobId: string;
  phase: string; // Es. "Montaggio", "Saldatura", "Progettazione"
  hours: number;
  date: string;
  notes?: string;
}

export enum JustificationType {
  STANDARD = 'Standard', // Calcolo automatico
  FERIE = 'Ferie',
  MALATTIA = 'Malattia',
  PERMESSO = 'Permesso',
  INGIUSTIFICATO = 'Assenza Ingiustificata',
  RITARDO_GIUSTIFICATO = 'Ritardo Giustificato'
}

export interface DayJustification {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: JustificationType;
  hoursOffset?: number; // Ore da aggiungere/togliere o ore totali forzate
  notes?: string;
}

export interface AIQuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface RolePermissions {
  [role: string]: string[]; // Role -> Array of allowed Tab IDs
}

export interface GlobalSettings {
  nfcEnabled: boolean;
  workPhases: string[]; // Dynamic list of work phases
  geminiApiKey?: string; // Custom API Key
}

export type ViewMode = 'LOGIN' | 'ATTENDANCE_KIOSK' | 'DASHBOARD' | 'WORKSHOP_PANEL';

// Helper type for the Database
export interface AppDatabase {
  employees: Employee[];
  jobs: Job[];
  logs: WorkLog[];
  attendance: AttendanceRecord[];
  justifications: DayJustification[];
  customPrompts: AIQuickPrompt[];
  permissions: RolePermissions;
  settings: GlobalSettings;
}
