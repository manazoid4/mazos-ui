'use client';
import { useEffect, useState } from 'react';
import type { ToolkitData } from '@/lib/mazos/toolkit';

export function ToolkitPanel() {
  const [data, setData] = useState<ToolkitData | null>(null);

  useEffect(() => {
    fetch('/api/mazos/toolkit').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return null;

  return (
    <section className="panel">
      <div className="panelHead">
        <h2>Toolkit</h2>
      </div>
      <div className="toolkitGrid">
        <div>
          <h3 className="toolkitSubhead">Top Skills</h3>
          <ul className="toolkitList">
            {data.topSkills.map((s) => (
              <li key={s.name}>
                <span className="toolkitName">{s.name}</span>
                <span className="toolkitMeta muted">{s.category}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="toolkitSubhead">MCP Servers</h3>
          <ul className="toolkitList">
            {data.mcpServers.length === 0 && <li className="muted">None configured</li>}
            {data.mcpServers.map((m) => (
              <li key={m.name}>
                <span className={`dot ${m.connected ? 'dotOk' : 'dotBad'}`} />
                <span className="toolkitName">{m.name}</span>
                <span className="toolkitMeta muted">{m.tools} tools</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
