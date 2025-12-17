
import React, { useState } from 'react';
import { AppDatabase, GlobalSettings, Employee, Job, Role } from '../types';
import { dbService } from '../services/db';
import { Settings, Save, CloudUpload, Users, Briefcase, Truck, Activity } from 'lucide-react';

interface Props {
  data: AppDatabase;
  onRefresh: () => void;
  onUpdateSettings: (settings: GlobalSettings) => Promise<void>;
}

const AdminDashboard: React.FC<Props> = ({ data, onRefresh, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HR' | 'JOBS' | 'FLEET' | 'SETTINGS'>('SETTINGS');
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(data.settings);
  const { settings } = data;

  // Handle local settings changes
  const handleSettingChange = (field: keyof GlobalSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    await onUpdateSettings(localSettings);
    alert("Impostazioni salvate!");
  };

  const handleCloudBackupTest = async () => {
      if (!settings.backupWebhookUrl) {
          alert("Inserisci prima un URL Webhook valido (Pabbly/Zapier).");
          return;
      }
      try {
          const exportData = await dbService.exportDatabase();
          
          // FOR PABBLY: Send as text/plain Blob AND as a raw string field ('json_content')
          const blob = new Blob([exportData], { type: 'text/plain' });
          const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
          
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('filename', filename);
          formData.append('json_content', exportData); // CAMPO CHIAVE PER PABBLY
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
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard Amministrazione</h1>
        <button onClick={onRefresh} className="p-2 bg-white rounded-full shadow hover:bg-slate-100 text-slate-600">
           <Activity size={20} />
        </button>
      </header>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition ${activeTab === 'SETTINGS' ? 'bg-[#EC1D25] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Settings size={20} /> Impostazioni
        </button>
        <button 
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition ${activeTab === 'OVERVIEW' ? 'bg-[#EC1D25] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Activity size={20} /> Panoramica
        </button>
        <button 
          onClick={() => setActiveTab('HR')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition ${activeTab === 'HR' ? 'bg-[#EC1D25] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Users size={20} /> Risorse Umane
        </button>
        <button 
          onClick={() => setActiveTab('JOBS')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition ${activeTab === 'JOBS' ? 'bg-[#EC1D25] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Briefcase size={20} /> Commesse
        </button>
        <button 
          onClick={() => setActiveTab('FLEET')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition ${activeTab === 'FLEET' ? 'bg-[#EC1D25] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Truck size={20} /> Flotta
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Settings className="text-[#EC1D25]" /> Configurazione Sistema
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL Backup (Pabbly/Zapier)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                    value={localSettings.backupWebhookUrl || ''}
                    onChange={(e) => handleSettingChange('backupWebhookUrl', e.target.value)}
                    placeholder="https://connect.pabbly.com/..."
                  />
                  <button 
                    onClick={handleCloudBackupTest}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold"
                  >
                    <CloudUpload size={18} /> Test
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">URL per inviare il backup JSON completo via POST.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Google Gemini API Key</label>
                <input 
                  type="password" 
                  className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                  value={localSettings.geminiApiKey || ''}
                  onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                 <input 
                    type="checkbox" 
                    id="nfc"
                    checked={localSettings.nfcEnabled}
                    onChange={(e) => handleSettingChange('nfcEnabled', e.target.checked)}
                    className="w-5 h-5 text-[#EC1D25] rounded focus:ring-[#EC1D25]"
                 />
                 <label htmlFor="nfc" className="text-slate-700 font-medium">Abilita Scansione NFC Mobile</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Arrotondamento Straordinari (min)</label>
                    <input 
                      type="number" 
                      className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                      value={localSettings.overtimeSnapMinutes}
                      onChange={(e) => handleSettingChange('overtimeSnapMinutes', parseInt(e.target.value))}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Arrotondamento Permessi (min)</label>
                    <input 
                      type="number" 
                      className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#EC1D25] outline-none"
                      value={localSettings.permessoSnapMinutes}
                      onChange={(e) => handleSettingChange('permessoSnapMinutes', parseInt(e.target.value))}
                    />
                 </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button 
                onClick={saveSettings}
                className="bg-[#EC1D25] text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Save size={20} /> Salva Impostazioni
              </button>
            </div>
          </div>
        )}

        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
               <h3 className="text-blue-800 font-bold text-lg mb-2">Dipendenti</h3>
               <p className="text-4xl font-black text-blue-600">{data.employees.length}</p>
             </div>
             <div className="p-6 bg-green-50 rounded-xl border border-green-100">
               <h3 className="text-green-800 font-bold text-lg mb-2">Commesse Attive</h3>
               <p className="text-4xl font-black text-green-600">{data.jobs.filter(j => j.status === 'In Corso').length}</p>
             </div>
             <div className="p-6 bg-purple-50 rounded-xl border border-purple-100">
               <h3 className="text-purple-800 font-bold text-lg mb-2">Mezzi Disponibili</h3>
               <p className="text-4xl font-black text-purple-600">{data.vehicles.filter(v => v.status === 'AVAILABLE').length}</p>
             </div>
          </div>
        )}

        {/* Placeholders for other tabs */}
        {(activeTab === 'HR' || activeTab === 'JOBS' || activeTab === 'FLEET') && (
            <div className="text-center py-12 text-slate-400 italic">
                Funzionalità gestionale completa disponibile nella versione desktop.
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
