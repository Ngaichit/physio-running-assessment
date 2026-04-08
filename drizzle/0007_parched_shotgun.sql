CREATE TABLE `practitioners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`title` varchar(255),
	`qualifications` varchar(500),
	`clinic` varchar(255),
	`phone` varchar(50),
	`email` varchar(320),
	`website` varchar(500),
	`address` text,
	`isDefault` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practitioners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `screenshots` MODIFY COLUMN `gaitPhase` enum('foot_strike','loading','mid_stance','push_off','swing','other') NOT NULL;