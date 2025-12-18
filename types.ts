
export enum Role {
  SYSTEM_ADMIN = 'Sistemista', // God Mode tecnico
  DIRECTION = 'Direzione', // God Mode gestionale
  ADMIN = 'Amministrazione', // Solo HR/Paghe
  ACCOUNTING = 'Contabilità', // Simile ad Amministrazione
  SALES = 'Commerciale', // Gestione Commesse
  TECHNICAL = 'Tecnico', // Gestione Commesse come Sales
  WORKSHOP = 'Officina', // Operativi (include Magazzino)
  WAREHOUSE = 'Magazzino', // Nuovo ruolo specifico
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
  nfcCode2?: string; // Secondo badge opzionale
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
  creationDate?: string; // Data inizio/creazione commessa
  priority: number; // 1-5, default 3
  suggestedOperatorId?: string; // Visual note for assignment
  notes?: string; // Note interne aggiuntive
  // Archiving
  isArchived?: boolean;
  archiveYear?: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string; // ISO String
  type: 'ENTRATA' | 'USCITA';
  isOfflineSync?: boolean; // Flag per capire se è stato sincronizzato dopo
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

// --- NEW VEHICLE TYPES ---
export interface Vehicle {
  id: string;
  name: string; // Es. "Fiat Ducato"
  plate: string; // Targa
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
  currentDriverId?: string; // Se in uso, chi lo ha?
  lastCheckOut?: string; // ISO String di quando è stato preso
}

export interface VehicleLog {
  id: string;
  vehicleId: string;
  employeeId: string;
  timestampOut: string; // Quando è stato preso
  timestampIn?: string; // Quando è stato restituito (null se in corso)
  notes?: string;
}
// -------------------------

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
  overtimeSnapMinutes?: number; // Default 30
  permessoSnapMinutes?: number; // Default 15
  backupWebhookUrl?: string; // URL Pabbly/Zapier for backups
}

export type ViewMode = 'STARTUP_SELECT' | 'LOGIN' | 'ATTENDANCE_KIOSK' | 'VEHICLE_KIOSK' | 'DASHBOARD' | 'WORKSHOP_PANEL';

// Helper type for the Database
export interface AppDatabase {
  employees: Employee[];
  jobs: Job[];
  logs: WorkLog[];
  attendance: AttendanceRecord[];
  vehicles: Vehicle[];
  vehicleLogs: VehicleLog[];
  justifications: DayJustification[];
  customPrompts: AIQuickPrompt[];
  permissions: RolePermissions;
  settings: GlobalSettings;
}

// --- WEB NFC TYPES ---
export interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
  toRecords?: () => NDEFRecord[];
}

export interface NDEFMessage {
  records: NDEFRecord[];
}

export interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

export interface NDEFReader {
  scan: (options?: any) => Promise<void>;
  // Added write method to support writing to NFC tags
  write: (message: any, options?: any) => Promise<void>;
  onreading: ((this: NDEFReader, event: NDEFReadingEvent) => any) | null;
  onreadingerror: ((this: NDEFReader, event: Event) => any) | null;
}

// Extend Window interface
declare global {
  interface Window {
    NDEFReader: {
      new (): NDEFReader;
    };
  }
}
