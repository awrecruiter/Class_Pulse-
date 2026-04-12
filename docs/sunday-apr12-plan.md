# Sunday April 12, 2026 9PM Plan

## Objective

By **Sunday, April 12, 2026 at 9:00 PM Eastern**, complete the highest-leverage work for these three goals:

1. Replace the current database target with an AWS-hosted managed PostgreSQL option that can support FERPA-sensitive deployments.
2. Splinter the app into three product surfaces that can be enabled independently.
3. Refine the features in each product surface so packaging is clear and implementation can proceed.

## Reality Check

All three goals are too large to fully finish as production rollouts by that deadline if interpreted as:
- fully migrated production database
- complete billing system
- complete subscription enforcement across the app
- final pricing and packaging copy

The realistic target by Sunday is:

## What Can Be Done By Sunday

### 1. Database

- Finalize the target DB decision as **AWS Aurora PostgreSQL**
- Create the AWS-specific migration runbook
- Prepare the repo and deployment configuration for the new `DATABASE_URL`
- Optionally provision the Aurora environment and test schema load

### 2. Service-Level Splintering

- Define exactly **three feature surfaces**
- Add a first-class surface model in the codebase
- Add server-side feature-gate helpers
- Gate a small but meaningful first set of surface-specific features behind those helpers

### 3. Surface Refinement

- Publish a clean feature matrix for the three surfaces
- Decide what stays in each surface
- Decide what is not ready to be sold yet

That gives you a real architecture foundation by Sunday instead of a half-built pricing-tier mess.

## Recommended Three Product Surfaces

Use these splits unless product strategy already requires something else:

### Surface 1: Behavior / Class Management

Best for:
- solo teachers
- classroom operations
- behavior systems
- student management

Include:
- classes and roster management
- student join flow
- class sessions
- groups
- behavior ladder
- incidents and consequences
- RAM Bucks
- classroom economy / store
- parent contacts basics
- basic voice navigation and core commands

Exclude:
- AI instructional coach
- ambient classroom intelligence
- academic guidance
- planning automation
- schedule extraction/import

### Surface 2: Instructional Coach

Best for:
- teachers who want live AI support during instruction
- users who need coaching and intervention support

Include:
- AI instructional coach
- behavior coach
- ambient scan and classroom intelligence
- academic guidance
- advanced voice agent workflows for coaching
- visualizer and remediation flows
- lecture transcript intelligence
- intervention recommendations

Exclude:
- schedule extraction/import
- lesson planning workflows
- long-range prep workflows

### Surface 3: Planning

Best for:
- lesson prep
- schedule setup
- teacher planning workflows

Include:
- manual schedule management
- schedule extraction/import
- planning resources and linked docs
- lesson planning workflows
- planning-oriented voice flows
- parent communication drafting workflows

Exclude:
- live ambient analysis
- live instructional coaching
- in-class intervention tooling

## Recommended Feature Matrix

This matrix is based on the features that already exist in the repo today, not hypothetical future packaging.

### Behavior / Class Management

- Classes
- Rosters
- Groups
- Class sessions
- Student join sessions
- DI session setup and group movement
- Behavior profiles
- RAM Bucks
- Group accounts / group coins
- Behavior incidents
- Consequence ladder
- Store open/close
- Store purchases and approval flow
- Gradebook / mastery records
- Timeline and class operations reporting
- Parent contacts basics
- Basic voice navigation
- Core voice actions for class control: groups, RAM Bucks, behavior, store
- Board / in-class activity launch surfaces

### Instructional Coach

- AI coach
- Behavior coach
- Ambient scan
- Academic guidance
- Animated visualizer
- Advanced voice agent
- Lecture transcript intelligence
- Intervention recommendations
- DI voice assistance
- Live coaching overlays on the coach page
- Voice-driven "ask coach" and instructional action routing

### Planning

- Schedule CRUD
- Schedule extraction/import
- ICS parsing and proposed schedule block generation
- Schedule docs and open-doc workflows
- Lesson planning workflows
- Planning resources and docs
- Parent communication drafting workflows
- Planning-oriented voice flows
- Settings surfaces for schedule and voice behavior

## Cross-Surface Foundations

These should be treated as shared platform foundations rather than belonging to only one surface:

- Auth and teacher session management
- Student signed-cookie join security
- Organizations / subscriptions / entitlements
- Settings and preference contracts
- Voice routing and queue infrastructure
- Core class selection / active class context
- Base reporting and auditability needed for all surfaces

## Recommended Current Repo Mapping

If you need a practical first-pass split for this codebase, map the current top-level surfaces like this:

- `Behavior / Class Management`
  - `/classes`
  - major class-management APIs under `src/app/api/classes/*`
  - `/store`
  - class behavior, RAM Bucks, purchases, groups, roster, timeline
- `Instructional Coach`
  - `/coach`
  - `src/app/api/coach/*`
  - ambient scan, academic guidance, behavior coach, visualization, voice coaching flows
