import { SituationDetail } from "@/components/situations/SituationDetail";

export function generateStaticParams() {
  return [
    { id: "sit-001-h5n1-europe" },
    { id: "sit-002-dengue-sea" },
    { id: "sit-003-mpox-1b" },
  ];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SituationDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <SituationDetail id={id} />;
}
