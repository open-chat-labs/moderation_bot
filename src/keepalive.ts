import { keepAlive } from "./db/database";

// Supabase pauses free tier projects after a week without activity
export async function ping(): Promise<void> {
    await keepAlive();
}
