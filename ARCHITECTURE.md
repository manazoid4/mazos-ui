# ARCHITECTURE

## System Components

1. **React UI (Frontend)**
   - Port: 9999
   - Role: Read-only visualization and command dispatch.
   - Mechanism: Periodically fetches YAML state files.

2. **YAML Configuration (State Storage)**
   - Role: Source of truth for system state and skill availability.
   - Format: Strict YAML. Defines skill endpoints, parameters, and metadata.

3. **Hermes Skills (Backend execution)**
   - Role: Perform the actual work.
   - Mechanism: Expose capabilities that are mapped into the YAML configs. The UI reads these configs to understand what actions are available and their required parameters.

## Data Flow
```
[ Hermes Skills ] <--(writes state)--- [ YAML Configs ] <--(reads state)--- [ React UI ]
                                                                          |
[ Hermes Skills ] <--------------------(dispatches command)---------------/
```

## Design Principles
- **Stateless UI**: The React application maintains no internal state regarding available skills. It relies entirely on the YAML files.
- **Declarative Configuration**: Hermes skills register themselves or are mapped via YAML.
- **Decoupled Execution**: The UI does not execute logic directly; it formats commands according to the YAML schema and dispatches them to Hermes.