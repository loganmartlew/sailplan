CREATE TABLE `mark` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`boatProfileId` integer NOT NULL,
	FOREIGN KEY (`boatProfileId`) REFERENCES `boatProfile`(`id`) ON UPDATE no action ON DELETE no action
);
