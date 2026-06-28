# Focus Loop Research

## Data Shape
```json
{
  "id": "focus-YYYY-MM-DD-001",
  "startedAt": "ISO timestamp",
  "endedAt": "ISO timestamp",
  "project": "JobFilter",
  "task": "Research competitors",
  "mode": "50/10",
  "status": "done|partial|abandoned",
  "output": "path-or-url",
  "distractions": []
}
```

## Sprint Modes
- 25/5: Pomodoro classic
- 50/10: Deep work block
- 90/20: Ultra-deep (research, writing)

## Storage
Sessions stored at: `~/.hermes/mazos/focus-sessions.json`

## Routes
- GET `/api/mazos/focus` - list all sessions
- POST `/api/mazos/focus` - create session
- PUT `/api/mazos/focus` - update session (end it)
- GET `/api/mazos/email` - check Resend email status

## Email Detection Logic
- Reads `RESEND_API_KEY` from env
- Falls back to `NOTIFY_EMAIL` else `manazoid4@gmail.com`
- `EMAIL_FROM` optional override
- Status = "active" if key present, "inactive" + reason if not
