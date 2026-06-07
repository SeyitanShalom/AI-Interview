import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BriefcaseBusiness,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  Plus,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { useToast } from "@/app/components/hooks/useToast";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/profileSchema";

interface InterviewKit {
  id: string;
  title: string;
  job_role: string;
  questions: string[];
  created_at: string;
}

interface JobOpening {
  id: string;
  company_id: string;
  interview_kit_id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  status: "draft" | "open" | "closed";
  apply_token: string;
  created_at: string;
  updated_at?: string;
}

interface CandidateApplication {
  id: string;
  company_id: string;
  job_opening_id: string;
  interview_kit_id: string;
  candidate_user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  cover_note?: string | null;
  status: "applied" | "interview_started" | "interview_completed" | "archived";
  interview_session_id?: string | null;
  created_at: string;
  updated_at?: string;
}

interface ApplicantsManagerProps {
  companyId: string;
  kits: InterviewKit[];
  currentUserRole?: string | null;
}

const isMissingApplicationSchema = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("job_openings") ||
    message.includes("candidate_applications") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
};

const statusLabel: Record<CandidateApplication["status"], string> = {
  applied: "Applied",
  interview_started: "Interview started",
  interview_completed: "Interview completed",
  archived: "Archived",
};

const statusVariant = (status: CandidateApplication["status"]) => {
  if (status === "interview_completed") return "secondary";
  if (status === "archived") return "outline";
  return "default";
};

