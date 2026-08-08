CREATE TABLE `sailTwaLimit` (
	`id` integer PRIMARY KEY NOT NULL,
	`tws` integer NOT NULL,
	`minTwa` integer,
	`maxTwa` integer,
	`sailId` integer NOT NULL,
	FOREIGN KEY (`sailId`) REFERENCES `sail`(`id`) ON UPDATE no action ON DELETE no action
);
