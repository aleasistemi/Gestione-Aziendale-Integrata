import { GoogleGenAI } from "@google/genai";
import { Employee, Job, WorkLog } from "../types";

const getSystemInstruction = () => `
Sei un esperto analista aziendale e consulente finanziario per un'azienda manifatturiera.
Il tuo compito è analizzare i dati forniti (commesse, ore lavorate, dipendenti) e fornire insight strategici in lingua ITALIANA.
Rispondi sempre in formato Markdown. Sii conciso, professionale e orientato ai dati.
`;

export const analyzeBusinessData = async (
  prompt: string,
  contextData: { jobs: Job[], logs: WorkLog[], employees: Employee[] },
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    return "API Key mancante nelle impostazioni. Contattare il sistemista.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const dataContext = JSON.stringify({
      summary: "Dati aziendali attuali",
      jobsCount: contextData.jobs.length,
      activeJobs: contextData.jobs.filter(j => j.status === 'In Corso').map(j => ({
        code: j.code,
        budget: j.budgetValue,
        client: j.clientName,
        priority: j.priority
      })),
      employees: contextData.employees.map(e => ({ name: e.name, role: e.role, cost: e.hourlyRate })),
      recentLogsSample: contextData.logs.slice(0, 20)
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Contesto Dati (JSON):
        ${dataContext}

        Domanda Utente: "${prompt}"

        Analizza i dati e fornisci una risposta professionale.
      `,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.2,
      }
    });

    return response.text || "Impossibile generare una risposta al momento.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Si è verificato un errore durante l'analisi AI.";
  }
};