
import { AppDatabase, Employee, Job, WorkLog, AttendanceRecord, Role, DayJustification, AIQuickPrompt, RolePermissions, GlobalSettings } from '../types';
import { MOCK_EMPLOYEES, MOCK_JOBS, MOCK_LOGS, MOCK_ATTENDANCE } from '../constants';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, writeBatch, query, where } from "firebase/firestore";

// Configurazione Firebase fornita dall'utente
const firebaseConfig = {
  apiKey: "AIzaSyAMExnSLvZab2lQeg8bPJsZ91w4bvlDQm4",
  authDomain: "gestione-aziendale-ore.firebaseapp.com",
  projectId: "gestione-aziendale-ore",
  storageBucket: "gestione-aziendale-ore.firebasestorage.app",
  messagingSenderId: "180634359822",
  appId: "1:180634359822:web:f55c1086e731af71d3845f"
};

// Inizializzazione App Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  nfcEnabled: false,
  geminiApiKey: '',
  workPhases: [
    'Preventivo', 
    'Ordine', 
    'Taglio', 
    'Lavorazioni', 
    'Assemblaggio', 
    'Taglio Pannelli', 
    'Preparazione Accessori', 
    'Imballaggio', 
    'Spedizione'
  ]
};

// Dati iniziali per il primo avvio (Seeding)
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
  
  // Metodo per inizializzare il DB se vuoto (Primo Deploy)
  private async seedDatabaseIfNeeded() {
      try {
          const empSnap = await getDocs(collection(db, 'employees'));
          if (empSnap.empty) {
              console.log("Database vuoto. Avvio procedura di Seed iniziale...");
              await this.bulkImport(SEED_DATA.jobs, SEED_DATA.logs, SEED_DATA.employees);
              
              // Seed Settings, Permissions, Prompts
              await setDoc(doc(db, 'settings', 'global'), SEED_DATA.settings);
              await setDoc(doc(db, 'permissions', 'roles'), { map: SEED_DATA.permissions });
              
              const batch = writeBatch(db);
              SEED_DATA.customPrompts.forEach(p => {
                  batch.set(doc(db, 'customPrompts', p.id), p);
              });
              await batch.commit();
              console.log("Seed completato.");
          }
      } catch (e) {
          console.error("Errore durante il seed:", e);
      }
  }

  async getAllData(): Promise<AppDatabase> {
    // Controllo seed al primo caricamento
    await this.seedDatabaseIfNeeded();

    try {
        const [empSnap, jobSnap, logSnap, attSnap, justSnap, promptSnap, permSnap, setSnap] = await Promise.all([
            getDocs(collection(db, 'employees')),
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'logs')),
            getDocs(collection(db, 'attendance')),
            getDocs(collection(db, 'justifications')),
            getDocs(collection(db, 'customPrompts')),
            getDocs(collection(db, 'permissions')),
            getDocs(collection(db, 'settings'))
        ]);

        const employees = empSnap.docs.map(d => d.data() as Employee);
        const jobs = jobSnap.docs.map(d => d.data() as Job);
        const logs = logSnap.docs.map(d => d.data() as WorkLog);
        const attendance = attSnap.docs.map(d => d.data() as AttendanceRecord);
        const justifications = justSnap.docs.map(d => d.data() as DayJustification);
        const customPrompts = promptSnap.docs.map(d => d.data() as AIQuickPrompt);
        
        // Gestione documenti singoli (Settings / Permissions)
        const permDoc = permSnap.docs.find(d => d.id === 'roles');
        const permissions = permDoc ? permDoc.data().map as RolePermissions : DEFAULT_PERMISSIONS;

        const setDocSnap = setSnap.docs.find(d => d.id === 'global');
        const settings = setDocSnap ? setDocSnap.data() as GlobalSettings : DEFAULT_SETTINGS;

        // Ensure default workPhases exist if legacy data
        if (!settings.workPhases || settings.workPhases.length === 0) {
            settings.workPhases = DEFAULT_SETTINGS.workPhases;
        }

        // Fallback per prompts se vuoti (caso raro)
        const finalPrompts = customPrompts.length > 0 ? customPrompts : DEFAULT_AI_PROMPTS;

        return {
            employees,
            jobs,
            logs,
            attendance,
            justifications,
            customPrompts: finalPrompts,
            permissions,
            settings
        };
    } catch (e) {
        console.error("Errore recupero dati da Firebase:", e);
        // Ritorna dati vuoti o mock in caso di errore grave di connessione per non bloccare la UI
        return SEED_DATA; 
    }
  }

  async saveWorkLog(log: WorkLog): Promise<void> {
    const cleanLog = JSON.parse(JSON.stringify(log)); // Sanitize undefined
    await setDoc(doc(db, 'logs', log.id), cleanLog);
  }

  async deleteWorkLog(logId: string): Promise<void> {
    await deleteDoc(doc(db, 'logs', logId));
  }

  async saveAttendance(record: AttendanceRecord): Promise<void> {
    const cleanRecord = JSON.parse(JSON.stringify(record));
    await setDoc(doc(db, 'attendance', record.id), cleanRecord);
  }

  async saveJob(job: Job): Promise<void> {
    const cleanJob = JSON.parse(JSON.stringify(job));
    await setDoc(doc(db, 'jobs', job.id), cleanJob);
  }

  async saveEmployee(employee: Employee): Promise<void> {
    const cleanEmp = JSON.parse(JSON.stringify(employee));
    await setDoc(doc(db, 'employees', employee.id), cleanEmp);
  }

  async saveJustification(justification: DayJustification): Promise<void> {
    const cleanJust = JSON.parse(JSON.stringify(justification));
    await setDoc(doc(db, 'justifications', justification.id), cleanJust);
  }

  async saveAiPrompts(prompts: AIQuickPrompt[]): Promise<void> {
      const batch = writeBatch(db);
      prompts.forEach(p => {
          batch.set(doc(db, 'customPrompts', p.id), JSON.parse(JSON.stringify(p)));
      });
      await batch.commit();
  }

  async savePermissions(permissions: RolePermissions): Promise<void> {
      await setDoc(doc(db, 'permissions', 'roles'), { map: permissions });
  }

  async saveSettings(settings: GlobalSettings): Promise<void> {
      await setDoc(doc(db, 'settings', 'global'), settings);
  }

  async bulkImport(newJobs: Job[], newLogs: WorkLog[], newEmployees: Employee[]): Promise<void> {
      // 1. Sanitize Data (remove undefined) by using JSON cycle or manual cleanup
      const sanitize = (obj: any) => {
          const newObj = { ...obj };
          Object.keys(newObj).forEach(key => {
              if (newObj[key] === undefined) delete newObj[key];
          });
          return newObj;
      };

      // 2. Prepare Operations
      const allOperations = [
          ...newEmployees.map(e => ({ type: 'employee', ref: doc(db, 'employees', e.id), data: sanitize(e) })),
          ...newJobs.map(j => ({ type: 'job', ref: doc(db, 'jobs', j.id), data: sanitize(j) })),
          ...newLogs.map(l => ({ type: 'log', ref: doc(db, 'logs', l.id), data: sanitize(l) }))
      ];

      // 3. Batching (Firestore limit 500 operations per batch)
      const BATCH_SIZE = 450; // Safety margin
      
      console.log(`Starting Bulk Import: ${allOperations.length} operations`);

      for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = allOperations.slice(i, i + BATCH_SIZE);
          
          chunk.forEach(op => {
              batch.set(op.ref, op.data);
          });

          try {
              console.log(`Committing batch chunk ${i / BATCH_SIZE + 1}...`);
              await batch.commit();
          } catch (e) {
              console.error("Batch commit failed:", e);
              throw e; // Propagate error to UI
          }
      }
  }

  // NUOVA FUNZIONE: Cancella tutte le commesse e i log
  async resetJobsAndLogs(): Promise<void> {
      try {
          const jobsSnap = await getDocs(collection(db, 'jobs'));
          const logsSnap = await getDocs(collection(db, 'logs'));
          
          // Must verify batch limits for delete as well
          const allDocs = [...jobsSnap.docs, ...logsSnap.docs];
          const BATCH_SIZE = 450;

          for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              const chunk = allDocs.slice(i, i + BATCH_SIZE);
              chunk.forEach(d => batch.delete(d.ref));
              await batch.commit();
          }

      } catch (e) {
          console.error("Errore reset dati:", e);
          throw e;
      }
  }

  async exportDatabase(): Promise<string> {
    const data = await this.getAllData();
    return JSON.stringify(data, null, 2);
  }

  async importDatabase(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!data.employees || !data.jobs || !data.logs) {
        throw new Error("Formato backup non valido");
      }
      
      await this.bulkImport(data.jobs, data.logs, data.employees);
      await this.savePermissions(data.permissions);
      await this.saveSettings(data.settings);
      
      const batch = writeBatch(db);
      (data.attendance || []).forEach((a: AttendanceRecord) => batch.set(doc(db, 'attendance', a.id), a));
      (data.justifications || []).forEach((j: DayJustification) => batch.set(doc(db, 'justifications', j.id), j));
      
      await batch.commit();

      return true;
    } catch (e) {
      console.error("Failed to import database", e);
      return false;
    }
  }
}

export const dbService = new DatabaseService();
