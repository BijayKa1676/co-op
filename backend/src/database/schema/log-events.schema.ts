import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';

export const logEvents = pgTable(
  'log_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 100 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [
    index('log_events_type_idx').on(table.type),
    index('log_events_user_id_idx').on(table.userId),
    index('log_events_session_id_idx').on(table.sessionId),
    index('log_events_created_at_idx').on(table.createdAt),
  ],
);

export const logEventsRelations = relations(logEvents, ({ one }) => ({
  user: one(users, { fields: [logEvents.userId], references: [users.id] }),
}));

export type LogEvent = typeof logEvents.$inferSelect;
export type NewLogEvent = typeof logEvents.$inferInsert;
