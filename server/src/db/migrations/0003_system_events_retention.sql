-- Built-in automation: nightly system_events retention cleanup at 03:00.
-- Retention window is controlled by SYSTEM_EVENTS_RETENTION_DAYS (default 90).
INSERT INTO automations (id, name, description, cron_expr, handler, is_enabled) VALUES
  ('a_system_events_purge', 'System events retention', 'Prunes system_events rows older than the configured retention window (default 90 days) at 03:00 daily',
   '0 3 * * *', 'system_events.purge', 1)
ON CONFLICT(id) DO NOTHING;
