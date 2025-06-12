import { relations } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  SQLiteColumn,
  SQLiteTableWithColumns,
} from 'drizzle-orm/sqlite-core';

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

export const markRelations = relations(mark, ({ many }) => ({
  courseMarks: many(courseMark),
}));

export const sail = sqliteTable('sail', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sailArea: real('sailArea'),
  symmetrical: integer('symmetrical', { mode: 'boolean' })
    .notNull()
    .default(false),
  masthead: integer('masthead', { mode: 'boolean' }).notNull().default(false),
  boatProfileId: integer('boatProfileId')
    .notNull()
    .references(() => boatProfile.id),
});

export const sailRelations = relations(sail, ({ one, many }) => ({
  boatProfile: one(boatProfile, {
    fields: [sail.boatProfileId],
    references: [boatProfile.id],
  }),
  sailPolars: many(sailPolar),
}));

export const sailPolar = sqliteTable('sailPolar', {
  id: integer('id').primaryKey(),
  tws: real('tws').notNull(),
  twa: real('twa').notNull(),
  speed: real('speed').notNull(),
  sailId: integer('sailId')
    .notNull()
    .references(() => sail.id),
});

export const sailPolarRelations = relations(sailPolar, ({ one }) => ({
  sail: one(sail, {
    fields: [sailPolar.sailId],
    references: [sail.id],
  }),
}));

export const course = sqliteTable('course', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  courseGroupId: integer('courseGroupId').references(() => courseGroup.id),
});

export const courseRelations = relations(course, ({ many, one }) => ({
  courseMarks: many(courseMark),
  courseGroup: one(courseGroup, {
    fields: [course.courseGroupId],
    references: [courseGroup.id],
  }),
}));

export const courseMark = sqliteTable('courseMark', {
  id: integer('id').primaryKey(),
  courseId: integer('courseId')
    .notNull()
    .references(() => course.id),
  markId: integer('markId')
    .notNull()
    .references(() => mark.id),
  order: integer('order').notNull(),
  direction: text('direction'),
});

export const courseMarkRelations = relations(courseMark, ({ one }) => ({
  course: one(course, {
    fields: [courseMark.courseId],
    references: [course.id],
  }),
  mark: one(mark, {
    fields: [courseMark.markId],
    references: [mark.id],
  }),
}));

export const courseGroup = sqliteTable('courseGroup', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const courseGroupRelations = relations(courseGroup, ({ many }) => ({
  courses: many(course),
}));
