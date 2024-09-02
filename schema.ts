import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const boatProfile = sqliteTable('boatProfile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
