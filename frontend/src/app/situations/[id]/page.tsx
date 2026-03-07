import { readFile } from "node:fs/promises";
import path from "node:path";

import { SituationDetail } from "@/components/situations/SituationDetail";

const LEGACY_SITUATION_ALIASES: Record<string, string> = {
  "sit-001-h5n1": "sit-001-h5n1-europe",
  "sit-002-dengue": "sit-002-dengue-sea",
  "sit-003-mpox": "sit-003-mpox-1b",
};

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
  const allIds = new Set(ids);
  for (const legacyId of Object.keys(LEGACY_SITUATION_ALIASES)) {
    allIds.add(legacyId);
  }
  return Array.from(allIds).map((id) => ({ id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SituationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const canonicalId = LEGACY_SITUATION_ALIASES[id] || id;
  return <SituationDetail id={canonicalId} />;
}
