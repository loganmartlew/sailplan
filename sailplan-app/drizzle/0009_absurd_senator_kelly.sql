DELETE FROM `courseMark` WHERE NOT EXISTS (SELECT 1 FROM `mark` WHERE `mark`.`id` = `courseMark`.`markId`);--> statement-breakpoint
CREATE TABLE `courseViaPoint` (
	`id` integer PRIMARY KEY NOT NULL,
	`legStartCourseMarkId` integer NOT NULL,
	`order` integer NOT NULL,
	`markId` integer,
	`name` text,
	`latitude` real,
	`longitude` real,
	`note` text,
	FOREIGN KEY (`legStartCourseMarkId`) REFERENCES `courseMark`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markId`) REFERENCES `mark`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "courseViaPoint_representation_check" CHECK(("courseViaPoint"."markId" is not null and "courseViaPoint"."name" is null and "courseViaPoint"."latitude" is null and "courseViaPoint"."longitude" is null) or ("courseViaPoint"."markId" is null and "courseViaPoint"."name" is not null and "courseViaPoint"."latitude" is not null and "courseViaPoint"."longitude" is not null))
);
--> statement-breakpoint
ALTER TABLE `courseMark` ADD `note` text;
