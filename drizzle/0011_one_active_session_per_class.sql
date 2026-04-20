-- Enforce at most one active session per class at the DB level.
-- A partial unique index only covers rows where status = 'active', so ended
-- sessions are unaffected and a teacher can go live again after ending a session.
-- This makes it physically impossible for a double-tap on "Go Live" to create
-- two concurrent active sessions.

-- First end any duplicate active sessions that may already exist (keep the newest).
DELETE FROM "class_sessions"
WHERE status = 'active'
  AND id NOT IN (
    SELECT DISTINCT ON (class_id) id
    FROM "class_sessions"
    WHERE status = 'active'
    ORDER BY class_id, started_at DESC
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_active_session_per_class"
  ON "class_sessions" (class_id)
  WHERE status = 'active';