const ApplicantsManager = ({
  companyId,
  kits,
  currentUserRole,
}: ApplicantsManagerProps) => {
  const { toast } = useToast();
  const canManageOpenings = currentUserRole === "admin";
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schemaIssue, setSchemaIssue] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKitId, setSelectedKitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const kitById = useMemo(() => {
    return new Map(kits.map((kit) => [kit.id, kit] as const));
  }, [kits]);

  const applicationsByOpening = useMemo(() => {
    const grouped = new Map<string, CandidateApplication[]>();

    for (const application of applications) {
      const group = grouped.get(application.job_opening_id) ?? [];
      group.push(application);
      grouped.set(application.job_opening_id, group);
    }

    return grouped;
  }, [applications]);

  const filteredOpenings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return openings;

    return openings.filter((opening) => {
      const kit = kitById.get(opening.interview_kit_id);
      const applicants = applicationsByOpening.get(opening.id) ?? [];
      const haystack = [
        opening.title,
        opening.description,
        opening.location,
        opening.employment_type,
        opening.status,
        kit?.job_role,
        kit?.title,
        ...applicants.flatMap((application) => [
          application.full_name,
          application.email,
          application.status,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [applicationsByOpening, kitById, openings, searchTerm]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setSchemaIssue(null);

    const [openingsResult, applicationsResult] = await Promise.all([
      supabase
        .from("job_openings")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_applications")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    if (openingsResult.error || applicationsResult.error) {
      const error = openingsResult.error ?? applicationsResult.error;

      if (isMissingApplicationSchema(error)) {
        setOpenings([]);
        setApplications([]);
        setSchemaIssue(
          "Application tracking is not set up in Supabase yet. Run the latest migration to create job openings and candidate applications.",
        );
        setLoading(false);
        return;
      }

      toast({
        title: "Applicants could not load",
        description: getErrorMessage(error) || "Refresh and try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setOpenings((openingsResult.data ?? []) as JobOpening[]);
    setApplications((applicationsResult.data ?? []) as CandidateApplication[]);
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadApplications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  const copyLink = async (id: string, link: string, description: string) => {
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast({ title: "Link copied", description });
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const getApplyLink = (opening: JobOpening) =>
    `${window.location.origin}/apply/${opening.apply_token}`;

  const getInterviewLink = (application: CandidateApplication) =>
    `${window.location.origin}/interview/kit/${encodeURIComponent(
      application.interview_kit_id,
    )}/take?application=${encodeURIComponent(application.id)}`;

  const selectedKit = selectedKitId ? kitById.get(selectedKitId) : null;

  const handleCreateOpening = async () => {
    if (!canManageOpenings) {
      toast({
        title: "Access denied",
        description: "Only admins can create job openings.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedKitId || !title.trim()) {
      toast({
        title: "Missing fields",
        description: "Choose an interview kit and enter an opening title.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("job_openings").insert({
      company_id: companyId,
      interview_kit_id: selectedKitId,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      employment_type: employmentType.trim(),
      status: "open",
    });

    setSaving(false);

    if (error) {
      toast({
        title: "Opening not created",
        description: getErrorMessage(error) || "Check Supabase migrations.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Opening created",
      description: "Candidates can now apply for this role.",
    });
    setCreating(false);
    setSelectedKitId("");
    setTitle("");
    setDescription("");
    setLocation("");
    setEmploymentType("");
    loadApplications();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Applicants</h2>
          <p className="text-sm text-muted-foreground">
            Track who applied, the role they chose, and the interview kit they
            should receive.
          </p>
          {!canManageOpenings && (
            <p className="mt-1 text-xs text-muted-foreground/80">
              You can review applicants, but only admins can create openings.
            </p>
          )}
        </div>
        {canManageOpenings && !creating && (
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New Opening
          </Button>
        )}
      </div>

      {schemaIssue && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
          <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{schemaIssue}</span>
        </div>
      )}

      {creating && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card glow-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-display">
                <BriefcaseBusiness className="w-5 h-5 text-primary" />
                Create Opening
              </CardTitle>
              <CardDescription>
                Attach a public application link to an interview kit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Interview Kit</Label>
                  <select
                    value={selectedKitId}
                    onChange={(event) => {
                      const kitId = event.target.value;
                      const kit = kitById.get(kitId);
                      setSelectedKitId(kitId);
                      if (kit && !title.trim()) {
                        setTitle(kit.job_role);
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="">Choose a kit</option>
                    {kits.map((kit) => (
                      <option key={kit.id} value={kit.id}>
                        {kit.job_role} - {kit.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Opening Title</Label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Frontend Developer"
                    className="bg-secondary/30 border-border/50 focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Remote, Lagos, New York"
                    className="bg-secondary/30 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Input
                    value={employmentType}
                    onChange={(event) => setEmploymentType(event.target.value)}
                    placeholder="Full-time, Contract, Internship"
                    className="bg-secondary/30 border-border/50 focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Briefly describe the role candidates are applying for."
                  className="min-h-24 bg-secondary/30 border-border/50 focus:border-primary/50"
                />
              </div>

              {selectedKit && (
                <div className="rounded-md border border-border/30 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                  Candidates who apply will be routed to the{" "}
                  <span className="font-medium text-foreground">
                    {selectedKit.title}
                  </span>{" "}
                  interview kit.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreateOpening}
                  disabled={saving}
                  className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Opening
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCreating(false);
                    setSelectedKitId("");
                    setTitle("");
                    setDescription("");
                    setLocation("");
                    setEmploymentType("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search openings or applicants"
            className="pl-9 bg-secondary/30 border-border/50 focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UsersRound className="h-4 w-4" />
          {applications.length} applicant
          {applications.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
          <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
          <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
        </div>
      ) : openings.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-secondary/50">
              <BriefcaseBusiness className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No job openings yet. Create one from an interview kit.
            </p>
          </CardContent>
        </Card>
      ) : filteredOpenings.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">
              No openings or applicants match your search.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-3"
            >
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOpenings.map((opening, index) => {
            const kit = kitById.get(opening.interview_kit_id);
            const applicants = applicationsByOpening.get(opening.id) ?? [];
            const applyLink = getApplyLink(opening);

            return (
              <motion.div
                key={opening.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="glass-card transition-colors hover:border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base font-display">
                            {opening.title}
                          </CardTitle>
                          <Badge variant="secondary">{opening.status}</Badge>
                          {opening.employment_type && (
                            <Badge variant="outline">
                              {opening.employment_type}
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          {kit?.job_role ?? "Interview role"} via{" "}
                          {kit?.title ?? "linked interview kit"}
                          {opening.location ? ` - ${opening.location}` : ""}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            copyLink(
                              `opening-${opening.id}`,
                              applyLink,
                              "Share this application link with candidates.",
                            )
                          }
                        >
                          {copiedId === `opening-${opening.id}` ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                          Apply Link
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={applyLink}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Preview
                          </a>
                        </Button>
                      </div>
                    </div>
                    {opening.description && (
                      <p className="pt-2 text-sm leading-6 text-muted-foreground">
                        {opening.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {applicants.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/40 bg-secondary/10 px-4 py-6 text-center text-sm text-muted-foreground">
                        No applicants for this opening yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/20 rounded-md border border-border/30">
                        {applicants.map((application) => {
                          const interviewLink = getInterviewLink(application);

                          return (
                            <div
                              key={application.id}
                              className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <UserRound className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {application.full_name}
                                  </span>
                                  <Badge variant={statusVariant(application.status)}>
                                    {statusLabel[application.status]}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {application.email}
                                  </span>
                                  <span>
                                    Applied{" "}
                                    {new Date(
                                      application.created_at,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                {application.cover_note && (
                                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                    {application.cover_note}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() =>
                                    copyLink(
                                      `application-${application.id}`,
                                      interviewLink,
                                      "This candidate-specific interview link was copied.",
                                    )
                                  }
                                >
                                  {copiedId ===
                                  `application-${application.id}` ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Link2 className="w-3.5 h-3.5" />
                                  )}
                                  Interview Link
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                  <a
                                    href={`mailto:${application.email}`}
                                    className="gap-1.5"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    Email
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicantsManager;
