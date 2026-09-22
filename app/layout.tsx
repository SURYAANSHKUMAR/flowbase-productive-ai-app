import { ClerkProvider } from '@clerk/nextjs';
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
import type { Metadata } from "next";
import { isLocalMode } from "@/lib/app-mode";
import { assertCloudConfig } from "@/lib/env";

export const metadata: Metadata = {
  title: "Flowbase",
  description: "A cozy productivity workspace for notes, boards, tasks, and AI-assisted planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (isLocalMode()) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  assertCloudConfig();

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
