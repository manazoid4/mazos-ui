'use client';

import { useEffect, useMemo, useState } from 'react';

type AgentMode = 'prompt-only' | 'safe shell' | 'build/lint' | 'research-first';
type RepoOption = { label: string; path: string };
type GateInput = {
  repoPath: string;
  repoLabel: string;
  task: string;
  successCriteria: string;
  forbiddenActions: string;
  agent: string;
  mode: AgentMode;
  urgency: string;
  expectedFiles: string;
  runBuild: boolean;
  runLint: boolean;
  allowShell: boolean;
  researchFirst: boolean;
};
type GateOutput = {
  approved: boolean;
  score: number;
  riskLevel: 'safe' | 'caution' | 'danger';
  blockers: string[];
  warnings: string[];
  missingInfo: string[];
  recommendedAgentMode: AgentMode;
  suggestedPrompt: string;
  successChecklist: string[];
  validationCommands: string[];
  forbiddenActions: string[];
  nextBestAction: string;
  smallerSessions: string[];
  savedTo?: string;
};
type MissionPlan = {
  mission: string;
  agentMode: string;
  likelyFiles: string[];
  successCriteria: string[];
  forbiddenActions: string[];
  validationCommands: string[];
  hermesPrompt: string;
  fallbackPlan: string[];
  handoffTemplate: string;
  score: number;
  riskLevel: string;
  savedTo: string;
};

const LOCAL_BRIDGE = 'http://127.0.0.1:3047';
const defaultForbidden = [
  'No destructive commands.',
  'No force push.',
  'No credential changes.',
  'No global installs.',
  'No recurring loops.',
  'No private scraping or authentication bypass.',
  'Do not push to GitHub unless Maz explicitly asks.',
].join('\n');

function shouldUseLocalBridge() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && window.location.hostname.includes('vercel.app');
}

