ALTER TABLE `metricsStandards` ADD `metricId` varchar(10);--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `view` varchar(20);--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `phase` varchar(50);--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `whatToMeasure` text;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `linesToDraw` text;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `lowMin` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `lowMax` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `lowFinding` text;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `optimalMin` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `optimalMax` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `highMin` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `highMax` float;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `highFinding` text;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `lowLoadShift` text;--> statement-breakpoint
ALTER TABLE `metricsStandards` ADD `highLoadShift` text;