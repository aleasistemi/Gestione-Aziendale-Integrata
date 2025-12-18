
import { AppDatabase, Employee, Job, WorkLog, AttendanceRecord, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { MOCK_EMPLOYEES, MOCK_JOBS, MOCK_LOGS, MOCK_ATTENDANCE } from '../constants';
// Standard Firebase modular import for initializeApp
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAMExnSLvZab2lQeg8bPJsZ91w4bvlDQm4",
  authDomain: "gestione-aziendale-ore.firebaseapp.com",
  projectId: "gestione-aziendale-ore",
  storageBucket: "gestione-aziendale-ore.firebasestorage.app",
  messagingSenderId: "180634359822",
  appId: "1:180634359822:web:f55c1086e731af71d3845f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_AI_PROMPTS: AIQuickPrompt[] = [
  { id: '1', label: 'Analisi Margine', prompt: 'Analizza il margine di profitto di tutte le commesse attive e dimmi quali sono in perdita.' },
  { id: '2', label: 'Efficienza Officina', prompt: 'Analizza le ore lavorate dal reparto Officina e identifica eventuali colli di bottiglia.' },
  { id: '4', label: 'Clienti Top', prompt: 'Identifica i 3 clienti migliori per fatturato generato.' },
  { id: '5', label: 'Sforamento Budget', prompt: 'Elenca le commesse che hanno superato il budget ore previsto.' }
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  [Role.SYSTEM_ADMIN]: ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE', 'CONFIG'],
  [Role.DIRECTION]: ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE'],
  [Role.ADMIN]: ['HR', 'FLEET'],
  [Role.ACCOUNTING]: ['HR'],
  [Role.SALES]: ['OVERVIEW', 'JOBS', 'MANAGE'],
  [Role.TECHNICAL]: ['OVERVIEW', 'JOBS', 'MANAGE'],
  [Role.WORKSHOP]: [],
  [Role.WAREHOUSE]: [],
  [Role.EMPLOYEE]: []
};

const DEFAULT_SETTINGS: GlobalSettings = {
  nfcEnabled: false,
  workPhases: ['Preventivo', 'Ordine', 'Taglio', 'Lavorazioni', 'Assemblaggio', 'Imballaggio', 'Spedizione']
};

const SEED_DATA: AppDatabase = {
  employees: MOCK_EMPLOYEES,
  jobs: MOCK_JOBS,
  logs: MOCK_LOGS, 
  attendance: MOCK_ATTENDANCE,
  vehicles: [],
  vehicleLogs: [],
  justifications: [],
  customPrompts: DEFAULT_AI_PROMPTS,
  permissions: DEFAULT_PERMISSIONS,
  settings: DEFAULT_SETTINGS
};

const OFFLINE_ATTENDANCE_KEY = 'offline_attendance_queue';

class DatabaseService {
  private async seedDatabaseIfNeeded() {
      if (!navigator.onLine) return; 
      try {
          const empSnap = await getDocs(collection(db, 'employees'));
          if (empSnap.empty) {
              await this.bulkImport(SEED_DATA.jobs, SEED_DATA.logs, SEED_DATA.employees);
              await setDoc(doc(db, 'settings', 'global'), SEED_DATA.settings);
              await setDoc(doc(db, 'permissions', 'roles'), { map: SEED_DATA.permissions });
              const batch = writeBatch(db);
              SEED_DATA.customPrompts.forEach(p => batch.set(doc(db, 'customPrompts', p.id), p));
              await batch.commit();
          }
      } catch (e) { console.error("Seed error:", e); }
  }

