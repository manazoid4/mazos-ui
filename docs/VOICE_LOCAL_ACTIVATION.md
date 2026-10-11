# MAZos personal voice — local activation and limits

**Current state:** Browser push-to-talk is implemented in `/command-center` for browsers with SpeechRecognition. It is OFF until clicked. Browser speech processing may be online; nothing is sent to an agent automatically. The optional openWakeWord detector and read-only wake event bridge are implemented but **not installed or verified on Maz's Razer**.

## One-time Windows activation (optional, consent required)
From an existing local checkout of `mazos-ui`, run once in PowerShell:

```powershell
powershell -NoProfile -File scripts/start-wakeword.ps1 -Install
```

The script installs packages into an isolated Python virtual environment under the current user's LocalAppData (no system PATH or services changed), downloads the noncommercial Hey Jarvis pretrained model, and then starts the listener. Subsequent launches omit `-Install`:

```powershell
powershell -NoProfile -File scripts/start-wakeword.ps1
```

Keep local MAZos running (`npm run dev`, port 3046). Open `/command-center`; when wake status is connected, turn on **Enable Hey Jarvis** (OFF by default). Say "Hey Jarvis", pause, and speak a single command. The detector releases its audio stream for ten seconds and MAZos requests an utterance using browser speech recognition. If the browser blocks programmatic microphone activation, use **Voice dictation** instead. Transcription always enters a **draft**, never executes a command. Stop the Python process with Ctrl+C. No automatic startup or retention by default.

For the packaged Tauri app, set `MAZOS_DATA_DIR` to the actual authenticated backend data directory before starting the wake-word listener. The packaged-app path and microphone handoff **require an installed-Windows acceptance test**; do not claim the installed app is voice-complete on the basis of this script.

## Safety and licensing
- Wake detection runs on-device with [openWakeWord](https://github.com/dscripka/openWakeWord), using ONNX Runtime (Windows) and 16 kHz mono frames. It records only an event ID/timestamp in the private local MAZos runtime folder; **it does not save audio**.
- openWakeWord library code is Apache 2.0. Its included pretrained wake models are CC BY-NC-SA 4.0. This configuration is for **personal noncommercial use** only. Do not ship the models in a Maz Works paid service without appropriate commercial licensing or a properly licensed alternative.
- Browser SpeechRecognition may send utterances to browser-provider servers; it is **not** end-to-end offline. Reuse existing nod/MAZ Core local STT only after verifying its live API and permissions.
- The listener uses the microphone continuously **only while manually running**. Turn it off by stopping the process. No hidden wake listening when the script is stopped; no action can be authorised by voice.
- Intended next integration: Tauri lifecycle-managed process with a validated Windows installer, shared microphone ownership, proven resume after sleep, resource-limit measurements and source-verified STT.
