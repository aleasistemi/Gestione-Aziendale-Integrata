
export enum Role {
  SYSTEM_ADMIN = 'Sistemista',
  DIRECTION = 'Direzione',
  ADMIN = 'Amministrazione',
  ACCOUNTING = 'Contabilità',
  SALES = 'Commerciale',
  TECHNICAL = 'Tecnico',
  WORKSHOP = 'Officina',
  WAREHOUSE = 'Magazzino',
  EMPLOYEE = 'Dipendente'
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  hourlyRate: number;
  department: string;
  toleranceMinutes: number;
  scheduleStartMorning: string;
  scheduleEndMorning: string;
  scheduleStartAfternoon: string;
  scheduleEndAfternoon: string;
  workDays: number[];
  nfcCode?: string;
  nfcCode2?: string;
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
  budgetValue: number;
  deadline: string;
  creationDate?: string;
  priority: number;
  suggestedOperatorId?: string;
  notes?: string;
  isArchived?: boolean;
  archiveYear?: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: 'ENTRATA' | 'USCITA';
  isOfflineSync?: boolean;
}

export interface WorkLog {
  id: string;
  employeeId: string;
  jobId: string;
  phase: string;
  hours: number;
  date: string;
  notes?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
  currentDriverId?: string;
  lastCheckOut?: string;
}

export interface VehicleLog {
  id: string;
  vehicleId: string;
  employeeId: string;
  timestampOut: string;
  timestampIn?: string;
  notes?: string;
}

export enum JustificationType {
  STANDARD = 'Standard',
  FERIE = 'Ferie',
  MALATTIA = 'Malattia',
  PERMESSO = 'Permesso',
  FESTIVO = 'Festivo',
  INGIUSTIFICATO = 'Assenza Ingiustificata',
  RITARDO_GIUSTIFICATO = 'Ritardo Giustificato',
  CONGEDO = 'Congedo'
}

export interface DayJustification {
  id: string;
  employeeId: string;
  date: string;
  type: JustificationType;
  hoursOffset?: number;
  notes?: string;
}

export interface AIQuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface RolePermissions {
  [role: string]: string[];
}

export interface GlobalSettings {
  nfcEnabled: boolean;
  workPhases: string[];
  overtimeSnapMinutes?: number;
  permessoSnapMinutes?: number;
  backupWebhookUrl?: string;
  geminiApiKey?: string;
}

export type ViewMode = 'STARTUP_SELECT' | 'LOGIN' | 'ATTENDANCE_KIOSK' | 'VEHICLE_KIOSK' | 'MOBILE_VEHICLE_KIOSK' | 'DASHBOARD' | 'WORKSHOP_PANEL';

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
  write: (message: any, options?: any) => Promise<void>;
  onreading: ((this: NDEFReader, event: NDEFReadingEvent) => any) | null;
  onreadingerror: ((this: NDEFReader, event: Event) => any) | null;
}

declare global {
  interface Window {
    NDEFReader: {
      new (): NDEFReader;
    };
  }
}
