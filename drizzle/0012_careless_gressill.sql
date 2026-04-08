CREATE TABLE `abilityGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`groupId` varchar(50) NOT NULL,
	`label` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL,
	`metricIds` json NOT NULL,
	`sortOrder` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abilityGroups_id` PRIMARY KEY(`id`)
);
