import {
  CandidateDashboardContent,
  DashboardFallback,
} from "@/app/candidate/dashboard/page";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyInterviewTakePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<DashboardFallback />}>
      <CandidateDashboardContent
        kitIdOverride={id}
        companyInterviewMode
      />
    </Suspense>
  );
}
