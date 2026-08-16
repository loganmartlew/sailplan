import { relations, sql } from 'drizzle-orm';
import { check, sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
  courseViaPoints: many(courseViaPoint),
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
  // Usable wind-speed range (knots). Nullable = unbounded on that side. Free
  // numeric values, NOT snapped to the TWS_VALUES grid (Package I / D5): the
  // limits table answers "at this wind speed, which angles?"; this range answers
  // "is this wind speed on the table at all?".
  minTws: real('minTws'),
  maxTws: real('maxTws'),
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
  sailTwaLimits: many(sailTwaLimit),
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

export const sailTwaLimit = sqliteTable('sailTwaLimit', {
  id: integer('id').primaryKey(),
  tws: integer('tws').notNull(),
  minTwa: integer('minTwa'),
  maxTwa: integer('maxTwa'),
  sailId: integer('sailId')
    .notNull()
    .references(() => sail.id),
});

export const sailTwaLimitRelations = relations(sailTwaLimit, ({ one }) => ({
  sail: one(sail, {
    fields: [sailTwaLimit.sailId],
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
  direction: text('direction', { enum: ['port', 'starboard'] }),
  note: text('note'),
});

export const courseMarkRelations = relations(courseMark, ({ one, many }) => ({
  course: one(course, {
    fields: [courseMark.courseId],
    references: [course.id],
  }),
  mark: one(mark, {
    fields: [courseMark.markId],
    references: [mark.id],
  }),
  viaPoints: many(courseViaPoint),
}));

export const courseViaPoint = sqliteTable(
  'courseViaPoint',
  {
    id: integer('id').primaryKey(),
    legStartCourseMarkId: integer('legStartCourseMarkId')
      .notNull()
      .references(() => courseMark.id),
    order: integer('order').notNull(),
    markId: integer('markId').references(() => mark.id),
    name: text('name'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    note: text('note'),
  },
  table => [
    check(
      'courseViaPoint_representation_check',
      sql`(${table.markId} is not null and ${table.name} is null and ${table.latitude} is null and ${table.longitude} is null) or (${table.markId} is null and ${table.name} is not null and ${table.latitude} is not null and ${table.longitude} is not null)`,
    ),
  ],
);

export const courseViaPointRelations = relations(courseViaPoint, ({ one }) => ({
  legStartCourseMark: one(courseMark, {
    fields: [courseViaPoint.legStartCourseMarkId],
    references: [courseMark.id],
  }),
  mark: one(mark, {
    fields: [courseViaPoint.markId],
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
