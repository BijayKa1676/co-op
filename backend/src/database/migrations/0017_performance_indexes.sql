-- Performance indexes for production optimization
-- These indexes improve query performance for common access patterns

-- Sessions: User lookup with ordering by creation date (dashboard, session list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_created 
  ON sessions(user_id, created_at DESC);

-- Sessions: Active sessions lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active 
  ON sessions(user_id, is_active) WHERE is_active = true;

-- Audit logs: User activity lookup with date ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created 
  ON audit_logs(user_id, created_at DESC);

-- Audit logs: Resource lookup for audit trails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
  ON audit_logs(resource, resource_id, created_at DESC);

-- Bookmarks: User bookmarks with type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user_type 
  ON bookmarks(user_id, type, created_at DESC);

-- Messages: Session messages lookup (chat history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_session_created 
  ON messages(session_id, created_at ASC);

-- Alerts: User alerts with active status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user_active 
  ON alerts(user_id, is_active) WHERE is_active = true;

-- Alert results: Unread results lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_results_unread 
  ON alert_results(alert_id, is_read, created_at DESC) WHERE is_read = false;

-- Webhooks: Active webhooks for event triggering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_active 
  ON webhooks(is_active) WHERE is_active = true;

-- Outreach leads: User leads with status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_status 
  ON leads(user_id, status, created_at DESC);

-- Outreach campaigns: User campaigns lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_user_created 
  ON campaigns(user_id, created_at DESC);

-- User documents: Session documents lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_documents_session 
  ON user_documents(session_id, created_at DESC) WHERE session_id IS NOT NULL;

-- Investors: Search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investors_search 
  ON investors USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
