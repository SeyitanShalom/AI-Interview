"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
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
import { Badge } from "@/app/components/ui/badge";
import { useToast } from "@/app/components/hooks/useToast";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/profileSchema";

type PublicOpening = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  status: string;
  company_id: string;
  company_name: string;
  interview_kit_id: string;
  job_role: string;
};

type SubmittedApplication = {
  application_id: string;
  interview_kit_id: string;
  application_status: string;
};

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function ApplyPage() {
  const params = useParams();
  const token = getParamValue(params?.token);
  const { toast } = useToast();
  const [opening, setOpening] = useState<PublicOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submittedApplication, setSubmittedApplication] =
    useState<SubmittedApplication | null>(null);

  const interviewLink = useMemo(() => {
    if (!submittedApplication) return null;

    return `/interview/kit/${encodeURIComponent(
      submittedApplication.interview_kit_id,
    )}/take?application=${encodeURIComponent(
      submittedApplication.application_id,
    )}`;
  }, [submittedApplication]);

  useEffect(() => {
    let cancelled = false;

    const loadOpening = async () => {
      if (!token) {
        setError("Application link is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: openingError } = await supabase.rpc(
        "get_public_job_opening",
        { opening_token: token },
      );

      if (cancelled) return;

      if (openingError) {
        setError(
          getErrorMessage(openingError) ||
            "This application link could not be loaded.",
        );
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;

      if (!row) {
        setError("This application link is not available.");
        setLoading(false);
        return;
      }

      setOpening(row as PublicOpening);
      setLoading(false);
    };

    loadOpening();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !opening) return;

    if (!fullName.trim() || !email.trim()) {
      toast({
        title: "Missing fields",
        description: "Enter your name and email to apply.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { data, error: submitError } = await supabase.rpc(
      "submit_candidate_application",
      {
        opening_token: token,
        applicant_full_name: fullName.trim(),
        applicant_email: email.trim(),
        applicant_phone: phone.trim() || null,
        applicant_note: note.trim() || null,
      },
    );
    setSubmitting(false);

    if (submitError) {
      toast({
        title: "Application not submitted",
        description:
          getErrorMessage(submitError) ||
          "Check your details and try again.",
        variant: "destructive",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (!row) {
      toast({
        title: "Application not submitted",
        description: "The application service did not return a result.",
        variant: "destructive",
      });
      return;
    }

    setSubmittedApplication(row as SubmittedApplication);
    toast({
      title: "Application submitted",
      description: "You can now continue to the interview for this role.",
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-4xl px-6 py-40 mx-auto">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error || !opening ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="max-w-lg glass-card">
              <CardContent className="py-12 text-center">
                <BriefcaseBusiness className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {error || "This application link is not available."}
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/">Return Home</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {opening.company_name}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight font-display">
                  {opening.title}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {opening.job_role}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {opening.employment_type && (
                  <Badge variant="secondary">{opening.employment_type}</Badge>
                )}
                {opening.location && (
                  <Badge variant="outline">{opening.location}</Badge>
                )}
              </div>
              {opening.description && (
                <p className="p-4 text-sm leading-6 border rounded-md border-border/30 bg-secondary/20 text-muted-foreground">
                  {opening.description}
                </p>
              )}
              <div className="p-4 text-sm border rounded-md border-primary/20 bg-primary/10 text-primary">
                Applying here connects you to the interview kit selected for
                this role.
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
            >
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display">
                    {submittedApplication ? "Application Received" : "Apply"}
                  </CardTitle>
                  <CardDescription>
                    {submittedApplication
                      ? "Continue to the role-specific interview when you are ready."
                      : "Enter your details so the company can match your interview to this role."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submittedApplication && interviewLink ? (
                    <div className="space-y-5 text-center">
                      <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-primary/10">
                        <CheckCircle2 className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          Your application has been saved.
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sign in or register as a candidate to take the
                          interview.
                        </p>
                      </div>
                      <Button
                        asChild
                        className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                      >
                        <Link href={interviewLink}>
                          Continue to Interview
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <div className="relative">
                          <UserRound className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(event) =>
                              setFullName(event.target.value)
                            }
                            placeholder="Jane Doe"
                            className="pl-9 bg-secondary/30 border-border/50 focus:border-primary/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="jane@example.com"
                            className="pl-9 bg-secondary/30 border-border/50 focus:border-primary/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="Optional"
                          className="bg-secondary/30 border-border/50 focus:border-primary/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="note">Note</Label>
                        <Textarea
                          id="note"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Optional: add a short note for the hiring team"
                          className="min-h-28 bg-secondary/30 border-border/50 focus:border-primary/50"
                        />
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        Submit Application
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </div>
        )}
      </div>
    </main>
  );
}
