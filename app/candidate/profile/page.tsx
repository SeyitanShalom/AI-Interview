"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

const CandidateProfile = () => {
  const { user } = useAuth();
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");

        const { data } = await supabase
          .from("profiles")
          .select("resume_url, resume_summary")
          .eq("user_id", user.id)
          .single();
        if (data && typeof data.resume_url === "string") {
          setResumeUrl(data.resume_url);
        }
        if (data && typeof data.resume_summary === "string") {
          setResumeSummary(data.resume_summary);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [user]);

  const handleUpload = async (file?: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      // Optimistic UI: show a processing placeholder while server works
      setResumeSummary("Processing summary…");

      const form = new FormData();
      form.append("file", file);

      // attempt to include the user's access token so the server can validate
      const { supabase } = await import("@/lib/supabase");
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token ?? null;

      const res = await fetch("/api/candidate/resume", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      const publicUrl = json.publicUrl ?? null;

      setResumeUrl(publicUrl);
      // Prefer returned persisted profile (snake_case) if available
      if (json?.profile?.resume_summary) {
        setResumeSummary(json.profile.resume_summary);
      } else if (json.resumeSummary) {
        setResumeSummary(json.resumeSummary);
      }

      // Refresh persisted profile from server to ensure DB upsert succeeded
      try {
        const debugRes = await fetch("/api/candidate/resume/debug", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const debugJson = await debugRes.json();
        if (debugRes.ok && debugJson?.profile?.resume_summary) {
          setResumeSummary(debugJson.profile.resume_summary);
        } else {
          console.debug("resume debug response:", debugJson);
        }
      } catch (e) {
        console.debug("failed to refresh profile after upload", e);
      }
      toast.success("Resume uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Ensure 'resumes' bucket exists.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!resumeUrl || !user) return;
    // Attempt to derive storage path from public URL
    const parts = resumeUrl.split("/resumes/");
    const path = parts[1] || null;
    if (!path) {
      toast.error("Unable to determine storage path for resume");
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");

      const session = await supabase.auth.getSession();
      console.debug("supabase session before delete:", session);

      const { error } = await supabase.storage.from("resumes").remove([path]);
      if (error) throw error;
      await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, resume_url: null },
          { onConflict: "user_id" },
        );
      setResumeUrl(null);
      toast.success("Resume deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete resume");
    }
  };

  return (
    <div className="min-h-screen px-6 py-20 bg-background">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push("/candidate/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="mb-2 text-2xl font-display">Profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Manage your uploaded CV / resume.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
              Upload CV / Resume
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              {uploading && (
                <div className="text-sm text-muted-foreground">Uploading…</div>
              )}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
              Current Resume
            </label>
            {resumeUrl ? (
              <div className="flex items-center gap-3">
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  View resume
                </a>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No resume uploaded
              </div>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
              Resume Summary
            </label>
            {resumeSummary ? (
              <div className="p-4 text-sm leading-6 border rounded-xl border-border/50 bg-secondary/20 text-muted-foreground">
                {resumeSummary}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No resume summary available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
