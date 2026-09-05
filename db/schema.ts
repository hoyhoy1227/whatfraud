import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

// One shared counter, no conversations, IP addresses or player IDs.
export const aiBudget = sqliteTable('ai_budget', {
  id: integer('id').primaryKey(),
  day: integer('day').notNull(),
  minute: integer('minute').notNull(),
  dayCount: integer('day_count').notNull(),
  minuteCount: integer('minute_count').notNull(),
});
