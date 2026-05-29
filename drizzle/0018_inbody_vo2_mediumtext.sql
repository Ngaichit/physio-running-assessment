-- Widen inbodyFileUrl and vo2FileUrl from TEXT (64 KB) to MEDIUMTEXT (16 MB)
-- so PDFs can be stored inline as data: URLs without requiring S3.
ALTER TABLE `assessments` MODIFY `inbodyFileUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `assessments` MODIFY `vo2FileUrl` mediumtext;
