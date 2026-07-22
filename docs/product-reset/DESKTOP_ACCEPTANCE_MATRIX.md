# Installed desktop acceptance matrix

This matrix must be completed using an installed CI-produced artifact. A development window launched by `tauri dev` does not qualify.

## Test environment

- Commit:
- Workflow run:
- Installer artifact:
- SHA-256:
- Windows version:
- Install path:
- Test date:
- Verifier:

## Preconditions

Confirm these are stopped before launch:

- [ ] Next.js development server on port 3046
- [ ] localhost bridge on port 3047
- [ ] manually launched MAZos Node process
- [ ] old MAZos desktop instance

## Functional checks

| ID | Scenario | Expected result | Evidence | Status |
|---|---|---|---|---|
| D-01 | Install from CI artifact | Installation completes without requiring source checkout | installer log/screenshot | pending |
| D-02 | Launch with all unbundled services stopped | App opens and runtime status is explicit | screenshot | pending |
| D-03 | Runtime backend health | Packaged backend reports healthy and authenticated | response/log | pending |
| D-04 | Projects | Registered projects load from the workspace registry | screenshot/export | pending |
| D-05 | Repository status | Branch, dirty state and recent commits load for a registered workspace | screenshot/log | pending |
| D-06 | Unregistered path | Renderer cannot inspect an arbitrary path | error evidence | pending |
| D-07 | Loops | Existing loops load and are readable | screenshot | pending |
| D-08 | Decisions | Open decisions load and can be resolved through the approved policy | screenshot/event | pending |
| D-09 | Runs | Recent runs and their statuses load | screenshot | pending |
| D-10 | Evidence | Verification output and evidence can be opened | screenshot/artifact | pending |
| D-11 | Safe action | A registered read/safe action executes with structured arguments | run log | pending |
| D-12 | Unsafe action | External/destructive action pauses for explicit approval | decision record | pending |
| D-13 | Toolkit | Skills/capabilities use honest labels; configured is not labelled connected | screenshot/source | pending |
| D-14 | Statistics | Real source is shown, or the UI clearly says unavailable | screenshot | pending |
| D-15 | Hermes profiles | Supported profile operations work or are clearly unavailable | screenshot/log | pending |
| D-16 | Missing backend | Failure is visible and no data panel silently disappears | screenshot | pending |
| D-17 | Cancellation | Long-running child process can be cancelled | process/log evidence | pending |
| D-18 | Shutdown | Closing MAZos stops supervised child processes | process list | pending |
| D-19 | Restart | Persisted state remains consistent after reopening | before/after evidence | pending |
| D-20 | Frontend errors | No uncaught exceptions or missing `/api/mazos/*` requests | console/network evidence | pending |

## Security checks

| ID | Check | Expected result | Status |
|---|---|---|---|
| S-01 | CSP | Non-null, least-privilege policy active | pending |
| S-02 | Workspace scope | All filesystem/Git access resolves through registered IDs | pending |
| S-03 | Shell construction | Renderer cannot supply an arbitrary command string | pending |
| S-04 | Secrets | Credential-shaped content is excluded/redacted from logs | pending |
| S-05 | Hosted boundary | Hosted page cannot execute unrestricted local actions | pending |
| S-06 | Decision record | Every external/destructive action links to an approval record | pending |

## Release gate

A release may be proposed only when:

- all D and S checks pass;
- `npm test`, `npm run lint`, `npm run build`, Rust check and `npm run check:desktop` pass;
- the independent verifier signs this file;
- README matches actual functionality;
- Maz explicitly approves the release.
