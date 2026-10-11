'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, ShieldCheck, Radio } from 'lucide-react';
import styles from './VoiceInput.module.css';

type VoiceResult = { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
type Recognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: VoiceResult) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognizer;
  webkitSpeechRecognition?: new () => Recognizer;
};
type WakeStatus = {
  connected: boolean;
  state: 'listening' | 'capture-window' | 'offline' | 'unavailable';
  event: {id: string; at: string} | null;
};

export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [wakeConnected, setWakeConnected] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState('');
  const recognizer = useRef<Recognizer | null>(null);
  const alive = useRef(true);
  const latestCallback = useRef(onTranscript);
  const armedAt = useRef(0);
  const eventSeen = useRef('');

  useEffect(() => { latestCallback.current = onTranscript; }, [onTranscript]);
  useEffect(() => {
    alive.current = true;
    const w = window as SpeechWindow;
    setAvailable(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      alive.current = false;
      recognizer.current?.abort();
      recognizer.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognizer.current?.stop();
    recognizer.current = null;
    if (alive.current) setListening(false);
  }, []);

  const start = useCallback((fromWake = false) => {
    if (recognizer.current) {
      if (!fromWake) stop();
      return;
    }
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) {
      setError('Dictation is unavailable in this browser. Please type your mission.');
      return;
    }
    try {
      const instance = new Constructor();
      instance.lang = 'en-GB';
      instance.continuous = false;
      instance.interimResults = false;
      instance.onresult = event => {
        const parts: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const words = event.results[i]?.[0]?.transcript?.trim();
          if (words) parts.push(words);
        }
        if (alive.current && parts.length) latestCallback.current(parts.join(' '));
      };
      instance.onerror = event => {
        if (!alive.current) return;
        setError(event.error === 'not-allowed' ? 'Microphone permission denied. Wake mode disabled.' : 'Dictation error: ' + (event.error || 'unknown'));
        setListening(false);
        if (event.error === 'not-allowed') setArmed(false);
      };
      instance.onend = () => {
        if (alive.current) setListening(false);
        if (recognizer.current === instance) recognizer.current = null;
      };
      recognizer.current = instance;
      instance.start();
      setError('');
      setListening(true);
    } catch {
      recognizer.current = null;
      setListening(false);
      setError('Unable to activate speech capture. Your browser may require a direct microphone click.');
    }
  }, [stop]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/mazos/wakeword', { cache: 'no-store', signal: AbortSignal.timeout(1600) });
        if (!response.ok) throw new Error('Not connected');
        const payload = await response.json() as WakeStatus;
        if (!active) return;
        setWakeConnected(Boolean(payload.connected));
        if (!armed || !payload.connected || !payload.event) return;
        const eventTime = Date.parse(payload.event.at);
        if (payload.event.id === eventSeen.current || !(eventTime >= armedAt.current)) return;
        eventSeen.current = payload.event.id;
        start(true); // Request transcription ONLY after user explicitly armed wake mode.
      } catch {
        if (active) setWakeConnected(false);
      }
    }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, armed ? 1200 : 8000);
    return () => { active = false; clearInterval(interval); };
  }, [armed, start]);

  function toggleWake() {
    if (armed) {setArmed(false);return;}
    armedAt.current = Date.now();
    eventSeen.current = '';
    setArmed(true);
    setError('');
  }

  return <div className={styles.wrapper}>
    <div className={styles.row}>
      <button type="button" className={listening ? styles.listening : styles.trigger} onClick={() => start(false)} disabled={available !== true} aria-pressed={listening}>
        {listening ? <MicOff size={16}/> : <Mic size={16}/>}
        {listening ? 'Stop dictation' : 'Voice dictation'}
      </button>
      <button type="button" className={armed ? styles.listening : styles.trigger} onClick={toggleWake} disabled={available !== true || !wakeConnected} aria-pressed={armed}>
        <Radio size={15}/> {armed ? 'Hey Jarvis · armed' : 'Enable Hey Jarvis'}
      </button>
    </div>
    <span className={styles.state}>
      {listening ? <><i className={styles.dotLive}/>Listening for your instruction</>
        : wakeConnected ? (armed ? 'Offline wake detector listening · words still require transcription' : 'Local wake detector detected · currently disarmed')
        : 'Local wake detector not running. Voice dictation works separately when supported.'}
    </span>
    <p className={styles.disclosure}><ShieldCheck size={13}/>{available === false ? 'This browser does not support dictation. Use the text input instead.' : 'Wake-word detection is local when the optional openWakeWord listener runs. Browser speech transcription may use an online service. Nothing is sent to an agent without review.'}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
