CREATE TABLE `course` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`courseGroupId` integer NOT NULL,
	FOREIGN KEY (`courseGroupId`) REFERENCES `courseGroup`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `courseGroup` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courseMark` (
	`id` integer PRIMARY KEY NOT NULL,
	`courseId` integer NOT NULL,
	`markId` integer NOT NULL,
	`order` integer NOT NULL,
	`direction` text,
	FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markId`) REFERENCES `mark`(`id`) ON UPDATE no action ON DELETE no action
);
