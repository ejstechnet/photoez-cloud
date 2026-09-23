import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Settings for drizzle-kit, the command-line tool that turns db/schema.ts
// into SQL migration files and applies them to the database.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
