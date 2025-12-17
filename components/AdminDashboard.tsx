
import React, { useState } from 'react';
import { dbService } from '../services/db';
import { GlobalSettings } from '../types';
import { CloudUpload, Save } from 'lucide-react';

interface Props {
  settings: GlobalSettings;
  onUpdateSettings: (settings: GlobalSettings) => Promise<void>;
}

const AdminDashboard: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [webhookUrl, setWebhookUrl] = useState(settings.backupWebhookUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
      setIsSaving(true);
      const newSettings = { ...settings, backupWebhookUrl: webhookUrl };
      await onUpdateSettings(newSettings);
      setIsSaving(false);
      alert("Impostazioni salvate!");
  };

  const handleCloudBackupTest = async () => {
      if (!settings.backupWebhookUrl) {
          alert("Inserisci prima un URL Webhook valido (Pabbly/Zapier).");
          return;
      }
      try {
          const data = await dbService.exportDatabase();
          
          const blob = new Blob([data], { type: 'application/json' });
          const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
          
          const formData = new FormData();
          // Invio SOLO il file fisico
          formData.append('file', blob, filename);
          formData.append('type', 'manual_test');

          await fetch(settings.backupWebhookUrl, {
              method: 'POST',
              body: formData
          });
          alert("Backup inviato correttamente al Webhook! Controlla Pabbly.");
      } catch (e) {
          alert("Errore invio backup: " + e);
      }
  };

  return (
      <div className="p-6 bg-white rounded-lg shadow max-w-4xl mx-auto mt-10">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Pannello Amministrazione</h2>
          
          <div className="mb-6 p-4 border border-slate-200 rounded-xl">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                  URL Webhook per Backup (Pabbly/Zapier)
              </label>
              <div className="flex gap-2">
                  <input 
                      type="text" 
                      className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://connect.pabbly.com/..."
                  />
                  <button 
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                      className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition"
                  >
                      <Save size={18} /> Salva
                  </button>
              </div>
          </div>

          <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3 text-slate-800">Backup e Ripristino</h3>
              <div className="flex items-center gap-4">
                  <button 
                      onClick={handleCloudBackupTest}
                      className="bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition shadow-md"
                  >
                      <CloudUpload size={20} /> Test Cloud Backup
                  </button>
                  <p className="text-sm text-slate-500 max-w-md">
                      Invia un backup manuale immediato al webhook configurato per verificare la connessione.
                  </p>
              </div>
          </div>
      </div>
  );
};

export default AdminDashboard;
