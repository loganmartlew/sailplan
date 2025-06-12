PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_course` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`courseGroupId` integer,
	FOREIGN KEY (`courseGroupId`) REFERENCES `courseGroup`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_course`("id", "name", "courseGroupId") SELECT "id", "name", "courseGroupId" FROM `course`;--> statement-breakpoint
DROP TABLE `course`;--> statement-breakpoint
ALTER TABLE `__new_course` RENAME TO `course`;--> statement-breakpoint
PRAGMA foreign_keys=ON;