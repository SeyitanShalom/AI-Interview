import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCandidateForPath } from "@/lib/candidateRouteAuth";
import { getSharedInterviewKit } from "@/lib/interviewKitAccess";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KitPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireCandidateForPath(
    `/interview/kit/${encodeURIComponent(id)}`,
  );

  let kit: Awaited<ReturnType<typeof getSharedInterviewKit>> = null;
  try {
    kit = await getSharedInterviewKit(supabase, id);
  } catch {
    return notFound();
  }

  if (!kit) return notFound();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display">{kit.title}</h1>
          <p className="text-sm text-muted-foreground">{kit.job_role}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Created {new Date(kit.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-4">
          {kit.questions.length === 0 ? (
            <p className="text-muted-foreground">No questions in this kit.</p>
          ) : (
            kit.questions.map((q, i) => (
              <div
                key={i}
                className="p-4 rounded-lg glass-card border-border/30"
              >
                <div className="text-sm font-mono text-primary">{i + 1}.</div>
                <p className="mt-1 text-foreground">{q}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href={`/interview/kit/${encodeURIComponent(kit.id)}/take`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-linear-to-r from-primary to-primary-glow text-primary-foreground"
          >
            Take Interview
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md border border-border/40 text-muted-foreground"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
