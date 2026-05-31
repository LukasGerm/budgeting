-- Migration: add language and currency columns to the user table.
-- Safe defaults ('en' / 'EUR') ensure existing rows are unaffected.

ALTER TABLE "user" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "user" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
