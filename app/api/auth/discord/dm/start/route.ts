import { playerOsEnv } from "../../../../../../server/auth";
import { handleDiscordDmStart } from "../../../../../../server/discord-dm-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const env = await playerOsEnv();
  try {
    const { waitUntil } = await import("cloudflare:workers");
    return handleDiscordDmStart(request, env, {
      schedule: (task) => waitUntil(task),
    });
  } catch {
    // Background execution is mandatory: synchronous Discord lookup would
    // expose guild membership through response timing.
    return handleDiscordDmStart(request, env);
  }
}
