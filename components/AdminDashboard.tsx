import React, { useState } from 'react';
import { GlobalSettings } from '../types';
import { dbService } from '../services/db';
import { Save, CloudUpload, Settings } from 'lucide-react';

interface Props {
  settings: GlobalSettings;
  onUpdateSettings: (settings: GlobalSettings) => void;
}

const AdminDashboard: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [webhookUrl, setWebhookUrl] = useState(settings.backupWebhookUrl || '');
  
  const handleSaveSettings = () => {
      onUpdateSettings({
          ...settings,
          backupWebhookUrl: webhookUrl
      });
      alert('Impostazioni salvate!');
  };

  const handleCloudBackupTest = async () => {
      if (!settings.backupWebhookUrl) {
          alert("Inserisci prima un URL Webhook valido (Pabbly/Zapier).");
          return;
      }
      try {
          const data = await dbService.exportDatabase();
          // Use FormData to send as a file attachment
          const blob = new Blob([data], { type: 'application/json' });
          const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('filename', filename);
          formData.append('json_content', data); // Invia anche il testo puro per Pabbly
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
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">Pannello Amministrazione</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
         <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="text-slate-500"/> Configurazione Backup Cloud
         </h2>
         <div className="flex gap-4 items-end">
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL (Pabbly/Zapier)</label>
                <input 
                    type="text" 
                    value={webhookUrl} 
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                    placeholder="https://connect.pabbly.com/..."
                />
            </div>
            <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                <Save size={18} /> Salva
            </button>
         </div>
         
         <div className="mt-4 pt-4 border-t border-slate-100">
             <button onClick={handleCloudBackupTest} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900">
                <CloudUpload size={18} /> Test Manuale Backup Cloud
             </button>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;