async function mazosFetch(path: string, init?: RequestInit) {
  if (shouldUseLocalBridge()) {
    try {
      const res = await fetch(`${LOCAL_BRIDGE}${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
    } catch {
      // Fall through to hosted API for read-only fallback.
    }
  }
  return fetch(path, init);
}

export default function SessionsPage() {
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [busy, setBusy] = useState('');
  const [gate, setGate] = useState<GateOutput | null>(null);
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState<GateInput>({
    repoPath: '',
    repoLabel: 'MAZos',
    task: 'Add one scoped improvement that helps MAZos prevent bad agent sessions before they start.',
    successCriteria: '',
    forbiddenActions: defaultForbidden,
    agent: 'Hermes',
    mode: 'prompt-only',
    urgency: 'normal',
    expectedFiles: 'src/lib/mazos/*\nsrc/app/api/mazos/*\nsrc/app/sessions/page.tsx',
    runBuild: true,
    runLint: true,
    allowShell: false,
    researchFirst: true,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    mazosFetch('/api/mazos/task-gate')
      .then((res) => res.json())
      .then((data) => {
        const nextRepos = data.repos || [];
        setRepos(nextRepos);
        if (nextRepos[0]) {
          setForm((current) => ({
            ...current,
            repoPath: current.repoPath || nextRepos[0].path,
            repoLabel: current.repoLabel || nextRepos[0].label,
          }));
        }
        if (data.latest) setGate(data.latest);
      })
      .catch(() => undefined);
  }, []);

  const statusText = useMemo(() => {
    if (!gate) return 'No gate run yet.';
    if (gate.blockers.length) return 'Blocked until the launch input is safer.';
    if (gate.approved) return 'Approved for prompt launch. MAZos will not start it automatically.';
    return 'Needs prompt repair or smaller scope.';
  }, [gate]);

  function update<K extends keyof GateInput>(key: K, value: GateInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function checkTask() {
    setBusy('gate');
    setPlan(null);
    const res = await mazosFetch('/api/mazos/task-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGate(data);
    setBusy('');
  }

  async function generateMissionPlan() {
    setBusy('plan');
    const res = await mazosFetch('/api/mazos/mission-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setPlan(data);
    setBusy('');
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  }

  function improvePrompt() {
    if (!gate) {
      checkTask();
      return;
    }
    update('successCriteria', gate.successChecklist.join('\n'));
    update('forbiddenActions', gate.forbiddenActions.join('\n'));
    update('mode', gate.recommendedAgentMode);
  }

  function makeSmaller() {
    if (!gate) return;
    update('task', gate.smallerSessions.join('\n\n'));
    update('mode', 'research-first');
  }

  const selectedRepo = repos.find((repo) => repo.path === form.repoPath);

  return <main className="shell taskShell">
    <header className="topbar">
      <div>
        <p className="eyebrow">AGENT PREFLIGHT</p>
        <h1>Agent Task Gate</h1>
        <p className="mission">Validate the mission before launching Hermes, Codex, OpenCode, Aider, or any local agent session.</p>
      </div>
      <div className="topStats">
        <b>{gate ? gate.score : '--'}</b>
        <span>{gate?.riskLevel || 'not checked'}</span>
        <span>{gate?.approved ? 'approved' : 'not approved'}</span>
        <span>{form.mode}</span>
      </div>
    </header>

    <nav className="tabs">
      <button className="tabBtn" onClick={() => { location.href = '/'; }}>COCKPIT</button>
      <button className="tabBtn active">TASK GATE</button>
    </nav>

    <section className="split taskGrid">
      <section className="panel">
        <div className="panelHead">
          <h2>Mission Planner Input</h2>
          <small>prompt repair · safety · scope</small>
        </div>

        <label className="fieldLabel">Repo</label>
        <select className="input" value={form.repoPath} onChange={(event) => {
          const repo = repos.find((item) => item.path === event.target.value);
          update('repoPath', event.target.value);
          update('repoLabel', repo?.label || selectedRepo?.label || 'Custom');
        }}>
          {repos.map((repo) => <option key={repo.path} value={repo.path}>{repo.label} — {repo.path}</option>)}
          <option value={form.repoPath || ''}>Custom path</option>
        </select>
        <input className="input" value={form.repoPath} onChange={(event) => update('repoPath', event.target.value)} placeholder="C:\Users\manaz\Projects\mazos-ui" />

        <div className="cols">
          <select className="input" value={form.agent} onChange={(event) => update('agent', event.target.value)}>
            {['Hermes', 'Codex', 'OpenCode', 'Aider', 'Claude Code'].map((agent) => <option key={agent}>{agent}</option>)}
          </select>
          <select className="input" value={form.mode} onChange={(event) => update('mode', event.target.value as AgentMode)}>
            {['prompt-only', 'safe shell', 'build/lint', 'research-first'].map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </div>

        <label className="fieldLabel">Task</label>
        <textarea className="input big" rows={7} value={form.task} onChange={(event) => update('task', event.target.value)} placeholder="What should the agent do?" />

        <label className="fieldLabel">Success criteria</label>
        <textarea className="input" rows={4} value={form.successCriteria} onChange={(event) => update('successCriteria', event.target.value)} placeholder="Observable done conditions, one per line." />

        <label className="fieldLabel">Forbidden actions</label>
        <textarea className="input" rows={5} value={form.forbiddenActions} onChange={(event) => update('forbiddenActions', event.target.value)} />

        <label className="fieldLabel">Expected files</label>
        <textarea className="input" rows={3} value={form.expectedFiles} onChange={(event) => update('expectedFiles', event.target.value)} placeholder="Optional files/directories likely involved." />

        <div className="gateToggles">
          <label><input type="checkbox" checked={form.researchFirst} onChange={(event) => update('researchFirst', event.target.checked)} /> Research First</label>
          <label><input type="checkbox" checked={form.runLint} onChange={(event) => update('runLint', event.target.checked)} /> run lint</label>
          <label><input type="checkbox" checked={form.runBuild} onChange={(event) => update('runBuild', event.target.checked)} /> run build</label>
          <label><input type="checkbox" checked={form.allowShell} onChange={(event) => update('allowShell', event.target.checked)} /> request shell</label>
        </div>

        <div className="chips">
          <button className="primary hot" disabled={busy === 'gate'} onClick={checkTask}>{busy === 'gate' ? 'CHECKING...' : 'Check Task'}</button>
          <button className="ghost" onClick={improvePrompt}>Improve Prompt</button>
          <button className="ghost" disabled={!gate} onClick={makeSmaller}>Make Smaller</button>
          <button className="ghost" disabled={busy === 'plan'} onClick={generateMissionPlan}>{busy === 'plan' ? 'PLANNING...' : 'Generate Mission Plan'}</button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <h2>Gate Result</h2>
          <small>{statusText}</small>
        </div>
        {!gate ? <p className="muted">Run Check Task to score this session before launch.</p> : <>
          <div className={`gateScore ${gate.riskLevel}`}>
            <b>{gate.score}</b>
            <span>{gate.riskLevel}</span>
            <small>{gate.approved ? 'approved for prompt launch' : 'needs repair before launch'}</small>
          </div>

          <ResultList title="Blockers" items={gate.blockers} empty="No hard blockers." tone="bad" />
          <ResultList title="Warnings" items={gate.warnings} empty="No warnings." />
          <ResultList title="Missing Info" items={gate.missingInfo} empty="No missing info." />
          <ResultList title="Success Checklist" items={gate.successChecklist} />
          <ResultList title="Validation Commands" items={gate.validationCommands} />
          <ResultList title="Forbidden Actions" items={gate.forbiddenActions} />

          <div className="copyPanel">
            <div className="repoTop">
              <h3>Generated Prompt</h3>
              <button className="ghost" onClick={() => copy(gate.suggestedPrompt, 'prompt')}>Copy Prompt</button>
            </div>
            <pre>{gate.suggestedPrompt}</pre>
          </div>

          <div className="chips">
            <button className="primary" disabled={!gate.approved} onClick={() => copy(gate.suggestedPrompt, 'launch')}>Start Session if Approved</button>
            <button className="ghost" onClick={() => copy(gate.smallerSessions.join('\n\n'), 'smaller')}>Copy 3-Session Split</button>
          </div>
          {copied && <p className="ok inline">Copied {copied}</p>}
        </>}
      </section>
    </section>

    {plan && <section className="panel">
      <div className="panelHead">
        <h2>Mission Plan</h2>
        <small>saved: {plan.savedTo}</small>
      </div>
      <div className="missionPlanGrid">
        <article><b>Mission</b><p>{plan.mission}</p></article>
        <article><b>Mode</b><p>{plan.agentMode} · score {plan.score} · {plan.riskLevel}</p></article>
        <article><b>Likely files</b><ul>{plan.likelyFiles.map((file) => <li key={file}>{file}</li>)}</ul></article>
        <article><b>Fallback</b><ul>{plan.fallbackPlan.map((item) => <li key={item}>{item}</li>)}</ul></article>
      </div>
      <div className="copyPanel">
        <div className="repoTop">
          <h3>Exact Hermes Launch Prompt</h3>
          <button className="ghost" onClick={() => copy(plan.hermesPrompt, 'mission prompt')}>Copy</button>
        </div>
        <pre>{plan.hermesPrompt}</pre>
      </div>
      <div className="copyPanel">
        <div className="repoTop">
          <h3>Handoff Template</h3>
          <button className="ghost" onClick={() => copy(plan.handoffTemplate, 'handoff')}>Copy</button>
        </div>
        <pre>{plan.handoffTemplate}</pre>
      </div>
    </section>}
  </main>;
}

function ResultList({ title, items, empty, tone }: { title: string; items: string[]; empty?: string; tone?: 'bad' }) {
  return <div className="gateList">
    <h3>{title}</h3>
    {items.length ? <ul className="summaryList">{items.map((item) => <li className={tone === 'bad' ? 'bad inline' : ''} key={item}>{item}</li>)}</ul> : <p className="muted">{empty || 'None.'}</p>}
  </div>;
}
