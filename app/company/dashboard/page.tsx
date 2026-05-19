"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Building2, KeyRound, FileText, Video, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import InviteCodeManager from "@/app/components/company/InviteCodeManager";
import InterviewKitBuilder from "@/app/components/company/InterviewKitBuilder";
import CandidateReview from "@/app/components/company/CandidateReview";
import AnalyticsCharts from "@/app/components/company/AnalyticsCharts";

const getReadableError = (error: unknown) => {
  if (!error) return null;
  if (typeof error === "string") return error;

  const err = error as { message?: string; code?: string };
  if (err.message && err.code) return `${err.code}: ${err.message}`;
  if (err.message) return err.message;
  return "Unexpected error while loading company data.";
};

interface CompanyMember {
  id: string;
  role: string;
  user_id: string;
  joined_at: string;
}

interface InterviewKit {
  id: string;
  title: string;
  job_role: string;
  questions: string[];
  created_at: string;
  [key: string]: unknown;
}

interface SessionFeedback {
  content_score: number;
  style_score: number;
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  content_analysis: string;
  style_analysis: string;
}

interface CompanySession {
  id: string;
  user_id: string;
  job_role: string;
  question: string;
  status: string;
  overall_score: number | null;
  content_score: number | null;
  style_score: number | null;
  video_url: string | null;
  completed_at: string | null;
  created_at: string;
  ai_feedback: SessionFeedback | null;
  interview_kit_id?: string | null;
  company_id?: string;
  updated_at?: string;
}

interface CandidateProfileSummary {
  user_id: string;
  full_name: string;
  resume_summary: string | null;
}

const CompanyDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    invite_code: string;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [kits, setKits] = useState<InterviewKit[]>([]);
  const [sessions, setSessions] = useState<CompanySession[]>([]);
  const [candidateProfiles, setCandidateProfiles] = useState<
    CandidateProfileSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [accessIssue, setAccessIssue] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setCompany(null);
      setMembers([]);
      setKits([]);
      setSessions([]);
      setCandidateProfiles([]);
      setAccessIssue(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setAccessIssue(null);

      const { data: memberRows, error: memberError } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id);

      if (memberError) {
        throw new Error(
          `company_members lookup failed: ${memberError.message}`,
        );
      }

      let companyId: string | null = null;

      if (memberRows && memberRows.length > 0) {
        companyId = memberRows[0].company_id;
        setUserRole(memberRows[0].role ?? null);
      } else {
        const { data: ownedCompanies, error: ownedError } = await supabase
          .from("companies")
          .select("id")
          .eq("created_by", user.id);

        if (ownedError) {
          throw new Error(
            `companies owner lookup failed: ${ownedError.message}`,
          );
        }

        if (ownedCompanies && ownedCompanies.length > 0) {
          companyId = ownedCompanies[0].id;
          // If user is the creator, they should be admin
          setUserRole("admin");
        }
      }

      // Attempt to recover company linkage for users who verified email later
      // and still have pending metadata from signup/join.
      if (!companyId) {
        const pendingCompanyId = user.user_metadata?.pending_company_id as
          | string
          | undefined;
        const pendingCompanyName = user.user_metadata?.pending_company_name as
          | string
          | undefined;

        if (pendingCompanyId) {
          const { data: pendingMembership, error: pendingMembershipError } =
            await supabase
              .from("company_members")
              .select("company_id")
              .eq("user_id", user.id)
              .eq("company_id", pendingCompanyId)
              .maybeSingle();

          if (pendingMembershipError) {
            throw new Error(
              `pending membership lookup failed: ${pendingMembershipError.message}`,
            );
          }

          if (!pendingMembership) {
            const { error: insertPendingError } = await supabase
              .from("company_members")
              .insert({
                company_id: pendingCompanyId,
                user_id: user.id,
                role: "member",
              });

            if (insertPendingError) {
              throw new Error(
                `pending membership insert failed: ${insertPendingError.message}`,
              );
            }
          }

          companyId = pendingCompanyId;
        } else if (pendingCompanyName) {
          const { data: existingCompany, error: existingCompanyError } =
            await supabase
              .from("companies")
              .select("id")
              .eq("created_by", user.id)
              .maybeSingle();

          if (existingCompanyError) {
            throw new Error(
              `pending company lookup failed: ${existingCompanyError.message}`,
            );
          }

          let createdCompanyId = existingCompany?.id;

          if (!createdCompanyId) {
            const { data: createdCompany, error: createCompanyError } =
              await supabase
                .from("companies")
                .insert({
                  name: pendingCompanyName,
                  created_by: user.id,
                })
                .select("id")
                .single();

            if (createCompanyError) {
              throw new Error(
                `pending company create failed: ${createCompanyError.message}`,
              );
            }

            createdCompanyId = createdCompany?.id;
          }

          if (createdCompanyId) {
            const { data: adminMembership, error: adminMembershipError } =
              await supabase
                .from("company_members")
                .select("company_id")
                .eq("user_id", user.id)
                .eq("company_id", createdCompanyId)
                .maybeSingle();

            if (adminMembershipError) {
              throw new Error(
                `admin membership lookup failed: ${adminMembershipError.message}`,
              );
            }

            if (!adminMembership) {
              const { error: insertAdminError } = await supabase
                .from("company_members")
                .insert({
                  company_id: createdCompanyId,
                  user_id: user.id,
                  role: "admin",
                });

              if (insertAdminError) {
                throw new Error(
                  `admin membership insert failed: ${insertAdminError.message}`,
                );
              }
            }

            setUserRole("admin");
            companyId = createdCompanyId;
          }
        }
      }

      if (!companyId) {
        setCompany(null);
        return;
      }

      const [companyRes, membersRes, kitsRes, sessionsRes] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, invite_code")
          .eq("id", companyId)
          .maybeSingle(),
        supabase
          .from("company_members")
          .select("*")
          .eq("company_id", companyId),
        supabase
          .from("interview_kits")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("interview_sessions")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (companyRes.error && companyRes.error.code === "42703") {
        // Older schema may not include invite_code yet; fallback prevents false
        // no-company state.
        const { data: legacyCompany, error: legacyCompanyError } =
          await supabase
            .from("companies")
            .select("id, name")
            .eq("id", companyId)
            .maybeSingle();

        if (legacyCompanyError) {
          throw new Error(
            `company lookup failed: ${legacyCompanyError.message}`,
          );
        }

        if (legacyCompany) {
          setCompany({ ...legacyCompany, invite_code: "" });
        }
      } else if (companyRes.error) {
        throw new Error(`company lookup failed: ${companyRes.error.message}`);
      } else if (companyRes.data) {
        setCompany(companyRes.data);
      }

      if (membersRes.error) {
        throw new Error(
          `company members load failed: ${membersRes.error.message}`,
        );
      }

      if (kitsRes.error) {
        throw new Error(`interview kits load failed: ${kitsRes.error.message}`);
      }

      if (sessionsRes.error) {
        throw new Error(`sessions load failed: ${sessionsRes.error.message}`);
      }

      if (membersRes.data) setMembers(membersRes.data as CompanyMember[]);
      if (membersRes.data) {
        const me = (membersRes.data as CompanyMember[]).find(
          (m) => m.user_id === user.id,
        );
        if (me) setUserRole(me.role ?? null);
      }
      if (kitsRes.data) setKits(kitsRes.data as InterviewKit[]);
      if (sessionsRes.data) {
        const companySessions = sessionsRes.data as CompanySession[];
        setSessions(companySessions);
        // Fetch candidate profiles for completed sessions
        const userIds = [
          ...new Set(
            companySessions
              .filter((s) => s.status === "completed")
              .map((s) => s.user_id),
          ),
        ];
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, full_name, resume_summary")
            .in("user_id", userIds);

          if (profilesError) {
            throw new Error(
              `candidate profiles load failed: ${profilesError.message}`,
            );
          }

          if (profilesData) setCandidateProfiles(profilesData);
        }
      }
    } catch (error) {
      setCompany(null);
      setMembers([]);
      setKits([]);
      setSessions([]);
      setCandidateProfiles([]);
      setAccessIssue(getReadableError(error));
      setUserRole(null);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="relative">
          <div className="w-12 h-12 border-2 rounded-full border-primary/30 border-t-primary animate-spin" />
          <div className="absolute inset-0 w-12 h-12 rounded-full animate-pulse-glow bg-primary/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-primary/2 rounded-full blur-[100px]" />
      </div>

      {/* Navbar
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16 px-6 mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight font-display">
              InterviewAI
            </span>
            {company && (
              <span className="hidden ml-1 text-sm text-muted-foreground sm:inline">
                · {company.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </nav> */}

      <div className="container relative z-10 px-6 py-8 mx-auto mt-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="mb-1 text-3xl font-bold tracking-tight font-display">
            Company Dashboard
          </h1>
          <p className="mb-2 text-muted-foreground">
            Manage your team, interview kits, and candidate reviews.
          </p>
          {company && (
            <div className="flex items-center gap-3 mb-8">
              <span className="text-sm text-muted-foreground">
                {company.name}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">
                Role: {userRole ?? "—"}
              </span>
            </div>
          )}
        </motion.div>

        {!company ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-16 text-center"
          >
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-5 rounded-2xl bg-secondary/50">
              <Building2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="mb-4 text-muted-foreground">
              No company found for this account.
            </p>
            {accessIssue && (
              <p className="max-w-xl mx-auto mb-4 text-xs text-destructive/90">
                Could not load company data: {accessIssue}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={fetchData}>
                Retry
              </Button>
              <Button
                variant="outline"
                className="glow-border"
                onClick={() => router.push("/company/auth")}
              >
                Register or Join a Company
              </Button>
            </div>
          </motion.div>
        ) : (
          <Tabs defaultValue="team" className="space-y-6 ">
            <TabsList className="border bg-secondary/10 dark:bg-secondary/30 backdrop-blur-sm border-border/30">
              <TabsTrigger
                value="team"
                className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <KeyRound className="w-4 h-4" /> Team & Invite
              </TabsTrigger>
              <TabsTrigger
                value="kits"
                className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <FileText className="w-4 h-4" /> Interview Kits
              </TabsTrigger>
              <TabsTrigger
                value="review"
                className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <Video className="w-4 h-4" /> Candidate Review
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <BarChart3 className="w-4 h-4" /> Analytics
              </TabsTrigger>
            </TabsList>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <TabsContent value="team">
                {loading ? (
                  <div className="space-y-6">
                    <div className="h-40 rounded-xl bg-secondary/30 animate-pulse" />
                    <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
                  </div>
                ) : (
                  <InviteCodeManager
                    company={company}
                    members={members}
                    onRefresh={fetchData}
                    currentUserRole={userRole}
                  />
                )}
              </TabsContent>

              <TabsContent value="kits">
                {loading ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
                    <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
                    <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
                    <div className="h-28 rounded-xl bg-secondary/20 animate-pulse" />
                  </div>
                ) : (
                  <InterviewKitBuilder
                    companyId={company.id}
                    kits={kits}
                    onRefresh={fetchData}
                    currentUserRole={userRole}
                  />
                )}
              </TabsContent>

              <TabsContent value="review">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-20 rounded-xl bg-secondary/20 animate-pulse" />
                    <div className="h-20 rounded-xl bg-secondary/20 animate-pulse" />
                    <div className="h-20 rounded-xl bg-secondary/20 animate-pulse" />
                  </div>
                ) : (
                  <CandidateReview
                    sessions={sessions}
                    profiles={candidateProfiles}
                    currentUserRole={userRole}
                  />
                )}
              </TabsContent>

              <TabsContent value="analytics">
                {loading ? (
                  <div className="h-64 rounded-xl bg-secondary/20 animate-pulse" />
                ) : (
                  <AnalyticsCharts
                    sessions={sessions}
                    currentUserRole={userRole}
                  />
                )}
              </TabsContent>
            </motion.div>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;
