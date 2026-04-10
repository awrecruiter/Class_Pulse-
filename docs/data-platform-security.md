# Data Platform Security

## Current State

- Application database access now uses generic PostgreSQL via `DATABASE_URL`.
- This allows the app to run against managed PostgreSQL platforms such as AWS RDS or Aurora PostgreSQL without Neon-specific database code.
- Authentication still uses Neon Auth. Migrating off Neon completely requires a separate auth migration.

## FERPA Reality

- FERPA does not provide a universal "approved database" certification.
- The compliance question is whether your school or district has the right contracts, access controls, auditability, retention, and operational safeguards for student records.

## Recommended Managed PostgreSQL Baseline

- Use AWS RDS or Aurora PostgreSQL with TLS required.
- Restrict network access to private subnets or tightly scoped security groups.
- Enable encryption at rest with KMS-managed keys.
- Enable automated backups, point-in-time recovery, and audit logging.
- Use least-privilege database users for app runtime and migrations.
- Keep production credentials out of developer workstations when possible.

## Repo Controls Added

- Student cookie signing now requires `NEON_AUTH_COOKIE_SECRET`; there is no insecure default fallback.
- Development auth bypass now requires explicit `ALLOW_DEV_AUTH_BYPASS=true`.
- Claude hook protection blocks local env-file reads and logs hook config changes.
