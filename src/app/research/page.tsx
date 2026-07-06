import Link from 'next/link';
import type React from 'react';
import { Activity, Archive, ArrowRight, ClipboardList, FileText, GitBranch, Radar, SearchCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { readResearchConsole, type ResearchReport } from '@/lib/mazos/research';

export const dynamic = 'force-dynamic';

const usefulnessLabel: Record<ResearchReport['usefulness'], string> = {
  'build-now': 'build now',
  reference: 'reference',
  audit: 'audit',
  archive: 'archive',
};

const usefulnessIcon: Record<ResearchReport['usefulness'], React.ReactNode> = {
  'build-now': <Sparkles size={15} />,
  reference: <FileText size={15} />,
  audit: <SearchCheck size={15} />,
  archive: <Archive size={15} />,
};

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="researchMetric"><b>{value}</b><span>{label}</span><small>{detail}</small></div>;
}

function ReportCard({ report }: { report: ResearchReport }) {
  return <article className={`researchCard ${report.usefulness}`}>
    <div className="researchCardTop">
      <span className="researchTrack">{report.track}</span>
      <span className="researchUse">{usefulnessIcon[report.usefulness]} {usefulnessLabel[report.usefulness]}</span>
    </div>
    <h2>{report.title}</h2>
    <p>{report.summary}</p>
    <div className="researchMeta">
      <span><FileText size={13} /> {report.file}</span>
      <span><Activity size={13} /> {new Date(report.updatedAt).toLocaleString()}</span>
      <span><Radar size={13} /> {report.sources.length} source(s)</span>
    </div>
    {report.nextActions.length > 0 && <div className="researchActions">
      <b>Next moves</b>
      <ol>{report.nextActions.slice(0, 4).map((action) => <li key={action}>{action}</li>)}</ol>
    </div>}
    <details className="researchDetails">
      <summary>Sections and sources</summary>
      <div className="researchDetailGrid">
        <div>
          <b>Sections</b>
          <ul>{report.sections.map((section) => <li key={section}>{section}</li>)}</ul>
        </div>
        <div>
          <b>Sources</b>
          <ul>{report.sources.slice(0, 8).map((source) => <li key={source}><a href={source}>{source}</a></li>)}</ul>
        </div>
      </div>
    </details>
  </article>;
}

export default function ResearchPage() {
  const research = readResearchConsole();
  const lead = research.reports[0];
  const audit = research.reports.find((report) => report.usefulness === 'audit');

  return <main className="shell researchShell">
    <div className="gridGlow" />
    <header className="topbar researchTop">
      <div>
        <p className="eyebrow">MAZOS RESEARCH CONSOLE</p>
        <h1>Research that turns into loops.</h1>
        <p className="mission">Saved reports are now a product surface: latest-source checks, usefulness audits, build queues, and automation prompts live here instead of disappearing into chat history.</p>
      </div>
      <div className="topRight">
        <div className="topLinks"><Link href="/">COCKPIT</Link><Link href="/sessions">TASK GATE</Link><Link href="/openwiki">OPENWIKI</Link></div>
        <div className="topStats"><b>{new Date(research.generatedAt).toLocaleTimeString()}</b><span>{research.metrics.totalReports} reports</span><span>{research.metrics.sourceCount} sources</span><span>{research.metrics.buildNowCount} build now</span><span>{research.metrics.auditCount} audits</span></div>
      </div>
    </header>

    <section className="researchHero">
      <div className="researchBrief">
        <div className="researchBriefHead"><ShieldCheck size={18} /><span>Current verdict</span></div>
        <h2>Build Loop Doctor before adding more automation.</h2>
        <p>Every research pass points to the same product move: MAZos needs a usefulness gate for loops, panels, and agent handoffs. The page below keeps that research visible and script-readable.</p>
        <div className="researchHeroActions">
          <Link className="researchPrimary" href="/api/mazos/research"><ClipboardList size={16} /> API JSON</Link>
          <a className="researchGhost" href="#queue"><GitBranch size={16} /> Build queue</a>
        </div>
      </div>
      <div className="researchMetrics">
        <Metric label="Deep tracks" value={research.metrics.deepResearchReports} detail="Separate saved research lanes" />
        <Metric label="Unique sources" value={research.metrics.sourceCount} detail="URLs extracted from reports" />
        <Metric label="Build-now docs" value={research.metrics.buildNowCount} detail="Reports with direct implementation value" />
        <Metric label="Latest report" value={lead ? lead.track : 'none'} detail={lead ? lead.file : 'No reports found'} />
      </div>
    </section>

    <section className="researchGrid">
      <div className="researchQueue" id="queue">
        <div className="researchPanelHead"><h2>Next Build Queue</h2><span>research-backed</span></div>
        <ol className="researchQueueList">
          {(research.nextBuildQueue.length ? research.nextBuildQueue : ['Add more research reports under research/mazos.']).map((item, index) =>
            <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p><ArrowRight size={15} /></li>
          )}
        </ol>
      </div>
      <div className="researchAutomation">
        <div className="researchPanelHead"><h2>Automation Prompt</h2><span>copy-ready</span></div>
        <pre>{research.automationPrompt}</pre>
      </div>
    </section>

    {audit && <section className="researchAudit">
      <div>
        <p className="eyebrow">USEFULNESS AUDIT</p>
        <h2>{audit.title}</h2>
        <p>{audit.summary}</p>
      </div>
      <div className="researchAuditCuts">
        <span>Keep: Loop Factory, Feed, Flight Recorder, Context Map</span>
        <span>Merge: Ship Log, Stale Radar, Tool Router</span>
        <span>Demote: Action Matrix, raw system dashboard</span>
      </div>
    </section>}

    <section className="researchReports">
      <div className="researchPanelHead"><h2>Research Reports</h2><span>{research.directory}</span></div>
      <div className="researchCards">{research.reports.map((report) => <ReportCard key={report.id} report={report} />)}</div>
    </section>
  </main>;
}
