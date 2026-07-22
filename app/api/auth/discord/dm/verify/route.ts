import { playerOsEnv } from "../../../../../../server/auth";
import { handleDiscordDmVerify } from "../../../../../../server/discord-dm-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleDiscordDmVerify(request, await playerOsEnv());
}
