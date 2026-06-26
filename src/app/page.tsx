import React from 'react';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

async function getControlPanelData() {
  const filePath = path.join(process.cwd(), '../../.hermes/mazos/control-panel.yaml');
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents) as any;
    return data;
  } catch (e) {
    console.error("Failed to read control-panel.yaml:", e);
    return null;
  }
}

export default async function Page() {
  const data = await getControlPanelData();
  const toggles = data?.toggles || {};
  const mission = data?.defaults?.active_mission || "UNKNOWN MISSION";
  const priorityRepos = data?.defaults?.priority_repos || [];

  return (
    <>
      <header className="flex justify-between items-center border-b-[3px] border-line pb-[10px] mb-[20px]">
        <div>
          <h1 className="font-['Barlow_Condensed'] text-4xl uppercase m-0">MAZ_OS // CONTROL DECK</h1>
          <div className="font-['JetBrains_Mono'] text-[10px] text-muted mt-[4px]">Local-First Hermes Cockpit</div>
        </div>
        <div className="font-['JetBrains_Mono'] text-[12px] text-accent uppercase">
          MISSION: <span className="text-ink">{mission}</span>
        </div>
      </header>

      <div className="grid grid-cols-[250px_1fr_300px] gap-5">
        <aside>
          <div className="bg-card border border-line rounded-[4px] p-[15px] mb-[15px]">
            <div className="flex justify-between items-center border-b border-line pb-[8px] mb-[12px]">
              <h2 className="text-xl">Active Toggles</h2>
              <span className="font-['JetBrains_Mono'] text-[9px] bg-line px-[6px] py-[2px] rounded uppercase text-ink">YAML</span>
            </div>
            <div className="flex flex-col gap-[6px]">
              {Object.entries(toggles).map(([key, value]) => (
                <div key={key} className={`p-[6px_10px] bg-bg border-l-[3px] font-['JetBrains_Mono'] text-[11px] uppercase flex justify-between ${value ? 'border-green text-ink' : 'border-line text-muted'}`}>
                  <span>{key.replace(/_/g, ' ')}</span>
                  <span>{value ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-card border border-line rounded-[4px] p-[15px] mb-[15px]">
            <div className="flex justify-between items-center border-b border-line pb-[8px] mb-[12px]">
              <h2 className="text-xl">Repo Priority</h2>
            </div>
            <div className="flex flex-col gap-[6px]">
               {priorityRepos.map((repo: string, i: number) => (
                <div key={repo} className={`p-[6px_10px] bg-bg border-l-[3px] font-['JetBrains_Mono'] text-[11px] uppercase ${i === 0 ? 'border-green text-ink' : 'border-line text-muted'}`}>
                  {i + 1}. {repo}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main>
          <div className="bg-card border border-line rounded-[4px] p-[15px] mb-[15px]">
            <div className="flex justify-between items-center border-b border-line pb-[8px] mb-[12px]">
              <h2 className="text-xl">Action Deck</h2>
              <span className="font-['JetBrains_Mono'] text-[9px] bg-green/20 text-green px-[6px] py-[2px] rounded uppercase border border-green/30">Safe</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
               {/* Action deck populated from buttons.json or static for now */}
               <div className="bg-paper border border-line p-[10px] text-center cursor-pointer hover:border-accent">
                 <div className="font-['Barlow_Condensed'] text-lg">Build App</div>
               </div>
            </div>
          </div>
        </main>
        
        <aside>
           <div className="bg-card border border-line rounded-[4px] p-[15px]">
             <h2 className="text-xl border-b border-line pb-[8px] mb-[12px]">System Logs</h2>
             <div className="font-['JetBrains_Mono'] text-[10px] text-muted h-[400px] overflow-y-auto">
                No logs available yet.
             </div>
           </div>
        </aside>
      </div>
    </>
  );
}