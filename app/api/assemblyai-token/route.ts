import { requireCurrentDbUser } from "@/lib/current-user";
import { configuredValue } from "@/lib/env";

export async function GET() {
  await requireCurrentDbUser();
  const apiKey = configuredValue("ASSEMBLYAI_API_KEY");

  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "600");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return Response.json({ error: await response.text() }, { status: response.status });
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    return Response.json({ error: "AssemblyAI did not return a token." }, { status: 502 });
  }

  return Response.json({ token: body.token });
}
