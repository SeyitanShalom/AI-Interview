import CandidateDashboard from "@/app/candidate/dashboard/page";
import { requireCandidateForPath } from "@/lib/candidateRouteAuth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ application?: string | string[] }>;
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function CompanyInterviewTakePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const applicationId = firstParam(query.application)?.trim();
  const nextPath = `/interview/kit/${encodeURIComponent(id)}/take${
    applicationId
      ? `?application=${encodeURIComponent(applicationId)}`
      : ""
  }`;
  await requireCandidateForPath(nextPath);

  return (
    <Suspense fallback={null}>
      <CandidateDashboard
        kitIdOverride={id}
        applicationIdOverride={applicationId ?? null}
        companyInterviewMode
      />
    </Suspense>
  );
}
