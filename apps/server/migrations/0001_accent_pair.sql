ALTER TABLE `settings` ADD `accent_light` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `accent_dark` text;--> statement-breakpoint
-- The old single accent becomes the explicit light one; the dark one follows it automatically
UPDATE `settings` SET `accent_light` = `accent` WHERE `accent` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `accent`;
