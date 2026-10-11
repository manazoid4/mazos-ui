'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, ShieldCheck } from 'lucide-react';
import styles from './VoiceInput.module.css';

// Browser speech recognition is an opt-in convenience, NOT offline STT.
// A browser may route speech to its provider. No implicit permission or execution.
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

export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognizer = useRef<Recognizer | null>(null);
  const alive = useRef(true);

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

  function stop() {
    recognizer.current?.stop();
    recognizer.current = null;
    setListening(false);
  }
  function start() {
    if (listening) { stop(); return; }
    const w = window as SpeechWindow;
    const RecognizerClass = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!RecognizerClass) {
      setError('Voice dictation is unavailable in this browser. You can still type your mission.');
      return;
    }
    try {
      const api = new RecognizerClass();
      recognizer.current = api;
      api.lang = 'en-GB';
      api.continuous = false;
      api.interimResults = false;
      api.onresult = event => {
        const words: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const phrase = event.results[i]?.[0]?.transcript?.trim();
          if (phrase) words.push(phrase);
        }
        if (alive.current && words.length) onTranscript(words.join(' '));
      };
      api.onerror = event => {
        if (alive.current) {
          setError(event.error === 'not-allowed' ? 'Microphone permission denied.' : 'Dictation unavailable: ' + (event.error || 'unknown error'));
          setListening(false);
        }
      };
      api.onend = () => { if (alive.current) {setListening(false); recognizer.current = null;} };
      setError('');
      api.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('Unable to start microphone capture. Check browser permissions.');
    }
  }

  return <div className={styles.wrapper}>
    <div className={styles.row}>
      <button type="button" className={listening ? styles.listening : styles.trigger} onClick={start} disabled={available === null || available === false} aria-pressed={listening} aria-label={listening ? 'Stop voice dictation' : 'Start voice dictation'}>
        {listening ? <MicOff size={16}/> : <Mic size={16}/>}
        {listening ? 'Stop listening' : 'Voice dictation'}
      </button>
      <span className={styles.state}>{listening ? <><i className={styles.dotLive}/>Listening · only until you stop</> : 'Wake word: not connected'}</span>
    </div>
    <p className={styles.disclosure}><ShieldCheck size={13}/>{available === false ? 'This browser does not support built-in dictation. Typing works normally.' : 'Optional browser dictation may be processed online by your browser provider. Words go into the draft only; nothing is sent or executed by MAZos.'}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
