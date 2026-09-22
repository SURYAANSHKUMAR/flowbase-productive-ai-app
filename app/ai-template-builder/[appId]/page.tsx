import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TemplateRenderer } from "@/app/ai-template-builder/template-renderer";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { Button } from "@/components/ui/button";
import { requireCurrentDbUser } from "@/lib/current-user";
import type { AiTemplateAppJson } from "@/lib/ai-template-types";
import { getAiGeneratedAppForUser } from "@/lib/workspace-data";

type PageProps = {
  params: Promise<{ appId: string }>;
};

export default async function AiGeneratedAppPage({ params }: PageProps) {
  const { appId: rawAppId } = await params;
  const appId = Number(rawAppId);
  if (!Number.isInteger(appId)) notFound();

  const user = await requireCurrentDbUser();
  const app = await getAiGeneratedAppForUser(user.id, appId);
  if (!app) notFound();

  return (
    <ProtectedAppShell>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Generated app</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{(app.appJson as AiTemplateAppJson).appName}</h1>
          </div>
          <Button asChild className="h-9 rounded-lg gap-2" variant="outline">
            <Link href="/ai-template-builder">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Builder
            </Link>
          </Button>
        </header>

        <div className="px-4 py-5 sm:px-6">
          <TemplateRenderer app={app.appJson as AiTemplateAppJson} />
        </div>
      </section>
    </ProtectedAppShell>
  );
}
