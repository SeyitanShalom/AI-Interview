"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";

type ProfileRecord = {
  resume_url?: string | null;
  resume_summary?: string | null;
  resume_roles?: string[] | null;
  target_roles?: string[] | null;
};

const PROFILE_ROLE_MIGRATION_MESSAGE =
  "Profile role columns are missing in Supabase. Run the latest migration to save role suggestions.";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown };
    return [maybeError.message, maybeError.details]
      .filter((part): part is string => typeof part === "string" && !!part)
      .join(" ");
  }

  return typeof error === "string" ? error : "";
};

const isMissingProfileRoleColumn = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("schema cache") &&
    (message.includes("resume_roles") || message.includes("target_roles"))
  );
};

const normalizeRole = (value: unknown) => {
  if (typeof value !== "string") return null;

  const role = value
    .replace(/[\u2022*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();

  if (role.length < 2 || role.length > 80) return null;
  return role;
};

const normalizeRoles = (values: unknown[]) => {
  const seen = new Set<string>();
  const roles: string[] = [];

  for (const value of values) {
    const role = normalizeRole(value);
    if (!role) continue;

    const key = role.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    roles.push(role);
    if (roles.length >= 10) break;
  }

  return roles;
};

const CandidateProfile = () => {
  const { user } = useAuth();
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [resumeRoles, setResumeRoles] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [savedTargetRoles, setSavedTargetRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const router = useRouter();

  const rolesChanged = useMemo(
    () => targetRoles.join("\u0000") !== savedTargetRoles.join("\u0000"),
    [savedTargetRoles, targetRoles],
  );

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");

        const { data, error } = await supabase
          .from("profiles")
          .select("resume_url, resume_summary, resume_roles, target_roles")
          .eq("user_id", user.id)
          .maybeSingle();
        let profile = data as ProfileRecord | null;

        if (error) {
          if (!isMissingProfileRoleColumn(error)) throw error;

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .select("resume_url, resume_summary")
            .eq("user_id", user.id)
            .maybeSingle();

          if (fallbackError) throw fallbackError;
          profile = fallbackData as ProfileRecord | null;
        }

        setResumeUrl(
          typeof profile?.resume_url === "string" ? profile.resume_url : null,
        );
        setResumeSummary(
          typeof profile?.resume_summary === "string"
            ? profile.resume_summary.trim()
            : null,
        );

        const nextResumeRoles = normalizeRoles(profile?.resume_roles ?? []);
        const nextTargetRoles = normalizeRoles(profile?.target_roles ?? []);
        setResumeRoles(nextResumeRoles);
        setTargetRoles(nextTargetRoles);
        setSavedTargetRoles(nextTargetRoles);
      } catch (error) {
        console.warn("Failed to load candidate profile", error);
      }
    };

    load();
  }, [user]);

  const handleUpload = async (file?: File | null) => {
    if (!file || !user) return;

    setUploading(true);
    try {
      setResumeSummary("Processing summary...");
      setResumeRoles([]);

      const form = new FormData();
      form.append("file", file);

      const { supabase } = await import("@/lib/supabase");
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token ?? null;

      const res = await fetch("/api/candidate/resume", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      const json = (await res.json()) as {
        error?: string;
        publicUrl?: string | null;
        resumeSummary?: string | null;
        resumeRoles?: string[];
        rolesPersisted?: boolean;
        warning?: string;
        profile?: ProfileRecord | null;
      };

      if (!res.ok) throw new Error(json?.error || "Upload failed");

      const profile = json.profile;
      const nextSummary =
        typeof profile?.resume_summary === "string"
          ? profile.resume_summary
          : json.resumeSummary;
      const nextRoles = normalizeRoles(
        profile?.resume_roles ?? json.resumeRoles ?? [],
      );

      setResumeUrl(profile?.resume_url ?? json.publicUrl ?? null);
      setResumeSummary(nextSummary?.trim() || null);
      setResumeRoles(nextRoles);
      if (json.rolesPersisted === false) {
        toast.warning("Resume uploaded", {
          description: json.warning || PROFILE_ROLE_MIGRATION_MESSAGE,
        });
      } else {
        toast.success("Resume uploaded");
      }
    } catch (err) {
      console.error(err);
      setResumeSummary(null);
      toast.error("Upload failed. Ensure the resumes bucket exists.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!resumeUrl || !user) return;

    const parts = resumeUrl.split("/resumes/");
    const path = parts[1] || null;
    if (!path) {
      toast.error("Unable to determine storage path for resume");
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");

      const { error } = await supabase.storage.from("resumes").remove([path]);
      if (error) throw error;

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          user_id: user.id,
          role: "candidate",
          resume_url: null,
          resume_text: null,
          resume_summary: null,
          resume_roles: [],
        },
        { onConflict: "user_id" },
      );

      if (profileError) {
        if (!isMissingProfileRoleColumn(profileError)) throw profileError;

        const { error: fallbackProfileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              user_id: user.id,
              role: "candidate",
              resume_url: null,
              resume_text: null,
              resume_summary: null,
            },
            { onConflict: "user_id" },
          );

        if (fallbackProfileError) throw fallbackProfileError;
      }

      setResumeUrl(null);
      setResumeSummary(null);
      setResumeRoles([]);
      toast.success("Resume deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete resume");
    }
  };

  const addManualRole = (event?: FormEvent) => {
    event?.preventDefault();

    const role = normalizeRole(roleInput);
    if (!role) return;

    const nextRoles = normalizeRoles([...targetRoles, role]);
    setTargetRoles(nextRoles);
    setRoleInput("");
  };

  const removeManualRole = (role: string) => {
    setTargetRoles((roles) =>
      roles.filter((item) => item.toLowerCase() !== role.toLowerCase()),
    );
  };

  const saveManualRoles = async () => {
    if (!user) return;

    setSavingRoles(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            role: "candidate",
            target_roles: targetRoles,
          },
          { onConflict: "user_id" },
        )
        .select("target_roles")
        .single();

      if (error) {
        if (isMissingProfileRoleColumn(error)) {
          toast.warning("Migration needed", {
            description: PROFILE_ROLE_MIGRATION_MESSAGE,
          });
          return;
        }

        throw error;
      }

      const profile = data as { target_roles?: string[] | null } | null;
      const nextRoles = normalizeRoles(profile?.target_roles ?? targetRoles);
      setTargetRoles(nextRoles);
      setSavedTargetRoles(nextRoles);
      toast.success("Roles saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save roles");
    } finally {
      setSavingRoles(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-20 bg-background">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/candidate/dashboard")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div>
          <h1 className="mb-2 text-2xl font-display">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Keep your resume and practice roles current.
          </p>
        </div>

        <section className="p-4 space-y-4 border rounded-lg border-border/50 bg-secondary/15">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Resume
              </h2>
              <p className="text-sm text-muted-foreground">
                PDF and Word files are supported.
              </p>
            </div>
            {uploading && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="w-4 h-4 animate-pulse" />
                Processing...
              </span>
            )}
          </div>

          <Input
            type="file"
            onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={uploading}
          />

          {resumeUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm underline text-primary"
              >
                <FileText className="w-4 h-4" />
                View resume
              </a>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No resume uploaded.</p>
          )}
        </section>

        <section className="p-4 space-y-4 border rounded-lg border-border/50 bg-secondary/15">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Resume Summary
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {resumeSummary || "No resume summary available yet."}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">
              Roles found in resume
            </h3>
            {resumeRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {resumeRoles.map((role) => (
                  <Badge key={role} variant="secondary" className="h-6">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload a resume to extract role suggestions.
              </p>
            )}
          </div>
        </section>

        <section className="p-4 space-y-4 border rounded-lg border-border/50 bg-secondary/15">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Manual Practice Roles
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add target roles for interviews when a resume is not available or
              when you want to practice a new direction.
            </p>
          </div>

          <form className="flex gap-2" onSubmit={addManualRole}>
            <Input
              value={roleInput}
              onChange={(event) => setRoleInput(event.target.value)}
              placeholder="e.g. Backend Engineer, Product Manager"
            />
            <Button type="submit" variant="secondary" className="gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </form>

          {targetRoles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {targetRoles.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className="h-7 gap-1 pr-1"
                >
                  {role}
                  <button
                    type="button"
                    onClick={() => removeManualRole(role)}
                    className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted"
                    aria-label={`Remove ${role}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No manual roles added yet.
            </p>
          )}

          <Button
            onClick={saveManualRoles}
            disabled={!rolesChanged || savingRoles}
            className="gap-2"
          >
            {savingRoles ? "Saving..." : "Save roles"}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default CandidateProfile;