  async getAllData(): Promise<AppDatabase> {
    if (!navigator.onLine) {
        return { ...SEED_DATA, attendance: [...SEED_DATA.attendance, ...this.getOfflineAttendance()] };
    }
    await this.seedDatabaseIfNeeded();
    try {
        const [empSnap, jobSnap, logSnap, attSnap, justSnap, promptSnap, permSnap, setSnap, vehSnap, vehLogSnap] = await Promise.all([
            getDocs(collection(db, 'employees')),
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'logs')),
            getDocs(collection(db, 'attendance')),
            getDocs(collection(db, 'justifications')),
            getDocs(collection(db, 'customPrompts')),
            getDocs(collection(db, 'permissions')),
            getDocs(collection(db, 'settings')),
            getDocs(collection(db, 'vehicles')),
            getDocs(collection(db, 'vehicleLogs'))
        ]);
        const employees = empSnap.docs.map(d => d.data() as Employee);
        const jobs = jobSnap.docs.map(d => d.data() as Job);
        const logs = logSnap.docs.map(d => d.data() as WorkLog);
        let attendance = attSnap.docs.map(d => d.data() as AttendanceRecord);
        const justifications = justSnap.docs.map(d => d.data() as DayJustification);
        const customPrompts = promptSnap.docs.map(d => d.data() as AIQuickPrompt);
        const vehicles = vehSnap.docs.map(d => d.data() as Vehicle);
        const vehicleLogs = vehLogSnap.docs.map(d => d.data() as VehicleLog);
        const offlineQueue = this.getOfflineAttendance();
        if (offlineQueue.length > 0) attendance = [...attendance, ...offlineQueue];
        const permDoc = permSnap.docs.find(d => d.id === 'roles');
        const permissions = permDoc ? permDoc.data().map as RolePermissions : DEFAULT_PERMISSIONS;
        const setDocSnap = setSnap.docs.find(d => d.id === 'global');
        const settings = setDocSnap ? setDocSnap.data() as GlobalSettings : DEFAULT_SETTINGS;
        return { employees, jobs, logs, attendance, justifications, customPrompts, permissions, settings, vehicles, vehicleLogs };
    } catch (e) { return SEED_DATA; }
  }

  private getOfflineAttendance(): AttendanceRecord[] {
      const raw = localStorage.getItem(OFFLINE_ATTENDANCE_KEY);
      return raw ? JSON.parse(raw) : [];
  }

  async syncOfflineAttendance(): Promise<number> {
      if (!navigator.onLine) return 0;
      const queue = this.getOfflineAttendance();
      if (queue.length === 0) return 0;
      const batch = writeBatch(db);
      queue.forEach(record => batch.set(doc(db, 'attendance', record.id), record));
      try {
          await batch.commit();
          localStorage.removeItem(OFFLINE_ATTENDANCE_KEY);
          return queue.length;
      } catch { return 0; }
  }

  async saveWorkLog(log: WorkLog) { await setDoc(doc(db, 'logs', log.id), log); }
  async deleteWorkLog(id: string) { await deleteDoc(doc(db, 'logs', id)); }
  async saveAttendance(record: AttendanceRecord) {
      if (!navigator.onLine) {
          const q = this.getOfflineAttendance();
          q.push(record);
          localStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(q));
      } else {
          await setDoc(doc(db, 'attendance', record.id), record);
      }
  }
  async deleteAttendance(id: string) { await deleteDoc(doc(db, 'attendance', id)); }
  async saveJob(job: Job) { await setDoc(doc(db, 'jobs', job.id), job); }
  async saveEmployee(emp: Employee) { await setDoc(doc(db, 'employees', emp.id), emp); }
  async saveJustification(just: DayJustification) { await setDoc(doc(db, 'justifications', just.id), just); }
  async saveAiPrompts(p: AIQuickPrompt[]) { 
      const batch = writeBatch(db);
      p.forEach(x => batch.set(doc(db, 'customPrompts', x.id), x));
      await batch.commit();
  }
  async savePermissions(p: RolePermissions) { await setDoc(doc(db, 'permissions', 'roles'), { map: p }); }
  async saveSettings(s: GlobalSettings) { await setDoc(doc(db, 'settings', 'global'), s); }
  async saveVehicle(v: Vehicle) { await setDoc(doc(db, 'vehicles', v.id), v); }
  async deleteVehicle(id: string) { await deleteDoc(doc(db, 'vehicles', id)); }
  async saveVehicleLog(l: VehicleLog) { await setDoc(doc(db, 'vehicleLogs', l.id), l); }

  async bulkImport(jobs: Job[], logs: WorkLog[], emps: Employee[]) {
      const BATCH_SIZE = 400;
      const ops = [...emps.map(e=>({r:doc(db,'employees',e.id),d:e})), ...jobs.map(j=>({r:doc(db,'jobs',j.id),d:j})), ...logs.map(l=>({r:doc(db,'logs',l.id),d:l}))];
      for (let i=0; i<ops.length; i+=BATCH_SIZE) {
          const batch = writeBatch(db);
          ops.slice(i, i+BATCH_SIZE).forEach(op => batch.set(op.r, op.d));
          await batch.commit();
      }
  }

  async resetJobsAndLogs() {
      const jobs = await getDocs(collection(db, 'jobs'));
      const logs = await getDocs(collection(db, 'logs'));
      const batch = writeBatch(db);
      jobs.docs.forEach(d => batch.delete(d.ref));
      logs.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
  }

  async exportDatabase() { return JSON.stringify(await this.getAllData()); }
  async importDatabase(json: string) {
      try {
          const d = JSON.parse(json);
          await this.bulkImport(d.jobs, d.logs, d.employees);
          return true;
      } catch { return false; }
  }
}

export const dbService = new DatabaseService();
