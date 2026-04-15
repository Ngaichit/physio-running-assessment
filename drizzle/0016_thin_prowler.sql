ALTER TABLE `screenshots` MODIFY COLUMN `imageUrl` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `screenshots` MODIFY COLUMN `thumbnailUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `videos` MODIFY COLUMN `videoUrl` mediumtext NOT NULL;