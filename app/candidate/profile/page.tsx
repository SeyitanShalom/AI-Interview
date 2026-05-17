"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

const CandidateProfile = () => {
  const { user } = useAuth();
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("resume_url")
          .eq("user_id", user.id)
          .single();
        if (data && typeof data.resume_url === "string") {
          setResumeUrl(data.resume_url);
        }
      } catch (err) {
        // ignore
      }
    };
    load();
  }, [user]);

  const handleUpload = async (file?: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/resume-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, resume_url: publicUrl },
          { onConflict: "user_id" },
        );

      setResumeUrl(publicUrl || null);
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
    <div className="min-h-screen px-6 py-12 bg-background">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push("/candidate/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-2xl font-display mb-2">Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
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
                onChange={(e: any) => handleUpload(e.target.files?.[0] ?? null)}
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
                  className="text-primary underline"
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
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
