# Florida Student Data Database Recommendation

## Executive Recommendation

For this codebase, choose one of these two targets:

1. **AWS Aurora PostgreSQL** if the priority is the most practical migration path and strongest AWS-native operational controls.
2. **Azure Database for PostgreSQL Flexible Server** if the priority is the cleanest public procurement and compliance-review posture for a Florida K-12 buyer.

For this specific app, the best default recommendation is:

## Recommended Target: AWS Aurora PostgreSQL

### Why this is the best fit for this repo

- The application already runs on generic PostgreSQL through `DATABASE_URL`.
- `.env.example` already uses an RDS-style connection example.
- The app already relies on AWS-oriented operational pieces for SMS and can fit naturally into an AWS-hosted runtime.
- Aurora PostgreSQL gives stronger production scaling, HA, backups, and private-network deployment options than the current setup without forcing application rewrites.
- The migration from the current runtime DB layer is operational, not architectural.

### What this means in practice

- Keep the current application code path for database access.
- Replace the production `DATABASE_URL` with an Aurora PostgreSQL writer endpoint.
- Run Drizzle migrations against Aurora.
- Keep Neon Auth temporarily if needed, then plan a separate auth migration later.

## Why not call anything “FERPA-approved”

- FERPA does not create a universal approved-database program.
- Florida law and district procurement require the right contract language, data restrictions, and safeguards.
- The real decision standard is: can the district put this vendor under the required contractual and technical controls for student records?

Official sources:
- U.S. Department of Education school-official FAQ:
  https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa
- U.S. Department of Education cloud computing FAQ:
  https://studentprivacy.ed.gov/sites/default/files/resource_document/file/FAQ_Cloud_Computing_0.pdf
- Florida Statute 1002.221:
  https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=1000-1099%2F1002%2FSections%2F1002.221.html
- Florida Statute 1002.222:
  https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=1000-1099%2F1002%2FSections%2F1002.222.html
- Florida Statute 1006.1494:
  https://www.leg.state.fl.us/Statutes./index.cfm?App_mode=Display_Statute&Search_String=&URL=1000-1099%2F1006%2FSections%2F1006.1494.html
- FLDOE Rule 6A-1.09550:
  https://www.fldoe.org/core/fileparse.php/20670/urlt/24-2.pdf

## Option Comparison For This App

### AWS Aurora PostgreSQL

Best for:
- production migration with minimal app change
- private networking
- backup and recovery maturity
- strong auditability and KMS integration
- teams already using AWS infrastructure

Official references:
- AWS FERPA:
  https://aws.amazon.com/compliance/ferpa/
- RDS encryption:
  https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html

Repo fit:
- best

### Azure Database for PostgreSQL Flexible Server

Best for:
- procurement review and compliance conversations
- districts already standardized on Microsoft
- private networking and enterprise controls

Official references:
- Microsoft FERPA:
  https://learn.microsoft.com/en-us/compliance/regulatory/offering-ferpa
- Azure PostgreSQL compliance:
  https://learn.microsoft.com/en-us/azure/postgresql/security/security-compliance

Repo fit:
- very good

### Google Cloud SQL / AlloyDB

Best for:
- GCP-native districts or teams
- strong technical platform when buyer review is already aligned to GCP

Official references:
- Google compliance center:
  https://cloud.google.com/compliance
- AlloyDB security and compliance:
  https://cloud.google.com/alloydb/docs/security-privacy-compliance

Repo fit:
- good, but not the simplest procurement story

### Neon

Best for:
- developer ergonomics
- modern branching workflows

Official references:
- Trust center:
  https://trust.neon.com/
- Security:
  https://neon.com/security

Repo fit:
- technically workable, weaker public FERPA procurement posture

## Concrete Recommendation For This Repo

### Phase 1: Migrate database only

Target:
- **AWS Aurora PostgreSQL**

Keep for now:
- Neon Auth

Reason:
- DB access is already generic PostgreSQL.
- Auth migration is separate and should not block the database move.
- This reduces project risk and shortens time to a stronger infrastructure posture.

### Phase 2: Revisit auth provider

Targets to evaluate later:
- Auth.js with PostgreSQL session store
- Microsoft Entra External ID if district identity is Microsoft-centered
- AWS Cognito if the runtime standardizes on AWS

## Required Infrastructure Controls

Use these regardless of vendor:

- private networking only
- TLS required
- encryption at rest
- automated backups with point-in-time recovery
- audit logs for admin and data access
- least-privilege DB roles
- separate runtime and migration credentials
- signed DPA with school-official and limited-use language
- deletion and return-of-data terms
- breach notification terms

## Exact App Impact

### Already done in this repo

- `src/lib/db/index.ts` uses generic PostgreSQL
- `drizzle.config.ts` uses `DATABASE_URL`
- `.env.example` is already pointed at a managed PostgreSQL style connection string

### Not yet migrated

- production database instance
- production secrets
- data export/import cutover
- network placement
- auth provider

## Migration Plan

### Step 1: Provision Aurora PostgreSQL

Create:
- Aurora PostgreSQL cluster
- private subnets
- security groups restricted to app runtime
- KMS-backed encryption
- backups and PITR

### Step 2: Create roles

Create separate DB users for:
- runtime application access
- migrations
- read-only reporting if needed later

### Step 3: Load schema

Run:

```bash
DATABASE_URL='postgresql://...' npm run db:push
```

Or preferred migration flow:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

### Step 4: Move data

Export current PostgreSQL data and import into Aurora using:
- `pg_dump`
- `pg_restore`

### Step 5: Update secrets

Set production values for:
- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `ALLOW_DEV_AUTH_BYPASS=false`

### Step 6: Validate high-risk flows

Validate:
- teacher login
- class and roster reads/writes
- student join and signed cookie flow
- schedule CRUD
- behavior and RAM Bucks
- parent messaging

### Step 7: Cut over

- point app runtime to Aurora writer endpoint
- monitor logs and DB load
- keep rollback snapshot ready

## Go / No-Go Criteria

Do not call the migration complete until:

- DPA or equivalent contract is signed
- legal/privacy review is complete
- private networking is enforced
- DB encryption and backups are verified
- production credentials are rotated
- application smoke tests pass on the new database
- rollback path is documented

## Decision Summary

If you want the best practical target for this actual app:
- choose **AWS Aurora PostgreSQL**

If you want the strongest procurement-review optics and Microsoft-centered buyer story:
- choose **Azure Database for PostgreSQL Flexible Server**

Do not spend time hunting for a mythical “FLDOE FERPA-approved database” list. Buy against contract terms, access controls, and technical safeguards instead.