- `Planning`
  - schedule components under `src/components/schedule/*`
  - schedule extraction and ICS parsing
  - `/parent-comms` where the workflow is draft/planning oriented
  - settings areas that control schedule-doc and planning-oriented voice behavior

## Feature Decisions To Finalize This Weekend

These are the unresolved boundaries that should be explicitly decided instead of implied:

- Whether `parent comms` belongs entirely to `Planning` or is split between `Behavior / Class Management` and `Planning`
- Whether `gradebook / mastery` stays with `Behavior / Class Management` or becomes partly `Planning`
- Whether `groups` and `DI sessions` are operational classroom management or partly instructional coaching
- Whether the universal voice agent is a shared foundation or a paid capability attached mainly to `Instructional Coach`

## Features That Should Not Be Used For Surface Splitting Yet

Do **not** gate these first:

- core auth
- student join security
- signed cookie flows
- existing settings semantics
- any feature whose gating would silently change current teacher behavior

Reason:
- settings are behavioral contracts in this repo
- voice and navigation flows have explicit guardrails
- gating must be additive and explicit

## Codebase Strategy For Splintering

The app does **not** currently have:
- subscription entities
- customer organizations
- tenant-aware billing state
- entitlement checks

So the correct Sunday implementation slice is:

## Sunday Code Slice

### Add a subscription model

Create:
- a service-surface enum
- a feature flag registry
- a server helper that answers: `isFeatureEnabledForUser(...)`

Recommended files:
- `src/lib/subscription/plans.ts`
- `src/lib/subscription/features.ts`
- `src/lib/subscription/gates.ts`

### Add DB support

Add minimal new tables:
- `organizations`
- `organization_memberships`
- `subscriptions`

Do **not** build Stripe or full billing this weekend unless absolutely required.

### Add gating at the server boundary

Gate features in:
- AI routes
- planning routes
- parent communication routes where they map to planning or coaching
- voice-agent routes that open or invoke surface-specific workflows

Do not rely on client-only gating.

### Add UI visibility

Add:
- current enabled surfaces indicator in settings
- locked-state UI for unavailable surfaces
- explicit activation or upgrade messaging

## Specific Repo Areas To Touch

### Database and schema

- `src/lib/db/schema.ts`
- new migration under `drizzle/`

### Auth and org attachment

- `src/lib/auth/server.ts`
- any user bootstrap path that can attach a teacher to an organization/subscription

### Feature-gated APIs

- `src/app/api/coach/route.ts`
- `src/app/api/coach/academic-guidance/route.ts`
- `src/app/api/coach/ambient-scan/route.ts`
- `src/app/api/coach/visualize/route.ts`
- `src/app/api/schedule/extract/route.ts`
- possibly parent comms routes depending on how aggressively you split planning vs coaching

### UI surfaces

- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/coach/page.tsx`
- schedule import UI when added
- surface-specific panels and actions

## Database Replacement Plan

Even though the buyer environment is Microsoft-centric, this specific goal says AWS, so use:

## AWS Target

- **AWS Aurora PostgreSQL**

Reason:
- best AWS-hosted fit
- strong operational controls
- generic PostgreSQL compatibility
- best production trajectory if the target is explicitly AWS

### Sunday database deliverable

By Sunday:
- Aurora target documented
- environment provisioning steps prepared
- schema load tested if infrastructure is ready
- cutover checklist written

Do **not** promise full production migration by Sunday unless the infrastructure already exists and you control the deployment path.

## Proposed Weekend Schedule

## Friday Night

- finalize surface names
- finalize feature matrix
- add the architecture docs
- decide first gated feature set

## Saturday

- add subscription schema
- add feature-gate helpers
- gate the first surface-specific server routes
- add settings UI surface indicator

## Sunday

- provision or validate AWS Aurora target
- test schema load
- wire `DATABASE_URL` handling for target environment
- run focused validation
- leave full production cutover as a staged follow-up if infra is not ready

## Minimum Ship By Sunday

To call the weekend successful, ship these:

- documented AWS Aurora target
- documented three-surface feature matrix
- subscription schema in the app
- server-side feature gate helpers
- at least one meaningful surface gate path live in code
- settings/admin visibility of current enabled surfaces

## What Gets Deferred

Defer these until after Sunday:

- full Stripe or billing automation
- full production DB cutover if infrastructure is not already prepared
- auth-provider migration
- full district admin console
- all surface-route gating in one pass

## Recommended Immediate Build Order

1. Add service-surface definitions and feature matrix to code and docs.
2. Add subscription/org schema.
3. Add server-side gates to instructional coach and planning features first.
4. Add surface visibility in settings.
5. Finish the AWS Aurora runbook and environment prep.

## Direct Recommendation

If the deadline is real, do **not** try to fully complete all three business goals as production rollouts by Sunday night.

Instead, by **April 12, 2026 at 9:00 PM Eastern**, complete:
- the AWS Aurora migration plan
- the three-surface packaging definition
- the first code-backed entitlement foundation

That gives you something real, defensible, and extensible instead of three partially broken initiatives.
