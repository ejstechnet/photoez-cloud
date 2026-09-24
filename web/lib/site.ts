// The app's public address, used to build links to share (like client galleries).
export const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
