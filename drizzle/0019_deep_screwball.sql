ALTER TABLE `assessments` MODIFY COLUMN `inbodyFileUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `assessments` MODIFY COLUMN `vo2FileUrl` mediumtext;--> statement-breakpoint
CREATE INDEX `abilityGroups_userId_idx` ON `abilityGroups` (`userId`);--> statement-breakpoint
CREATE INDEX `annotations_screenshotId_idx` ON `annotations` (`screenshotId`);--> statement-breakpoint
CREATE INDEX `assessments_userId_patientId_idx` ON `assessments` (`userId`,`patientId`);--> statement-breakpoint
CREATE INDEX `assessments_patientId_idx` ON `assessments` (`patientId`);--> statement-breakpoint
CREATE INDEX `dynamoTests_assessmentId_idx` ON `dynamoTests` (`assessmentId`);--> statement-breakpoint
CREATE INDEX `metricsStandards_userId_idx` ON `metricsStandards` (`userId`);--> statement-breakpoint
CREATE INDEX `patients_userId_idx` ON `patients` (`userId`);--> statement-breakpoint
CREATE INDEX `practitioners_userId_idx` ON `practitioners` (`userId`);--> statement-breakpoint
CREATE INDEX `screenshots_assessmentId_idx` ON `screenshots` (`assessmentId`);--> statement-breakpoint
CREATE INDEX `videos_assessmentId_idx` ON `videos` (`assessmentId`);