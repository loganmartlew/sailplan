import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const boatProfile = sqliteTable('boatProfile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const boatProfileRelations = relations(boatProfile, ({ many }) => ({
  marks: many(mark),
}));

export const mark = sqliteTable('mark', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  boatProfileId: integer('boatProfileId')
    .notNull()
    .references(() => boatProfile.id),
});

export const markRelations = relations(mark, ({ one }) => ({
  boatProfile: one(boatProfile, {
    fields: [mark.boatProfileId],
    references: [boatProfile.id],
  }),
}));
