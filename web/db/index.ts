import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Shared database connection for the app. DATABASE_URL comes from web/.env.
export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  schema,
});
