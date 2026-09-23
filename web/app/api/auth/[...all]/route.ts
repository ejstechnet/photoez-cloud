import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Handles every /api/auth/* request (sign-up, sign-in, sign-out, session).
export const { GET, POST } = toNextJsHandler(auth);
