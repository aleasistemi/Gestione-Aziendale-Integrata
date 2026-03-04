
import { AppDatabase, Employee, Job, WorkLog, AttendanceRecord, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { MOCK_EMPLOYEES, MOCK_JOBS, MOCK_LOGS, MOCK_ATTENDANCE } from '../constants';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch, 
  onSnapshot,
  query,
  where,
  enableIndexedDbPersistence
} from "firebase/firestore";

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

// Abilita persistenza offline per ridurre letture
if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch(() => {
        console.warn("Persistenza offline non disponibile");
    });
}

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
  workPhases: ['Preventivo', 'Ordine', 'Taglio', 'Lavorazioni', 'Assemblaggio', 'Imballaggio', 'Spedizione'],
  geminiApiKey: ''
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

  async getAllData(role?: Role): Promise<AppDatabase> {
    if (!navigator.onLine) {
        return { ...SEED_DATA, attendance: [...SEED_DATA.attendance, ...this.getOfflineAttendance()] };
    }
    await this.seedDatabaseIfNeeded();

    try {
        const isFullAdmin = role === Role.SYSTEM_ADMIN || role === Role.DIRECTION || role === Role.ADMIN;
        const isWorkshop = role === Role.WORKSHOP || role === Role.WAREHOUSE || role === Role.EMPLOYEE;
        const isKiosk = !role;

        const promises: any[] = [
            getDocs(collection(db, 'employees')),
            getDocs(collection(db, 'settings')),
            getDocs(collection(db, 'permissions'))
        ];

        // Caricamento semplificato per evitare errori di indici Firebase
        // La persistenza offline gestirà comunque l'efficienza delle letture
        promises.push(getDocs(collection(db, 'jobs')));
        promises.push(getDocs(collection(db, 'logs')));
        promises.push(getDocs(collection(db, 'attendance')));
        
        if (isFullAdmin || role === Role.FLEET) {
            promises.push(getDocs(collection(db, 'vehicles')));
            promises.push(getDocs(collection(db, 'vehicleLogs')));
        } else {
            promises.push(Promise.resolve({ docs: [] }));
            promises.push(Promise.resolve({ docs: [] }));
        }

        promises.push(getDocs(collection(db, 'justifications')));
        promises.push(getDocs(collection(db, 'customPrompts')));

        const snaps = await Promise.all(promises);
        
        const employees = snaps[0].docs.map((d: any) => d.data() as Employee);
        const settings = snaps[1].docs.find((d: any) => d.id === 'global')?.data() as GlobalSettings || DEFAULT_SETTINGS;
        const permissions = snaps[2].docs.find((d: any) => d.id === 'roles')?.data().map as RolePermissions || DEFAULT_PERMISSIONS;
        const jobs = snaps[3].docs.map((d: any) => d.data() as Job);
        const logs = snaps[4].docs.map((d: any) => d.data() as WorkLog);
        let attendance = snaps[5].docs.map((d: any) => d.data() as AttendanceRecord);
        const vehicles = snaps[6].docs.map((d: any) => d.data() as Vehicle);
        const vehicleLogs = snaps[7].docs.map((d: any) => d.data() as VehicleLog);
        const justifications = snaps[8].docs.map((d: any) => d.data() as DayJustification);
        const customPrompts = snaps[9].docs.map((d: any) => d.data() as AIQuickPrompt);

        const offlineQueue = this.getOfflineAttendance();
        if (offlineQueue.length > 0) attendance = [...attendance, ...offlineQueue];

        return { employees, jobs, logs, attendance, justifications, customPrompts, permissions, settings, vehicles, vehicleLogs };
    } catch (e) { 
        console.error("Error fetching data:", e);
        return SEED_DATA; 
    }
  }

  public getOfflineAttendance(): AttendanceRecord[] {
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

  listenToUpdates(role: Role | undefined, callback: (updates: Partial<AppDatabase>) => void) {
    if (!navigator.onLine) return () => {};

    const isFullAdmin = role === Role.SYSTEM_ADMIN || role === Role.DIRECTION || role === Role.ADMIN;

    const unsubs: any[] = [
      onSnapshot(collection(db, 'employees'), (s) => callback({ employees: s.docs.map(d => d.data() as Employee) })),
      onSnapshot(collection(db, 'settings'), (s) => {
        const setDocSnap = s.docs.find(d => d.id === 'global');
        if (setDocSnap) callback({ settings: setDocSnap.data() as GlobalSettings });
      }),
      onSnapshot(collection(db, 'permissions'), (s) => {
        const permDoc = s.docs.find(d => d.id === 'roles');
        if (permDoc) callback({ permissions: permDoc.data().map as RolePermissions });
      }),
      onSnapshot(collection(db, 'jobs'), (s) => callback({ jobs: s.docs.map(d => d.data() as Job) })),
      onSnapshot(collection(db, 'logs'), (s) => callback({ logs: s.docs.map(d => d.data() as WorkLog) })),
      onSnapshot(collection(db, 'attendance'), (s) => callback({ attendance: s.docs.map(d => d.data() as AttendanceRecord) })),
      onSnapshot(collection(db, 'justifications'), (s) => callback({ justifications: s.docs.map(d => d.data() as DayJustification) })),
      onSnapshot(collection(db, 'customPrompts'), (s) => callback({ customPrompts: s.docs.map(d => d.data() as AIQuickPrompt) }))
    ];

    if (isFullAdmin || role === Role.FLEET) {
        unsubs.push(onSnapshot(collection(db, 'vehicles'), (s) => callback({ vehicles: s.docs.map(d => d.data() as Vehicle) })));
        unsubs.push(onSnapshot(collection(db, 'vehicleLogs'), (s) => callback({ vehicleLogs: s.docs.map(d => d.data() as VehicleLog) })));
    }

    return () => unsubs.forEach(unsub => unsub());
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
  
  async deleteJob(jobId: string) {
      const logsSnap = await getDocs(collection(db, 'logs'));
      const batch = writeBatch(db);
      batch.delete(doc(db, 'jobs', jobId));
      logsSnap.docs.forEach(d => {
          if (d.data().jobId === jobId) batch.delete(d.ref);
      });
      await batch.commit();
  }

  async deleteJobsBulk(jobIds: string[]) {
      const logsSnap = await getDocs(collection(db, 'logs'));
      const batch = writeBatch(db);
      jobIds.forEach(id => {
          batch.delete(doc(db, 'jobs', id));
          logsSnap.docs.forEach(d => {
              if (d.data().jobId === id) batch.delete(d.ref);
          });
      });
      await batch.commit();
  }

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
      const ops = [
          ...emps.filter(e => e?.id).map(e=>({r:doc(db,'employees',e.id),d:e})), 
          ...jobs.filter(j => j?.id).map(j=>({r:doc(db,'jobs',j.id),d:j})), 
          ...logs.filter(l => l?.id).map(l=>({r:doc(db,'logs',l.id),d:l}))
      ];
      
      for (let i=0; i<ops.length; i+=BATCH_SIZE) {
          const batch = writeBatch(db);
          ops.slice(i, i+BATCH_SIZE).forEach(op => {
              if (op.r && op.d) batch.set(op.r, op.d);
          });
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

  async resetFleetLogs() {
      const logsSnap = await getDocs(collection(db, 'vehicleLogs'));
      const batch = writeBatch(db);
      logsSnap.docs.forEach(d => batch.delete(d.ref));
      
      const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
      vehiclesSnap.docs.forEach(d => {
          const v = d.data() as Vehicle;
          batch.set(d.ref, {
              ...v,
              status: 'AVAILABLE',
              currentDriverId: null,
              lastCheckOut: null
          });
      });
      
      await batch.commit();
  }

  async exportDatabase() { 
      const data = await this.getAllData();
      return JSON.stringify(data, null, 2); 
  }
  
  async importDatabase(json: string) {
      try {
          const d = JSON.parse(json);
          await this.bulkImport(d.jobs || [], d.logs || [], d.employees || []);
          return true;
      } catch { return false; }
  }

  async cleanupAttendance(days: number = 90) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const q = query(collection(db, 'attendance'), where('timestamp', '<', cutoff.toISOString()));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
  }

  async cleanupVehicleLogs(days: number = 365) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const q = query(collection(db, 'vehicleLogs'), where('timestamp', '<', cutoff.toISOString()));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
  }
}

export const dbService = new DatabaseService();
