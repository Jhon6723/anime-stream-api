-- Add APPROVE to ModerationAction enum
ALTER TYPE "ModerationAction" ADD VALUE IF NOT EXISTS 'APPROVE';
