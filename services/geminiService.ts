
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
    
    // Create a context summary to reduce token usage while keeping relevance
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
      recentLogsSample: contextData.logs.slice(0, 20) // Limit logs sent
    });

    const fullPrompt = `
      Contesto Dati (JSON):
      ${dataContext}

      Domanda Utente: "${prompt}"

      Se la domanda richiede calcoli specifici non presenti nel JSON sommario, fai delle stime basate sui dati disponibili o suggerisci quali dati mancano.
      Analizza eventuali inefficienze, commesse in perdita o dipendenti con performance anomale se richiesto.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.2, // Low temperature for analytical precision
      }
    });

    return response.text || "Impossibile generare una risposta al momento.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Si è verificato un errore durante l'analisi AI. Controlla la validità dell'API Key.";
  }
};
