# Sunday April 12, 2026 9PM Plan

## Objective

By **Sunday, April 12, 2026 at 9:00 PM Eastern**, complete the highest-leverage work for these three goals:

1. Replace the current database target with an AWS-hosted managed PostgreSQL option that can support FERPA-sensitive deployments.
2. Splinter the app into three service levels that activate different feature sets based on subscription.
3. Refine the features in each service level so packaging is clear and implementation can proceed.

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

- Define exactly **three tiers**
- Add a first-class tier model in the codebase
- Add server-side feature-gate helpers
- Gate a small but meaningful first set of premium features behind those helpers

### 3. Tier Refinement

- Publish a clean feature matrix for the three tiers
- Decide what stays in each tier
- Decide what is not ready to be sold yet

That gives you a real architecture foundation by Sunday instead of a half-built billing mess.

## Recommended Three Tiers

Use these names unless sales/branding already requires something else:

### Tier 1: Core Classroom

Best for:
- solo teachers
- low-friction classroom operations

Include:
- classes and roster management
- student join flow
- comprehension pulse
- mastery loop
- RAM Bucks
- behavior ladder
- basic store
- manual schedule management
- basic voice navigation and core commands

Exclude:
- advanced AI ambient analysis
- advanced parent communication automation
- premium schedule import automation
- district-facing reporting and export bundles

### Tier 2: Coach Pro

Best for:
- teachers who want the full AI classroom cockpit

Include everything in Core Classroom, plus:
- AI instructional coach
- behavior coach
- ambient scan and classroom intelligence
- academic guidance
- advanced voice agent workflows
- schedule extraction/import
- advanced remediation and visualizer flows
- parent comms enhancements

### Tier 3: School / District

Best for:
- school-level or district-level deployment

Include everything in Coach Pro, plus:
- district-friendly deployment posture
- multi-teacher or multi-school packaging
- advanced reporting/export capabilities
- admin-facing controls and compliance-oriented deployment support
- future SSO / identity integration path

## Recommended Feature Matrix

### Core Classroom

- Classes
- Rosters
- Groups
- Student join sessions
- Comprehension pulse
- Manipulative pushes
- Mastery records
- RAM Bucks
- Behavior incidents
- Store open/close
- Schedule CRUD
- Basic voice navigation

### Coach Pro

- AI coach
- Behavior coach
- Ambient scan
- Academic guidance
- Animated visualizer
- Advanced voice agent
- Schedule extraction/import
- Parent comms enhancements
- Lecture transcript intelligence

### School / District

- Multi-organization packaging
- Admin dashboards
- Centralized reporting/export bundles
- Stronger deployment controls
- Future district identity integration
- Procurement/compliance support features

## Features That Should Not Be Used For Tiering Yet

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
- a service-level enum
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
- advanced schedule extraction routes
- advanced parent communication routes
- premium voice-agent routes

Do not rely on client-only gating.

### Add UI visibility

Add:
- current plan indicator in settings
- locked-state UI for premium features
- explicit upgrade messaging

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
- possibly parent comms routes depending on how aggressively you tier them

### UI surfaces

- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/coach/page.tsx`
- schedule import UI when added
- premium-only panels and actions

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

- finalize tier names
- finalize feature matrix
- add the architecture docs
- decide first gated feature set

## Saturday

- add subscription schema
- add feature-gate helpers
- gate the first premium server routes
- add settings UI plan indicator

## Sunday

- provision or validate AWS Aurora target
- test schema load
- wire `DATABASE_URL` handling for target environment
- run focused validation
- leave full production cutover as a staged follow-up if infra is not ready

## Minimum Ship By Sunday

To call the weekend successful, ship these:

- documented AWS Aurora target
- documented three-tier feature matrix
- subscription schema in the app
- server-side feature gate helpers
- at least one meaningful premium gate path live in code
- settings/admin visibility of current plan

## What Gets Deferred

Defer these until after Sunday:

- full Stripe or billing automation
- full production DB cutover if infrastructure is not already prepared
- auth-provider migration
- full district admin console
- all premium-route gating in one pass

## Recommended Immediate Build Order

1. Add tier definitions and feature matrix to code and docs.
2. Add subscription/org schema.
3. Add server-side premium gates to AI features first.
4. Add plan visibility in settings.
5. Finish the AWS Aurora runbook and environment prep.

## Direct Recommendation

If the deadline is real, do **not** try to fully complete all three business goals as production rollouts by Sunday night.

Instead, by **April 12, 2026 at 9:00 PM Eastern**, complete:
- the AWS Aurora migration plan
- the three-tier packaging definition
- the first code-backed subscription gating foundation

That gives you something real, defensible, and extensible instead of three partially broken initiatives.
