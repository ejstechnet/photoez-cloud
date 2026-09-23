import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

// Browser-side auth helpers: signUp, signIn, signOut, useSession.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
