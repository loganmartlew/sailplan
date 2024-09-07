import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const boatProfile = sqliteTable('boatProfile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const boatProfileRelations = relations(boatProfile, ({ many }) => ({
  sails: many(sail),
}));

export const mark = sqliteTable('mark', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
});

export const sail = sqliteTable('sail', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sailArea: real('sailArea'),
  symmetrical: integer('symmetrical', { mode: 'boolean' })
    .notNull()
    .default(false),
  boatProfileId: integer('boatProfileId')
    .notNull()
    .references(() => boatProfile.id),
});

export const sailRelations = relations(sail, ({ one }) => ({
  boatProfile: one(boatProfile, {
    fields: [sail.boatProfileId],
    references: [boatProfile.id],
  }),
}));
