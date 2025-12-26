-- Add missing indexes for performance optimization
-- These indexes improve query performance for common access patterns

-- Index on sessions.user_id for faster user session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Composite index on documents for user+session queries
CREATE INDEX IF NOT EXISTS idx_documents_user_session ON documents(user_id, session_id);

-- Index on session_messages.session_id for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id);

-- Index on bookmarks.user_id for faster bookmark lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

-- Index on api_keys.user_id for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Index on webhooks.user_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- Index on alerts.user_id for faster alert lookups
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

-- Index on leads.user_id for faster lead lookups
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- Index on campaigns.user_id for faster campaign lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- Index on user_documents.user_id for faster secure document lookups
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);

-- Index on audit_logs for faster audit trail queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
