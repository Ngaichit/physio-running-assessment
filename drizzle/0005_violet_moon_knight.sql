ALTER TABLE `dynamoTests` ADD `leftPeakForce` float;--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `rightPeakForce` float;--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `peakForceUnit` varchar(20) DEFAULT 'N';--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `leftPeakRfd` float;--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `rightPeakRfd` float;--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `peakRfdUnit` varchar(20) DEFAULT 'N/s';--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `leftTimeToPeak` float;--> statement-breakpoint
ALTER TABLE `dynamoTests` ADD `rightTimeToPeak` float;