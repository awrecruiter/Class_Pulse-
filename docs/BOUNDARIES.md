# Boundaries

This repo needs explicit product and technical boundaries before adding more agent-driven implementation. The goal is to reduce cross-feature regressions, preserve settings contracts, and keep FERPA-sensitive changes isolated.

## Core Principles

- Existing settings are behavioral contracts.
- Reliability fixes must be additive and opt-in when settings are involved.
- Intent classification, domain execution, and UI feedback should not live in the same layer.
- FERPA-sensitive data access must be explicit and reviewable.
- OpenHands tasks must be scoped to one bounded subsystem whenever possible.

## Product Modules

### 1. Classroom Core

Owns:

- classes
- roster
- groups
- behavior ladder
- RAM Bucks
- parent comms workflows

Examples in current repo:

- `src/app/api/classes/**`
- `src/lib/db/schema.ts`

Must not own:

- speech recognition
- agent prompting
- page-level routing decisions
- UI toast behavior

### 2. Resource Navigation

Owns:

- schedule
- schedule docs
- board resources
- app and portal open intents

Examples in current repo:

- `src/app/api/schedule/**`
- `src/components/board/**`
- `src/components/schedule/**`

Must not own:

- classroom behavior rules
- instructional decisioning
- student mastery progression

### 3. Instructional Coach

Owns:

- DI workflows
- lecture support
- remediation
- manipulatives
- mastery support
- ambient coaching surfaces

Examples in current repo:

- `src/app/(dashboard)/coach/**`
- `src/components/coach/**`
- `src/app/api/coach/**`

Must not own:

- global navigation policy
- global settings semantics
- external app opening policy

### 4. Agent Platform

Owns:

- LangGraph workflows
- OpenHands orchestration
- voice command classification
- future RAG orchestration
- future patient-agent sessions

Suggested location:

- `src/lib/agents/**`

Must not own:

- direct classroom business rules
- direct DB mutations for feature domains
- page rendering concerns

### 5. Platform

Owns:

- auth
- settings
- local preferences
- auditing
- observability
- data access policy

Examples in current repo:

- `src/lib/auth/**`
- `src/lib/ui-prefs.ts`
- `src/app/api/teacher-settings/route.ts`

Must not own:

- feature-specific workflow logic

## Contract Boundaries

### Settings Contracts

These existing contracts must not be reinterpreted implicitly:

- `scheduleDocOpenMode`
- `voiceNavMode`
- `voiceAppOpenMode`
- queue behavior
- handoff mode

Rule:

- new reliability behavior must be additive and opt-in
- existing mode semantics must remain intact

### Voice Contracts

Rule:

- classify intent separately from execution
- execute through settings-aware handlers
- avoid page-specific shortcuts as the only execution path

### FERPA / Sensitive Data Contracts

Data classes:

1. Directory / identity
- student IDs
- names
- parent names
- parent phone numbers

2. Instructional records
- mastery
- gradebook
- interventions
- behavior incidents

3. Operational telemetry
- logs
- traces
- queue events
- agent execution summaries

Rules:

- prompts should avoid unnecessary PII
- logs should default to redacted values
- sensitive routes should not be modified by broad refactors

## Execution Boundary Rules

When extracting or refactoring:

- page files should orchestrate, not own domain logic
- domain logic should be reusable outside a mounted page
- external service calls should be isolated behind feature services
- graph nodes should call bounded services, not arbitrary page code

## OpenHands Scoping Rules

Each OpenHands task should:

- target one module at a time
- declare files in scope
- declare sensitive files to avoid
- preserve current settings contracts
- include required regression tests

OpenHands should not be used first for:

- auth redesign
- FERPA-sensitive data model changes
- parent contact handling changes
- broad schema rewrites

Safer first use cases:

- coach extraction
- voice execution extraction
- test coverage improvements
- route-independent command handling
