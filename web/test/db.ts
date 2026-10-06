// The database tests use in place of "@/db": PGlite, a real Postgres that
// runs inside the test process. It's built from the app's own migrations, so
// tests see the same tables as production. Nothing here touches a server.
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema.ts";

const client = new PGlite({ extensions: { btree_gist } });
export const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
