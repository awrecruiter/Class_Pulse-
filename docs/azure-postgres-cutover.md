# Azure PostgreSQL Cutover Plan

## Decision

Use **Azure Database for PostgreSQL Flexible Server** for the production database.

This app is already ready for that move because:
- runtime DB access is generic PostgreSQL via `DATABASE_URL`
- Drizzle already targets PostgreSQL
- no application code needs to be rewritten to leave Neon for the database layer

Auth is still on Neon Auth for now. This document covers the **database cutover only**.

## Portal Settings To Use

These settings are the recommended starting point for this repo.

### 1. Create the server

In Azure Portal:

1. Create a resource:
   - `Azure Database for PostgreSQL flexible server`
2. Put it in a dedicated resource group:
   - example: `rg-ugml-prod-data`
3. Choose the production region your district wants for student data residency.
4. Server name:
   - example: `ugml-prod-pg`
5. PostgreSQL version:
   - choose the latest supported stable version available in the portal for Flexible Server
6. Workload type:
   - `Production`

Official reference:
- https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/quickstart-create-server

### 2. Compute and storage

For a first real production deployment of this app:

- Compute tier: `General Purpose`
- Start at: `2 vCores / 8 GiB RAM`
- Storage: `64 GiB`
- Storage autogrow: `Enabled`
- Backup retention: `14 days`
- Backup redundancy: if available and acceptable for cost, choose stronger redundancy

If you are only piloting:
- Compute tier: `Burstable`
- Smaller storage is acceptable

Why:
- this app is not analytically heavy
- it does have many transactional reads/writes across classes, rosters, behavior, schedule, and student flows
- `General Purpose` is the safer starting tier for a school-facing production app

### 3. High availability

For production:
- choose `Zone redundant` if budget allows

If budget is tight:
- `Same zone` is the minimum serious production choice

Why:
- teacher and student classroom workflows are operationally sensitive
- scheduled backups are not the same thing as live failover

### 4. Authentication

At creation time:
- use `PostgreSQL authentication`

You can evaluate Microsoft Entra integration later, but do not block database cutover on it.

Create:
- one admin user for setup only
- one migration user
- one app runtime user

### 5. Networking

Choose:
- **Private access (virtual network integration)**

Do not choose broad public access for production.

Official reference:
- https://learn.microsoft.com/en-us/azure/postgresql/connectivity/quickstart-create-connect-server-vnet

### 6. Security

Use:
- encryption at rest enabled
- customer-managed keys if your district requires them
- TLS-required connections

Official TLS reference:
- https://learn.microsoft.com/en-us/azure/postgresql/security/security-tls-how-to-connect

### 7. Disaster recovery

If your district expects stronger disaster posture:
- enable geo-redundant backup where region support and cost allow

Official reference:
- https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-geo-disaster-recovery

## Exact Database Setup

### Create the application database

After the server is up, create:
- database name: `unghettomylife`

### Create users

Create at least:
- `ugml_app`
- `ugml_migrate`

Suggested permissions:
- `ugml_app`: normal read/write access only to the application database
- `ugml_migrate`: schema change and migration privileges

Do not run the app as the admin user.

## Exact Connection String Format

Use this format for this repo:

```bash
DATABASE_URL=postgresql://ugml_app:PASSWORD@ugml-prod-pg.postgres.database.azure.com:5432/unghettomylife?sslmode=require
```

Notes:
- host format comes from Azure Flexible Server
- port is `5432`
- `sslmode=require` must be present

Microsoft Learn connection format:
- https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/quickstart-create-server

## Repo Secrets To Set

For production deployment:

```bash
DATABASE_URL=postgresql://ugml_app:PASSWORD@ugml-prod-pg.postgres.database.azure.com:5432/unghettomylife?sslmode=require
NEON_AUTH_BASE_URL=...
NEON_AUTH_COOKIE_SECRET=...
ALLOW_DEV_AUTH_BYPASS=false
ANTHROPIC_API_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
```

Important:
- only `DATABASE_URL` changes for the DB move
- do **not** change the Neon Auth values yet unless you are also migrating auth

## Schema Load

For an empty new Azure database, run one of:

### Fast path

```bash
DATABASE_URL='postgresql://ugml_migrate:PASSWORD@ugml-prod-pg.postgres.database.azure.com:5432/unghettomylife?sslmode=require' npm run db:push
```

### Preferred migration path

```bash
DATABASE_URL='postgresql://ugml_migrate:PASSWORD@ugml-prod-pg.postgres.database.azure.com:5432/unghettomylife?sslmode=require' npm run db:migrate
```

Use the migration user, not the runtime user.

## Data Migration

Assuming your current database is PostgreSQL-compatible, use:

### 1. Export current database

```bash
pg_dump "$CURRENT_DATABASE_URL" --format=custom --no-owner --no-privileges --file=ugml.dump
```

### 2. Restore into Azure

```bash
pg_restore \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --dbname="postgresql://ugml_migrate:PASSWORD@ugml-prod-pg.postgres.database.azure.com:5432/unghettomylife?sslmode=require" \
  ugml.dump
```

If you want lower risk:
- restore into a staging Azure database first
- validate there
- then do the final production import during a cutover window

## Validation Checklist

Run these validations after restore and before production cutover:

### App-level checks

- teacher login works
- dashboard pages load
- class list loads
- roster CRUD works
- schedule CRUD works
- student join by code works
- student signed cookie flow works
- behavior incident logging works
- RAM Buck updates work
- parent messaging still works

### Data-level checks

- table counts roughly match source
- recent classes, rosters, schedule blocks, behavior records, and session records exist
- new writes land in Azure, not the old database

### Connection-level checks

- app connects over TLS
- production app uses the runtime DB user
- migration tasks use the migration user

## Cutover Plan

### Recommended sequence

1. Provision Azure server and database.
2. Load schema.
3. Restore a staging copy of production data.
4. Validate staging against the app.
5. Schedule a production cutover window.
6. Freeze writes briefly if needed.
7. Take final export from the current database.
8. Restore final export into Azure.
9. Update production `DATABASE_URL`.
10. Restart app services.
11. Run smoke tests.
12. Keep rollback ready until confidence is high.

## Rollback Plan

If cutover fails:

1. Point production `DATABASE_URL` back to the previous database.
2. Restart app services.
3. Confirm teacher login and classroom flows recover.
4. Preserve Azure data for analysis; do not destroy it immediately.

## What Not To Change During This Step

Do not combine these into the same change window unless required:
- auth provider migration
- new schema refactors
- behavior model changes
- voice system rewrites
- student session protocol changes

This cutover should be only:
- infrastructure
- secrets
- database migration

## Follow-Up After Database Cutover

Once Azure DB is stable, the next major vendor decision is auth.

Best later options for a Microsoft-centric environment:
- Auth.js with PostgreSQL-backed sessions
- Microsoft Entra External ID
- another district-approved IdP path

Do the auth move separately from the database cutover.
