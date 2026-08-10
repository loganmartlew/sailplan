import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const boatProfile = sqliteTable('boatProfile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const boatProfileRelations = relations(boatProfile, ({ many, one }) => ({
  sails: many(sail),
  captureSessions: many(captureSession),
  polarImportBatches: many(polarImportBatch),
  plotterSetup: one(plotterSetup),
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
  sailStamps: many(sailStamp),
  sailSpans: many(sailSpan),
}));

export const sailPolar = sqliteTable(
  'sailPolar',
  {
    id: integer('id').primaryKey(),
    tws: real('tws').notNull(),
    twa: real('twa').notNull(),
    speed: real('speed').notNull(),
    sourceKind: text('sourceKind', {
      enum: ['manual', 'import', 'capture'],
    }).notNull(),
    captureSessionId: integer('captureSessionId').references(() => captureSession.id),
    importBatchId: integer('importBatchId').references(() => polarImportBatch.id),
    observationFingerprint: text('observationFingerprint'),
    sailId: integer('sailId').notNull().references(() => sail.id),
  },
  table => [
    index('sailPolar_sailId_sourceKind_idx').on(table.sailId, table.sourceKind),
    index('sailPolar_observationFingerprint_idx').on(table.observationFingerprint),
  ],
);

export const sailPolarRelations = relations(sailPolar, ({ one }) => ({
  sail: one(sail, {
    fields: [sailPolar.sailId],
    references: [sail.id],
  }),
  captureSession: one(captureSession, {
    fields: [sailPolar.captureSessionId],
    references: [captureSession.id],
  }),
  importBatch: one(polarImportBatch, {
    fields: [sailPolar.importBatchId],
    references: [polarImportBatch.id],
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
  captureSessions: many(captureSession),
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

export const courseMarkRelations = relations(courseMark, ({ many, one }) => ({
  course: one(course, {
    fields: [courseMark.courseId],
    references: [course.id],
  }),
  mark: one(mark, {
    fields: [courseMark.markId],
    references: [mark.id],
  }),
  sailedLegs: many(sailedLeg),
}));

export const courseGroup = sqliteTable('courseGroup', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const courseGroupRelations = relations(courseGroup, ({ many }) => ({
  courses: many(course),
}));

export const captureSession = sqliteTable('captureSession', {
  id: integer('id').primaryKey(),
  boatProfileId: integer('boatProfileId').notNull().references(() => boatProfile.id),
  name: text('name').notNull(),
  courseId: integer('courseId').references(() => course.id),
  startedAt: integer('startedAt').notNull(),
  endedAt: integer('endedAt'),
  status: text('status', { enum: ['active', 'ended', 'autoEnded'] }).notNull(),
  resumeDismissedAt: integer('resumeDismissedAt'),
  rawLogPath: text('rawLogPath'),
  windFrame: text('windFrame', { enum: ['water', 'ground', 'instrument-corrected', 'unknown'] }),
  healthCounters: text('healthCounters').notNull(),
  notes: text('notes').notNull(),
});

export const captureSample = sqliteTable(
  'captureSample',
  {
    id: integer('id').primaryKey(),
    captureSessionId: integer('captureSessionId').notNull().references(() => captureSession.id),
    timestamp: integer('timestamp').notNull(),
    gpsTime: integer('gpsTime'),
    tws: real('tws'),
    twa: real('twa'),
    twd: real('twd'),
    stw: real('stw'),
    sog: real('sog'),
    cog: real('cog'),
    hdg: real('hdg'),
    variation: real('variation'),
    awa: real('awa'),
    aws: real('aws'),
    heel: real('heel'),
    trim: real('trim'),
    lat: real('lat'),
    lon: real('lon'),
    rawOffset: integer('rawOffset'),
  },
  table => [uniqueIndex('captureSample_captureSessionId_timestamp_idx').on(table.captureSessionId, table.timestamp)],
);

export const connectionEvent = sqliteTable('connectionEvent', {
  id: integer('id').primaryKey(),
  captureSessionId: integer('captureSessionId').notNull().references(() => captureSession.id),
  at: integer('at').notNull(),
  kind: text('kind').notNull(),
});

export const sailStamp = sqliteTable(
  'sailStamp',
  {
    id: integer('id').primaryKey(),
    captureSessionId: integer('captureSessionId').notNull().references(() => captureSession.id),
    sailId: integer('sailId').notNull().references(() => sail.id),
    timestamp: integer('timestamp').notNull(),
  },
  table => [index('sailStamp_captureSessionId_timestamp_idx').on(table.captureSessionId, table.timestamp)],
);

export const sailedLeg = sqliteTable(
  'sailedLeg',
  {
    id: integer('id').primaryKey(),
    captureSessionId: integer('captureSessionId').notNull().references(() => captureSession.id),
    ordinal: integer('ordinal').notNull(),
    startTime: integer('startTime').notNull(),
    endTime: integer('endTime').notNull(),
    name: text('name'),
    courseMarkId: integer('courseMarkId').references(() => courseMark.id),
    confirmedAt: integer('confirmedAt'),
  },
  table => [index('sailedLeg_captureSessionId_startTime_idx').on(table.captureSessionId, table.startTime)],
);

export const sailSpan = sqliteTable(
  'sailSpan',
  {
    id: integer('id').primaryKey(),
    sailedLegId: integer('sailedLegId').notNull().references(() => sailedLeg.id),
    startTime: integer('startTime').notNull(),
    endTime: integer('endTime').notNull(),
    sailId: integer('sailId').references(() => sail.id),
  },
  table => [index('sailSpan_sailedLegId_idx').on(table.sailedLegId)],
);

export const polarImportBatch = sqliteTable('polarImportBatch', {
  id: integer('id').primaryKey(),
  boatProfileId: integer('boatProfileId').notNull().references(() => boatProfile.id),
  importedAt: integer('importedAt').notNull(),
  fileName: text('fileName').notNull(),
  batchFingerprint: text('batchFingerprint').notNull(),
  rowCount: integer('rowCount').notNull(),
});

export const plotterSetup = sqliteTable('plotterSetup', {
  id: integer('id').primaryKey(),
  boatProfileId: integer('boatProfileId').notNull().unique().references(() => boatProfile.id),
  mode: text('mode', { enum: ['automatic', 'manual'] }).notNull(),
  sourceName: text('sourceName'),
  sourceModel: text('sourceModel'),
  cachedHost: text('cachedHost'),
  cachedPort: integer('cachedPort'),
  host: text('host'),
  port: integer('port'),
  lastTestedAt: integer('lastTestedAt'),
});

export const captureSessionRelations = relations(captureSession, ({ many, one }) => ({
  boatProfile: one(boatProfile, {
    fields: [captureSession.boatProfileId],
    references: [boatProfile.id],
  }),
  course: one(course, {
    fields: [captureSession.courseId],
    references: [course.id],
  }),
  samples: many(captureSample),
  connectionEvents: many(connectionEvent),
  sailStamps: many(sailStamp),
  sailedLegs: many(sailedLeg),
  sailPolars: many(sailPolar),
}));

export const captureSampleRelations = relations(captureSample, ({ one }) => ({
  captureSession: one(captureSession, {
    fields: [captureSample.captureSessionId],
    references: [captureSession.id],
  }),
}));

export const connectionEventRelations = relations(connectionEvent, ({ one }) => ({
  captureSession: one(captureSession, {
    fields: [connectionEvent.captureSessionId],
    references: [captureSession.id],
  }),
}));

export const sailStampRelations = relations(sailStamp, ({ one }) => ({
  captureSession: one(captureSession, {
    fields: [sailStamp.captureSessionId],
    references: [captureSession.id],
  }),
  sail: one(sail, {
    fields: [sailStamp.sailId],
    references: [sail.id],
  }),
}));

export const sailedLegRelations = relations(sailedLeg, ({ many, one }) => ({
  captureSession: one(captureSession, {
    fields: [sailedLeg.captureSessionId],
    references: [captureSession.id],
  }),
  courseMark: one(courseMark, {
    fields: [sailedLeg.courseMarkId],
    references: [courseMark.id],
  }),
  sailSpans: many(sailSpan),
}));

export const sailSpanRelations = relations(sailSpan, ({ one }) => ({
  sailedLeg: one(sailedLeg, {
    fields: [sailSpan.sailedLegId],
    references: [sailedLeg.id],
  }),
  sail: one(sail, {
    fields: [sailSpan.sailId],
    references: [sail.id],
  }),
}));

export const polarImportBatchRelations = relations(polarImportBatch, ({ many, one }) => ({
  boatProfile: one(boatProfile, {
    fields: [polarImportBatch.boatProfileId],
    references: [boatProfile.id],
  }),
  sailPolars: many(sailPolar),
}));

export const plotterSetupRelations = relations(plotterSetup, ({ one }) => ({
  boatProfile: one(boatProfile, {
    fields: [plotterSetup.boatProfileId],
    references: [boatProfile.id],
  }),
}));
