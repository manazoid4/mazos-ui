'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_SCREENING, OBJECTION_RESPONSES, buildCallScript, callReadiness,
  type CallOutcome, type Prospect, type ProspectStatus, type WebsiteAudit,
} from '@/lib/mazos/callDesk';

type Draft = Partial<Prospect> & Pick<Prospect, 'businessName' | 'phone'>;
type ApiResult = { prospects?: Prospect[]; audit?: WebsiteAudit; error?: string };

const EMPTY_DRAFT: Draft = {
  businessName: '', phone: '', website: '', contactName: '', area: '', trade: '', source: '',
  status: 'new', screening: { ...EMPTY_SCREENING }, notes: '', nextAction: '', followUpAt: '', calls: [], websiteAudit: null,
};

const STATUS_LABELS: Record<ProspectStatus, string> = {
  new: 'New', researching: 'Researching', ready: 'Ready to call', follow_up: 'Follow up', booked: 'Booked', won: 'Won',
  not_interested: 'Not interested', do_not_call: 'Do not call', archived: 'Archived',
};

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

async function request(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(path, { cache: 'no-store', ...init });
  const result = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function RegisterSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="callField"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>
    <option value="unknown">Not checked</option><option value="clear">Clear</option><option value="registered">Registered — block</option><option value="consented">Specific consent recorded</option>
  </select></label>;
}

