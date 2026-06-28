'use client';

import { useEffect, useState } from 'react';
import { useFocusStore } from '@/lib/focusStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FocusPage() {
  const { currentSession, sessions, isLoading, fetchSessions, startSession, endSession, addDistraction } = useFocusStore();
  
  const [project, setProject] = useState('JobFilter');
  const [task, setTask] = useState('');
  const [mode, setMode] = useState('50/10');
  
  const [endStatus, setEndStatus] = useState<'done'|'partial'|'abandoned'>('done');
  const [output, setOutput] = useState('');
  const [distractionInput, setDistractionInput] = useState('');

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStart = () => {
    if (!task.trim()) return;
    startSession(project, task, mode);
  };

  const handleEnd = () => {
    endSession(endStatus, output);
    setOutput('');
  };

  const handleAddDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distractionInput.trim()) return;
    addDistraction(distractionInput);
    setDistractionInput('');
  };

  const todaySessions = sessions.filter(s => s.startedAt?.startsWith(new Date().toISOString().split('T')[0]));

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">UltraWork Focus Loop</h1>

      {currentSession ? (
        <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-primary animate-pulse">Session Active</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><strong>Project:</strong> {currentSession.project}</div>
            <div><strong>Task:</strong> {currentSession.task}</div>
            <div><strong>Mode:</strong> {currentSession.mode}</div>
            <div><strong>Started:</strong> {new Date(currentSession.startedAt!).toLocaleTimeString()}</div>
          </div>
          
          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">Log Distraction</h3>
            <form onSubmit={handleAddDistraction} className="flex gap-2">
              <Input 
                value={distractionInput} 
                onChange={e => setDistractionInput(e.target.value)} 
                placeholder="What distracted you?"
              />
              <Button type="submit" variant="secondary">Log</Button>
            </form>
            {currentSession.distractions.length > 0 && (
              <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                {currentSession.distractions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>

          <div className="pt-4 border-t space-y-4">
            <h3 className="font-medium">End Session</h3>
            <div className="flex gap-4">
               <Select value={endStatus} onValueChange={(v: any) => setEndStatus(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  value={output} 
                  onChange={e => setOutput(e.target.value)} 
                  placeholder="Output link or path (optional)"
                  className="flex-1"
                />
            </div>
            <Button onClick={handleEnd} variant="destructive">End Sprint</Button>
          </div>
        </div>
      ) : (
        <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Start New Session</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
                <label className="text-sm font-medium mb-1 block">Project</label>
                <Input value={project} onChange={e => setProject(e.target.value)} />
             </div>
             <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Task</label>
                <Input value={task} onChange={e => setTask(e.target.value)} placeholder="What are you doing?" />
             </div>
             <div>
                <label className="text-sm font-medium mb-1 block">Sprint Mode</label>
                <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25/5">25m work / 5m break</SelectItem>
                    <SelectItem value="50/10">50m work / 10m break</SelectItem>
                    <SelectItem value="90/20">90m work / 20m break</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          </div>
          <Button onClick={handleStart} disabled={!task.trim()} className="mt-4">Start Sprint</Button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Today's Sessions ({todaySessions.length})</h2>
        {isLoading ? (
          <div>Loading...</div>
        ) : todaySessions.length === 0 ? (
          <div className="text-muted-foreground">No sessions today. Time to focus!</div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => (
              <div key={s.id} className="p-3 border rounded flex justify-between items-center text-sm">
                 <div>
                    <span className="font-semibold">{s.project}</span>: {s.task} ({s.mode})
                 </div>
                 <div className="flex gap-3">
                   <span className={`px-2 py-1 rounded text-xs ${s.status === 'done' ? 'bg-green-100 text-green-800' : s.status === 'abandoned' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                     {s.status}
                   </span>
                   {s.output && <span className="text-muted-foreground truncate max-w-[200px]" title={s.output}>{s.output}</span>}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
