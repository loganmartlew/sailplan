CREATE TABLE `sailPolar` (
	`id` integer PRIMARY KEY NOT NULL,
	`tws` real NOT NULL,
	`twa` real NOT NULL,
	`speed` real NOT NULL,
	`sailId` integer NOT NULL,
	FOREIGN KEY (`sailId`) REFERENCES `sail`(`id`) ON UPDATE no action ON DELETE no action
);