function ProspectEditor({ draft, setDraft, save, audit, busy }: {
  draft: Draft; setDraft: (draft: Draft) => void; save: () => void; audit: () => void; busy: string;
}) {
  const screening = draft.screening || { ...EMPTY_SCREENING };
  const setScreening = (change: Partial<Prospect['screening']>) => setDraft({ ...draft, screening: { ...screening, ...change } });
  return <div className="callEditor">
    <section className="callCard">
      <div className="callCardHead"><div><p className="callKicker">Prospect record</p><h2>{draft.id ? draft.businessName : 'Add a business'}</h2></div><button className="callPrimary" onClick={save} disabled={!!busy || !draft.businessName.trim() || !draft.phone.trim()}>{busy === 'save' ? 'Saving…' : 'Save prospect'}</button></div>
      <div className="callFormGrid">
        <label className="callField"><span>Business name *</span><input value={draft.businessName} onChange={event => setDraft({ ...draft, businessName: event.target.value })} /></label>
        <label className="callField"><span>Phone *</span><input value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} /></label>
        <label className="callField"><span>Contact name / role</span><input value={draft.contactName || ''} onChange={event => setDraft({ ...draft, contactName: event.target.value })} placeholder="Owner or website manager" /></label>
        <label className="callField"><span>Website</span><input value={draft.website || ''} onChange={event => setDraft({ ...draft, website: event.target.value })} placeholder="example.co.uk" /></label>
        <label className="callField"><span>Trade</span><input value={draft.trade || ''} onChange={event => setDraft({ ...draft, trade: event.target.value })} placeholder="Builder, dentist, restaurant…" /></label>
        <label className="callField"><span>Area</span><input value={draft.area || ''} onChange={event => setDraft({ ...draft, area: event.target.value })} /></label>
        <label className="callField"><span>Pipeline status</span><select value={draft.status || 'new'} onChange={event => setDraft({ ...draft, status: event.target.value as ProspectStatus })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="callField callSpan"><span>Source — where the public business details came from</span><input value={draft.source || ''} onChange={event => setDraft({ ...draft, source: event.target.value })} placeholder="Google Business Profile, public website, referral…" /></label>
      </div>
    </section>

    <section className="callCard">
      <div className="callCardHead"><div><p className="callKicker">Website evidence</p><h2>Bounded homepage check</h2></div><button className="callSecondary" onClick={audit} disabled={!!busy || !draft.website}>{busy === 'audit' ? 'Checking…' : 'Run website check'}</button></div>
      {!draft.websiteAudit && <p className="callMuted">Checks one public homepage for reachability, HTTPS, mobile setup and clear enquiry paths. It does not crawl the whole site or claim a full accessibility, SEO, or security audit.</p>}
      {draft.websiteAudit && <div className="auditResult">
        <div className="auditScore"><b>{draft.websiteAudit.score}</b><span>/ 100 signal score</span><small>{formatDate(draft.websiteAudit.checkedAt)} · {draft.websiteAudit.durationMs} ms</small></div>
        <div className="auditFindings">{draft.websiteAudit.findings.map(finding => <div key={`${finding.label}-${finding.evidence}`} className={`auditFinding ${finding.severity}`}><b>{finding.label}</b><span>{finding.evidence}</span></div>)}</div>
      </div>}
    </section>

    <section className="callCard screeningCard">
      <div className="callCardHead"><div><p className="callKicker">Pre-call gate</p><h2>Record screening before dialling</h2></div><a className="callTextLink" href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/" target="_blank" rel="noreferrer">ICO guidance ↗</a></div>
      <p className="callMuted">Screen the number against both TPS and CTPS using your registered screening service, then check the Maz Works do-not-call list. “Clear” means you actually checked it; this app does not query the registers for you.</p>
      <div className="callFormGrid screeningGrid">
        <RegisterSelect label="TPS" value={screening.tps} onChange={value => setScreening({ tps: value as Prospect['screening']['tps'] })} />
        <RegisterSelect label="CTPS" value={screening.ctps} onChange={value => setScreening({ ctps: value as Prospect['screening']['ctps'] })} />
        <label className="callField"><span>Maz Works suppression list</span><select value={screening.ownList} onChange={event => setScreening({ ownList: event.target.value as Prospect['screening']['ownList'] })}><option value="unknown">Not checked</option><option value="clear">Clear</option><option value="blocked">Do not call</option></select></label>
        <label className="callField"><span>Checked at</span><input type="datetime-local" value={screening.checkedAt ? screening.checkedAt.slice(0, 16) : ''} onChange={event => setScreening({ checkedAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label>
        <label className="callField callSpan"><span>Screening evidence / consent note</span><input value={screening.note} onChange={event => setScreening({ note: event.target.value })} placeholder="Screening provider/reference, or when and how specific consent was given" /></label>
      </div>
    </section>

    <section className="callCard">
      <p className="callKicker">Research notes</p>
      <textarea className="callNotes" rows={5} value={draft.notes || ''} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="What the business does, likely decision-maker, visible context, and anything you must not misrepresent…" />
    </section>
  </div>;
}

function LiveCall({ prospect, saveCall, cancel, busy }: { prospect: Prospect; saveCall: (payload: { callId: string; outcome: CallOutcome; notes: string; nextAction: string; followUpAt: string }) => void; cancel: () => void; busy: string }) {
  const [callId] = useState(() => `call-${crypto.randomUUID()}`);
  const [outcome, setOutcome] = useState<CallOutcome>('interested');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('Send evidence note and offer a 15-minute screen-share');
  const [followUpAt, setFollowUpAt] = useState('');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');
  const script = buildCallScript(prospect);
  async function copy(id: string, value: string) { await navigator.clipboard.writeText(value); setCopied(id); setTimeout(() => setCopied(''), 1200); }
  return <div className="liveCall">
    <header className="liveHeader"><div><p className="callKicker">Live call · {prospect.phone}</p><h2>{prospect.businessName}</h2><p>{prospect.contactName || 'Ask for the owner or person responsible for the website'} · {prospect.area || 'area not recorded'}</p></div><div className="callHeaderActions"><button className="callSecondary" onClick={() => copy('phone', prospect.phone)}>{copied === 'phone' ? 'Copied' : 'Copy number'}</button><button className="callSecondary" onClick={cancel}>Exit call</button></div></header>
    <div className="liveGrid">
      <div className="scriptStack">
        {script.map((section, index) => <article className={`scriptCard ${done.has(section.id) ? 'done' : ''}`} key={section.id}>
          <div className="scriptHead"><button className="scriptCheck" onClick={() => setDone(current => { const next = new Set(current); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>{done.has(section.id) ? '✓' : index + 1}</button><h3>{section.title}</h3>{section.text && <button className="copyMini" onClick={() => copy(section.id, section.text!)}>{copied === section.id ? 'copied' : 'copy'}</button>}</div>
          {section.text && <p className="scriptWords">{section.text}</p>}
          {section.prompts && <ul className="discoveryList">{section.prompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul>}
        </article>)}
        <details className="objections"><summary>Objection responses</summary>{OBJECTION_RESPONSES.map(item => <div className="objection" key={item.label}><b>{item.label}</b><p>{item.text}</p><button className="copyMini" onClick={() => copy(item.label, item.text)}>{copied === item.label ? 'copied' : 'copy'}</button></div>)}</details>
      </div>
      <aside className="callCapture">
        <p className="callKicker">Capture while you listen</p>
        <label className="callField"><span>Call notes</span><textarea rows={11} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Their words, current problem, urgency, decision process…" autoFocus /></label>
        <label className="callField"><span>Outcome</span><select value={outcome} onChange={event => setOutcome(event.target.value as CallOutcome)}><option value="interested">Interested</option><option value="booked">Meeting booked</option><option value="follow_up">Follow up</option><option value="no_answer">No answer</option><option value="gatekeeper">Gatekeeper</option><option value="not_interested">Not interested</option><option value="do_not_call">Do not call</option></select></label>
        <label className="callField"><span>Next action</span><textarea rows={3} value={nextAction} onChange={event => setNextAction(event.target.value)} /></label>
        <label className="callField"><span>Follow-up date</span><input type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} /></label>
        <button className="callPrimary" disabled={!!busy} onClick={() => saveCall({ callId, outcome, notes, nextAction, followUpAt: followUpAt ? new Date(followUpAt).toISOString() : '' })}>{busy === 'call' ? 'Saving…' : 'Save outcome + next call'}</button>
        {outcome === 'do_not_call' && <p className="callWarning">This permanently marks the prospect as suppressed in the Maz Works list.</p>}
      </aside>
    </div>
  </div>;
}

export default function CallDeskPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, screening: { ...EMPTY_SCREENING } });
  const [mode, setMode] = useState<'edit' | 'call'>('edit');
  const [busy, setBusy] = useState('load');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | ProspectStatus>('active');

  async function load() {
    setBusy('load');
    try {
      const result = await request('/api/mazos/call-desk');
      setProspects(result.prospects || []);
      if (!selectedId && result.prospects?.length) select(result.prospects[0]);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(''); }
  }
  useEffect(() => { load(); /* one local load on mount */ /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function select(prospect: Prospect) { setSelectedId(prospect.id); setDraft(structuredClone(prospect)); setMode('edit'); setMessage(''); }
  function addNew() { setSelectedId(''); setDraft({ ...EMPTY_DRAFT, screening: { ...EMPTY_SCREENING } }); setMode('edit'); setMessage(''); }

  async function saveDraft(nextDraft = draft, success = 'Prospect saved.') {
    setBusy('save'); setMessage('');
    try {
      const result = await request('/api/mazos/call-desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upsert', prospect: nextDraft }) });
      setProspects(result.prospects || []);
      const saved = (result.prospects || []).find(item => item.id === nextDraft.id) || (result.prospects || [])[0];
      if (saved) select(saved);
      setMessage(success);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(''); }
  }

  async function runAudit() {
    setBusy('audit'); setMessage('');
    try {
      const result = await request('/api/mazos/site-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: draft.website }) });
      const next = { ...draft, websiteAudit: result.audit };
      setDraft(next);
      await saveDraft(next, 'Website evidence checked and saved.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setBusy(''); }
  }

  async function saveCall(payload: { callId: string; outcome: CallOutcome; notes: string; nextAction: string; followUpAt: string }) {
    if (!selectedId) return;
    setBusy('call'); setMessage('');
    try {
      const result = await request('/api/mazos/call-desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'call', id: selectedId, ...payload }) });
      setProspects(result.prospects || []);
      const updated = (result.prospects || []).find(item => item.id === selectedId);
      if (updated) select(updated);
      setMessage('Call saved. The next action is in the queue.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(''); }
  }

  const selected = prospects.find(item => item.id === selectedId);
  const readiness = selected ? callReadiness(selected) : { ready: false, reasons: ['Save the prospect first.'] };
  const visible = useMemo(() => prospects.filter(item => {
    const matchesFilter = filter === 'active' ? !['archived', 'do_not_call', 'not_interested'].includes(item.status) : item.status === filter;
    const haystack = `${item.businessName} ${item.area} ${item.trade} ${item.phone}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  }), [prospects, filter, query]);
  const stats = {
    active: prospects.filter(item => !['archived', 'do_not_call', 'not_interested'].includes(item.status)).length,
    ready: prospects.filter(item => callReadiness(item).ready).length,
    followUps: prospects.filter(item => item.status === 'follow_up').length,
    booked: prospects.filter(item => item.status === 'booked').length,
  };

  if (mode === 'call' && selected) return <main className="callDeskShell"><LiveCall prospect={selected} saveCall={saveCall} cancel={() => setMode('edit')} busy={busy} /></main>;

  return <main className="callDeskShell">
    <header className="callTopbar"><div><p className="callKicker">MAZ WORKS · LOCAL SALES WORKSTATION</p><h1>CALL DESK</h1><p className="callSubtitle">Evidence first. Honest conversation. One bounded next step.</p></div><nav><a href="/">Loop Cockpit</a><a href="/hermes">Hermes</a></nav></header>
    <section className="callStats"><div><b>{stats.active}</b><span>active prospects</span></div><div><b>{stats.ready}</b><span>screened + ready</span></div><div><b>{stats.followUps}</b><span>follow-ups</span></div><div><b>{stats.booked}</b><span>meetings booked</span></div></section>
    {message && <div className="callMessage" role="status">{message}</div>}
    <div className="callWorkspace">
      <aside className="prospectRail">
        <div className="railHead"><div><p className="callKicker">Queue</p><h2>Who to call</h2></div><button className="addProspect" onClick={addNew}>+ Add</button></div>
        <input className="railSearch" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search business, area, trade…" />
        <div className="railFilters"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button><button className={filter === 'ready' ? 'active' : ''} onClick={() => setFilter('ready')}>Ready</button><button className={filter === 'follow_up' ? 'active' : ''} onClick={() => setFilter('follow_up')}>Follow up</button><button className={filter === 'booked' ? 'active' : ''} onClick={() => setFilter('booked')}>Booked</button></div>
        <div className="prospectList">{busy === 'load' && <p className="callMuted">Loading local prospects…</p>}{!busy && !visible.length && <div className="emptyQueue"><b>No prospects here yet.</b><span>Add one business and run the website check.</span></div>}{visible.map(item => {
          const ready = callReadiness(item).ready;
          return <button key={item.id} className={`prospectRow ${item.id === selectedId ? 'selected' : ''}`} onClick={() => select(item)}><span className={`readinessDot ${ready ? 'ready' : ''}`} /><span><b>{item.businessName}</b><small>{item.trade || 'Trade not set'} · {item.area || 'Area not set'}</small></span><em>{STATUS_LABELS[item.status]}</em></button>;
        })}</div>
      </aside>
      <section className="callMain">
        {selected && <div className={`readinessBar ${readiness.ready ? 'ready' : 'blocked'}`}><div><b>{readiness.ready ? 'Ready for a live call' : 'Not call-ready yet'}</b><span>{readiness.ready ? 'Screening is current and clear. Use your normal phone with caller ID displayed.' : readiness.reasons[0]}</span></div><button className="callPrimary" disabled={!readiness.ready} onClick={() => setMode('call')}>Open call script →</button></div>}
        <ProspectEditor draft={draft} setDraft={setDraft} save={() => saveDraft()} audit={runAudit} busy={busy} />
        {selected?.calls.length ? <section className="callCard"><p className="callKicker">History</p><h2>{selected.calls.length} logged call{selected.calls.length === 1 ? '' : 's'}</h2><div className="callTimeline">{[...selected.calls].reverse().map(call => <article key={call.id}><time>{formatDate(call.at)}</time><b>{call.outcome.replace('_', ' ')}</b><p>{call.notes || 'No notes recorded.'}</p>{call.nextAction && <small>Next: {call.nextAction}{call.followUpAt ? ` · ${formatDate(call.followUpAt)}` : ''}</small>}</article>)}</div></section> : null}
      </section>
    </div>
    <footer className="callFooter"><span>Local-only prospect records · no recording · no automated dialling</span><a href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-live-calls/" target="_blank" rel="noreferrer">ICO live-call guidance ↗</a></footer>
  </main>;
}
