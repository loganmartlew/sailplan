CREATE TABLE `sail` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sailArea` real,
	`symmetrical` integer DEFAULT false NOT NULL,
	`boatProfileId` integer NOT NULL,
	FOREIGN KEY (`boatProfileId`) REFERENCES `boatProfile`(`id`) ON UPDATE no action ON DELETE no action
);
