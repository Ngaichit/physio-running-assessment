CREATE TABLE `dynamoTests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`joint` varchar(100) NOT NULL,
	`movement` varchar(100) NOT NULL,
	`position` varchar(100),
	`leftValue` float,
	`rightValue` float,
	`unit` varchar(20) NOT NULL DEFAULT 'kg',
	`leftReps` int,
	`rightReps` int,
	`asymmetryPercent` float,
	`notes` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dynamoTests_id` PRIMARY KEY(`id`)
);
