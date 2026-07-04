# MAZos Access Contract

Updated: 2026-07-04

## Canonical Endpoints

- Hosted MAZos: `https://mazos-command-centre.vercel.app`
- Local MAZos app: `http://127.0.0.1:3046`
- Local bridge for hosted access: `http://127.0.0.1:3047`

## What The Bridge Does

The hosted Vercel site cannot directly read `C:\Users\manaz\...` paths. The browser can call localhost, so MAZos uses a small Windows-local bridge:

`hosted browser -> http://127.0.0.1:3047/api/mazos/* -> http://127.0.0.1:3046/api/mazos/* -> Windows repos/vault`

The bridge only proxies `/api/mazos/*`.

## Auto Start

Windows Scheduled Task:

`MAZos Local Stack`

Trigger: user logon.

Script:

`C:\Users\manaz\Projects\mazos-ui\scripts\start-mazos-local-stack.ps1`

The script starts missing processes only:

```powershell
npm run dev -- -p 3046
npm run bridge
```

It does not start duplicates if ports `3046` or `3047` are already listening.

## Agent Check

Before using MAZos local data, agents should check:

```text
GET http://127.0.0.1:3047/health
GET http://127.0.0.1:3047/api/mazos/repos
```

If both return 200, MAZos hosted/local access is working.

## Safety

- Do not expose the bridge beyond `127.0.0.1`.
- Do not add broad filesystem proxying.
- Keep bridge routes scoped to `/api/mazos/*`.
- Do not scrape private content or touch credentials through MAZos without explicit human approval.
