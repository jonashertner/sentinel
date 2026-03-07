import { readFile } from "node:fs/promises";
import path from "node:path";

import { SituationDetail } from "@/components/situations/SituationDetail";

interface Manifest {
  situation_ids?: string[];
}

async function readManifest(): Promise<Manifest | null> {
  const candidates = [
    path.join(process.cwd(), "public", "data", "manifest.json"),
    path.join(process.cwd(), "..", "data", "manifest.json"),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf-8");
      return JSON.parse(raw) as Manifest;
    } catch {
      // Try next candidate path.
    }
  }
  return null;
}

export async function generateStaticParams() {
  const manifest = await readManifest();
  const ids = manifest?.situation_ids ?? [];
  return ids.map((id) => ({ id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SituationDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <SituationDetail id={id} />;
}
