
import { Employee, Job, Role, JobStatus, WorkLog, AttendanceRecord } from './types';

const DEFAULT_SCHEDULE = {
  toleranceMinutes: 10,
  scheduleStartMorning: "08:30",
  scheduleEndMorning: "12:30",
  scheduleStartAfternoon: "13:30",
  scheduleEndAfternoon: "17:30"
};

export const MOCK_EMPLOYEES: Employee[] = [
  // Sistemista
  { id: 'sys-1', name: 'Gennaro Merolla', role: Role.SYSTEM_ADMIN, hourlyRate: 0, department: 'IT', ...DEFAULT_SCHEDULE, pin: '9999', nfcCode: 'NFC_SYS_1' },
  
  // Direzione
  { id: 'dir-1', name: 'Franco Capriati', role: Role.DIRECTION, hourlyRate: 100, department: 'Direzione', ...DEFAULT_SCHEDULE, pin: '1111' },
  { id: 'dir-2', name: 'Giovanni Capriati', role: Role.DIRECTION, hourlyRate: 100, department: 'Direzione', ...DEFAULT_SCHEDULE, pin: '2222' },
  
  // Amministrazione / Contabilità
  { id: 'adm-1', name: 'Cristina Barsotti', role: Role.ADMIN, hourlyRate: 40, department: 'Amministrazione', ...DEFAULT_SCHEDULE, pin: '1234' },
  { id: 'acc-1', name: 'Alessia Crescenzio', role: Role.ACCOUNTING, hourlyRate: 40, department: 'Contabilità', ...DEFAULT_SCHEDULE, pin: '5678' },
  
  // Officina
  { id: 'wk-1', name: 'Catalin Daniel Simion', role: Role.WORKSHOP, hourlyRate: 30, department: 'Officina', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_WK_1', pin: '0000' },
  { id: 'wk-2', name: 'Danilo Tirrito', role: Role.WORKSHOP, hourlyRate: 30, department: 'Officina', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_WK_2', pin: '0000' },
  { id: 'wk-3', name: 'Paolo Invernizzi', role: Role.WORKSHOP, hourlyRate: 30, department: 'Officina', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_WK_3', pin: '0000' },
  
  // Magazzino
  { id: 'mg-1', name: 'Gabriele Conterno', role: Role.WORKSHOP, hourlyRate: 28, department: 'Magazzino', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_MG_1', pin: '0000' },
  { id: 'mg-2', name: 'Christian Meridda', role: Role.WORKSHOP, hourlyRate: 28, department: 'Magazzino', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_MG_2', pin: '0000' },
  { id: 'mg-3', name: 'Demis Giacomelli', role: Role.WORKSHOP, hourlyRate: 28, department: 'Magazzino', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_MG_3', pin: '0000' },
  { id: 'mg-4', name: 'Danilo Ciancitto', role: Role.WORKSHOP, hourlyRate: 28, department: 'Magazzino', ...DEFAULT_SCHEDULE, nfcCode: 'NFC_MG_4', pin: '0000' },
  
  // Ufficio Tecnico
  { id: 'tec-1', name: 'Iacopo Cravero', role: Role.TECHNICAL, hourlyRate: 50, department: 'Ufficio Tecnico', ...DEFAULT_SCHEDULE, pin: '3333' },
  { id: 'tec-2', name: 'Fabio Libero', role: Role.TECHNICAL, hourlyRate: 50, department: 'Ufficio Tecnico', ...DEFAULT_SCHEDULE, pin: '4444' },
  
  // Commerciale
  { id: 'sal-1', name: 'Laura Rigano', role: Role.SALES, hourlyRate: 45, department: 'Commerciale', ...DEFAULT_SCHEDULE, pin: '5555' },
  { id: 'sal-2', name: 'Giuseppe Geracitano', role: Role.SALES, hourlyRate: 45, department: 'Commerciale', ...DEFAULT_SCHEDULE, pin: '6666' },
  { id: 'sal-3', name: 'Claudia Casini', role: Role.SALES, hourlyRate: 45, department: 'Commerciale', ...DEFAULT_SCHEDULE, pin: '7777' },
];

// Clean state: No mock jobs
export const MOCK_JOBS: Job[] = [];

// Clean state: No mock logs
export const MOCK_LOGS: WorkLog[] = [];

export const MOCK_ATTENDANCE: AttendanceRecord[] = [];
