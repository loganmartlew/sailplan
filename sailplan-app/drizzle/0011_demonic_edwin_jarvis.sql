CREATE TABLE `captureSample` (
	`id` integer PRIMARY KEY NOT NULL,
	`captureSessionId` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`gpsTime` integer,
	`tws` real,
	`twa` real,
	`twd` real,
	`stw` real,
	`sog` real,
	`cog` real,
	`hdg` real,
	`variation` real,
	`awa` real,
	`aws` real,
	`heel` real,
	`trim` real,
	`lat` real,
	`lon` real,
	`rawOffset` integer,
	FOREIGN KEY (`captureSessionId`) REFERENCES `captureSession`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captureSample_captureSessionId_timestamp_idx` ON `captureSample` (`captureSessionId`,`timestamp`);--> statement-breakpoint
CREATE TABLE `captureSession` (
	`id` integer PRIMARY KEY NOT NULL,
	`boatProfileId` integer NOT NULL,
	`name` text NOT NULL,
	`courseId` integer,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	`status` text NOT NULL,
	`resumeDismissedAt` integer,
	`rawLogPath` text,
	`windFrame` text,
	`healthCounters` text NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`boatProfileId`) REFERENCES `boatProfile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connectionEvent` (
	`id` integer PRIMARY KEY NOT NULL,
	`captureSessionId` integer NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`captureSessionId`) REFERENCES `captureSession`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plotterSetup` (
	`id` integer PRIMARY KEY NOT NULL,
	`boatProfileId` integer NOT NULL,
	`mode` text NOT NULL,
	`sourceName` text,
	`sourceModel` text,
	`cachedHost` text,
	`cachedPort` integer,
	`host` text,
	`port` integer,
	`lastTestedAt` integer,
	FOREIGN KEY (`boatProfileId`) REFERENCES `boatProfile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plotterSetup_boatProfileId_unique` ON `plotterSetup` (`boatProfileId`);--> statement-breakpoint
CREATE TABLE `polarImportBatch` (
	`id` integer PRIMARY KEY NOT NULL,
	`boatProfileId` integer NOT NULL,
	`importedAt` integer NOT NULL,
	`fileName` text NOT NULL,
	`batchFingerprint` text NOT NULL,
	`rowCount` integer NOT NULL,
	FOREIGN KEY (`boatProfileId`) REFERENCES `boatProfile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sailSpan` (
	`id` integer PRIMARY KEY NOT NULL,
	`sailedLegId` integer NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`sailId` integer,
	FOREIGN KEY (`sailedLegId`) REFERENCES `sailedLeg`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sailId`) REFERENCES `sail`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sailSpan_sailedLegId_idx` ON `sailSpan` (`sailedLegId`);--> statement-breakpoint
CREATE TABLE `sailStamp` (
	`id` integer PRIMARY KEY NOT NULL,
	`captureSessionId` integer NOT NULL,
	`sailId` integer NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`captureSessionId`) REFERENCES `captureSession`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sailId`) REFERENCES `sail`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sailStamp_captureSessionId_timestamp_idx` ON `sailStamp` (`captureSessionId`,`timestamp`);--> statement-breakpoint
CREATE TABLE `sailedLeg` (
	`id` integer PRIMARY KEY NOT NULL,
	`captureSessionId` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`name` text,
	`courseMarkId` integer,
	`confirmedAt` integer,
	FOREIGN KEY (`captureSessionId`) REFERENCES `captureSession`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`courseMarkId`) REFERENCES `courseMark`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sailedLeg_captureSessionId_startTime_idx` ON `sailedLeg` (`captureSessionId`,`startTime`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sailPolar` (
	`id` integer PRIMARY KEY NOT NULL,
	`tws` real NOT NULL,
	`twa` real NOT NULL,
	`speed` real NOT NULL,
	`sourceKind` text NOT NULL,
	`captureSessionId` integer,
	`importBatchId` integer,
	`observationFingerprint` text,
	`sailId` integer NOT NULL,
	FOREIGN KEY (`captureSessionId`) REFERENCES `captureSession`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`importBatchId`) REFERENCES `polarImportBatch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sailId`) REFERENCES `sail`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sailPolar`("id", "tws", "twa", "speed", "sourceKind", "captureSessionId", "importBatchId", "observationFingerprint", "sailId") SELECT "id", "tws", "twa", "speed", "sourceKind", "captureSessionId", "importBatchId", "observationFingerprint", "sailId" FROM `sailPolar`;--> statement-breakpoint
DROP TABLE `sailPolar`;--> statement-breakpoint
ALTER TABLE `__new_sailPolar` RENAME TO `sailPolar`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sailPolar_sailId_sourceKind_idx` ON `sailPolar` (`sailId`,`sourceKind`);--> statement-breakpoint
CREATE INDEX `sailPolar_observationFingerprint_idx` ON `sailPolar` (`observationFingerprint`);