-- Email confirmation is now required at sign-up. Studios that signed up
-- before that keep working: their accounts count as confirmed.
UPDATE "photographers" SET "email_verified" = true WHERE "email_verified" = false;
