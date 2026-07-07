'use client';

// Research → action handoff: stash a Loop Factory prefill and jump to the
// cockpit WORK tab. Mirrors the mazos-taskgate-draft pattern.
export type LoopDraftPrefill = { goal: string; project: string; pattern: string; sources: string };

export function ToLoopButton(prefill: LoopDraftPrefill) {
  return <button
    className="researchGhost toLoop"
    onClick={() => {
      localStorage.setItem('mazos-loopfactory-draft', JSON.stringify(prefill));
      location.href = '/#WORK';
    }}
  >→ Loop Factory</button>;
}
