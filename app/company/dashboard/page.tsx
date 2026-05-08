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
import {
  Building2,
  LogOut,
  KeyRound,
  FileText,
  Video,
  BarChart3,
} from "lucide-react";
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

const CompanyDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    invite_code: string;
  } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [candidateProfiles, setCandidateProfiles] = useState<
    { user_id: string; full_name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
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

      if (membersRes.data) setMembers(membersRes.data);
      if (kitsRes.data) setKits(kitsRes.data);
      if (sessionsRes.data) {
        setSessions(sessionsRes.data);
        // Fetch candidate profiles for completed sessions
        const userIds = [
          ...new Set(
            sessionsRes.data
              .filter((s: any) => s.status === "completed")
              .map((s: any) => s.user_id),
          ),
        ];
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, full_name")
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
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 w-12 h-12 rounded-full animate-pulse-glow bg-primary/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-primary/2 rounded-full blur-[100px]" />
      </div>

      {/* Navbar
      <nav className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              InterviewAI
            </span>
            {company && (
              <span className="text-sm text-muted-foreground ml-1 hidden sm:inline">
                · {company.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
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

      <div className="container mx-auto px-6 py-8 relative mt-20 z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-display font-bold mb-1 tracking-tight">
            Company Dashboard
          </h1>
          <p className="text-muted-foreground mb-8">
            Manage your team, interview kits, and candidate reviews.
          </p>
        </motion.div>

        {!company ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">
              No company found for this account.
            </p>
            {accessIssue && (
              <p className="text-xs text-destructive/90 max-w-xl mx-auto mb-4">
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
          <Tabs defaultValue="team" className="space-y-6">
            <TabsList className="bg-secondary/30 backdrop-blur-sm border border-border/30 p-1">
              <TabsTrigger
                value="team"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <KeyRound className="w-4 h-4" /> Team & Invite
              </TabsTrigger>
              <TabsTrigger
                value="kits"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <FileText className="w-4 h-4" /> Interview Kits
              </TabsTrigger>
              <TabsTrigger
                value="review"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
              >
                <Video className="w-4 h-4" /> Candidate Review
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
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
                <InviteCodeManager
                  company={company}
                  members={members}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="kits">
                <InterviewKitBuilder
                  companyId={company.id}
                  kits={kits}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="review">
                <CandidateReview
                  sessions={sessions}
                  profiles={candidateProfiles}
                />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsCharts sessions={sessions} />
              </TabsContent>
            </motion.div>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;
