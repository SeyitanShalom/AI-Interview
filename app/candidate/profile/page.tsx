"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import {
  isMissingProfileResumeColumn,
  isMissingProfileRoleColumn,
  PROFILE_CONTEXT_MIGRATION_MESSAGE,
} from "@/lib/profileSchema";

type ProfileRecord = {
  resume_url?: string | null;
  resume_summary?: string | null;
  resume_roles?: string[] | null;
  target_roles?: string[] | null;
};

const previewResponseText = (value: string) => {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
};

const readJsonResponse = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text.trim()) return { data: null as T | null, text };

  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null as T | null, text };
  }
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
  const [savedResumeRoles, setSavedResumeRoles] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [savedTargetRoles, setSavedTargetRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const router = useRouter();

  const rolesChanged = useMemo(
    () =>
      resumeRoles.join("\u0000") !== savedResumeRoles.join("\u0000") ||
      targetRoles.join("\u0000") !== savedTargetRoles.join("\u0000"),
    [resumeRoles, savedResumeRoles, savedTargetRoles, targetRoles],
  );

  const getAuthHeaders = async (json = false) => {
    const { supabase } = await import("@/lib/supabase");
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes?.data?.session?.access_token ?? null;
    const headers: Record<string, string> = json
      ? { "Content-Type": "application/json" }
      : {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");

        const selectProfile = (columns: string) =>
          supabase
            .from("profiles")
            .select(columns)
            .eq("user_id", user.id)
            .maybeSingle();

        let { data, error } = await selectProfile(
          "resume_url, resume_summary, resume_roles, target_roles",
        );
        let profile = data as ProfileRecord | null;
        let profileSchemaWarning: unknown = null;

        if (error && isMissingProfileRoleColumn(error)) {
          profileSchemaWarning = error;
          const fallback = await selectProfile("resume_url, resume_summary");
          data = fallback.data;
          error = fallback.error;
          profile = data as ProfileRecord | null;
        }

        if (error && isMissingProfileResumeColumn(error)) {
          profileSchemaWarning = error;
          const fallback = await selectProfile("resume_url");
          data = fallback.data;
          error = fallback.error;
          profile = data as ProfileRecord | null;
        }

        if (error && isMissingProfileResumeColumn(error)) {
          profileSchemaWarning = error;
          profile = null;
          error = null;
        }

        if (error) throw error;

        if (profileSchemaWarning) {
          console.warn("Profile schema migration needed", profileSchemaWarning);
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
        setSavedResumeRoles(nextResumeRoles);
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

      const res = await fetch("/api/candidate/resume", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: form,
      });

      const { data: json, text: rawResponse } = await readJsonResponse<{
        error?: string;
        publicUrl?: string | null;
        resumeSummary?: string | null;
        resumeRoles?: string[];
        resumeMetadataPersisted?: boolean;
        resumeUrlPersisted?: boolean;
        profilePersisted?: boolean;
        rolesPersisted?: boolean;
        warning?: string;
        profile?: ProfileRecord | null;
      }>(res);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            (rawResponse.trim()
              ? `Upload failed (${res.status}): ${previewResponseText(rawResponse)}`
              : "Upload failed"),
        );
      }

      if (!json) {
        throw new Error(
          rawResponse.trim()
            ? `Upload endpoint returned non-JSON (${res.status}): ${previewResponseText(rawResponse)}`
            : "Upload endpoint returned an empty response.",
        );
      }

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
      setSavedResumeRoles(nextRoles);
      if (
        json.warning ||
        json.profilePersisted === false ||
        json.rolesPersisted === false ||
        json.resumeMetadataPersisted === false ||
        json.resumeUrlPersisted === false
      ) {
        toast.warning("Resume uploaded", {
          description: json.warning || PROFILE_CONTEXT_MIGRATION_MESSAGE,
        });
      } else {
        toast.success("Resume uploaded");
      }
    } catch (err) {
      console.error(err);
      setResumeSummary(null);
      toast.error("Upload failed", {
        description:
          err instanceof Error
            ? err.message
            : "Check the resume bucket and profile database migration.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!resumeUrl || !user) return;

    try {
      const res = await fetch("/api/candidate/resume", {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      const { data: json, text: rawResponse } = await readJsonResponse<{
        error?: string;
        profile?: ProfileRecord | null;
      }>(res);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            (rawResponse.trim()
              ? `Delete failed (${res.status}): ${previewResponseText(rawResponse)}`
              : "Delete failed"),
        );
      }

      setResumeUrl(null);
      setResumeSummary(null);
      setResumeRoles([]);
      setSavedResumeRoles([]);
      toast.success("Resume deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete resume", {
        description:
          err instanceof Error ? err.message : "Please refresh and try again.",
      });
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

  const removeResumeRole = (role: string) => {
    setResumeRoles((roles) =>
      roles.filter((item) => item.toLowerCase() !== role.toLowerCase()),
    );
  };

  const saveRoleChanges = async () => {
    if (!user) return;

    setSavingRoles(true);
    try {
      const res = await fetch("/api/candidate/resume", {
        method: "PATCH",
        headers: await getAuthHeaders(true),
        body: JSON.stringify({
          resumeRoles,
          targetRoles,
        }),
      });
      const { data: json, text: rawResponse } = await readJsonResponse<{
        error?: string;
        profile?: ProfileRecord | null;
      }>(res);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            (rawResponse.trim()
              ? `Save failed (${res.status}): ${previewResponseText(rawResponse)}`
              : "Save failed"),
        );
      }

      const profile = json?.profile;
      if (!profile) throw new Error("Profile update failed");
      const nextResumeRoles = normalizeRoles(profile.resume_roles ?? resumeRoles);
      const nextRoles = normalizeRoles(profile?.target_roles ?? targetRoles);
      setResumeRoles(nextResumeRoles);
      setSavedResumeRoles(nextResumeRoles);
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
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
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
                  <Badge
                    key={role}
                    variant="secondary"
                    className="h-7 gap-1 pr-1"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => removeResumeRole(role)}
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
                {resumeUrl
                  ? "No resume roles selected."
                  : "Upload a resume to extract role suggestions."}
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
            onClick={saveRoleChanges}
            disabled={!rolesChanged || savingRoles}
            className="gap-2"
          >
            {savingRoles ? "Saving..." : "Save role changes"}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default CandidateProfile;
