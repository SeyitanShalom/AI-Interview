"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Video,
  ArrowLeft,
  Building2,
  Mail,
  Lock,
  KeyRound,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/app/components/hooks/useToast";

type CompanyMode = "login" | "signup" | "join";

const CompanyAuth = () => {
  const [mode, setMode] = useState<CompanyMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const emailRedirectTo = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return `${window.location.origin}/auth/callback?next=/company/dashboard`;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Check if user has company role
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isCompanyFromMetadata = user?.user_metadata?.role === "company";
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "company");
      const isCompanyFromTable = !!roles && roles.length > 0;
      const hasCompanyRole = isCompanyFromMetadata || isCompanyFromTable;

      if (!hasCompanyRole) {
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description:
            "This account is not registered as a company user. Please use the candidate login or join with an invite code.",
          variant: "destructive",
        });
        return;
      }

      // Backfill relational role row for projects that enforce table checks.
      if (!isCompanyFromTable && user) {
        await supabase.from("user_roles").insert({
          user_id: user.id,
          role: "company",
        });
      }

      // Finalize pending company/member setup for email-confirmed accounts.
      if (user) {
        const pendingCompanyId = user.user_metadata?.pending_company_id;
        const pendingCompanyName = user.user_metadata?.pending_company_name;

        const { data: existingMembership } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1);

        if (!existingMembership || existingMembership.length === 0) {
          if (pendingCompanyId) {
            await supabase.from("company_members").insert({
              company_id: pendingCompanyId,
              user_id: user.id,
              role: "member",
            });
          } else if (pendingCompanyName) {
            const { data: existingCompany } = await supabase
              .from("companies")
              .select("id")
              .eq("created_by", user.id)
              .maybeSingle();

            let companyId = existingCompany?.id;

            if (!companyId) {
              const { data: createdCompany } = await supabase
                .from("companies")
                .insert({
                  name: pendingCompanyName,
                  created_by: user.id,
                })
                .select("id")
                .single();

              companyId = createdCompany?.id;
            }

            if (companyId) {
              await supabase.from("company_members").insert({
                company_id: companyId,
                user_id: user.id,
                role: "admin",
              });
            }
          }
        }
      }

      toast({ title: "Welcome back!", description: "Logged in successfully." });
      router.push("/company/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "company",
            pending_company_name: companyName,
          },
          emailRedirectTo,
        },
      });
      if (error) throw error;

      if (data.user && data.session) {
        // Create company
        await supabase.from("companies").insert({
          name: companyName,
          created_by: data.user.id,
        });

        // Add as admin member
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("created_by", data.user.id)
          .single();

        if (company) {
          await supabase.from("company_members").insert({
            company_id: company.id,
            user_id: data.user.id,
            role: "admin",
          });
        }
      }

      // If auto-confirmed (session exists), navigate directly
      if (data.session) {
        toast({
          title: "Company registered!",
          description: "Welcome to your dashboard.",
        });
        router.push("/company/dashboard");
      } else {
        toast({
          title: "Company registered!",
          description:
            "Check your email to verify your account. You'll receive your team invite code after verification.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify invite code exists
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("invite_code", inviteCode.trim())
        .single();

      if (companyError || !company) {
        toast({
          title: "Invalid Invite Code",
          description:
            "The invite code you entered doesn't match any company. Please check and try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "company",
            pending_company_id: company.id,
          },
          emailRedirectTo,
        },
      });
      if (error) throw error;

      if (data.user && data.session) {
        // Add as company member
        await supabase.from("company_members").insert({
          company_id: company.id,
          user_id: data.user.id,
          role: "member",
        });
      }

      toast({
        title: `Joined ${company.name}!`,
        description: "Check your email to verify your account.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-background">
      <div className="absolute inset-0 bg-(--gradient-hero)" />
      <div className="absolute z-10 top-24 left-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display">
              {mode === "login" && "Company Login"}
              {mode === "signup" && "Register Your Company"}
              {mode === "join" && "Join a Company"}
            </CardTitle>
            <CardDescription className="mt-2">
              {mode === "login" &&
                "Sign in to manage interviews and review candidates"}
              {mode === "signup" &&
                "Set up your company to start conducting AI-powered interviews"}
              {mode === "join" &&
                "Enter your company's invite code to join as a team member"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {/* Mode selector tabs */}
          <div className="flex p-1 mb-6 rounded-lg bg-secondary/50">
            {(["login", "signup", "join"] as CompanyMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-all ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login"
                  ? "Login"
                  : m === "signup"
                    ? "Register"
                    : "Join Team"}
              </button>
            ))}
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Mail className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 text-sm md:text-base "
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Lock className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 text-sm md:text-base"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full font-semibold "
                disabled={loading}
              >
                {loading ? "Please wait..." : "Sign In"}
              </Button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Name</Label>
                <div className="relative border rounded-lg border-border/50">
                  <User className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 text-sm md:text-base"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Building2 className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Acme Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-10 text-sm md:text-base"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Mail className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 text-sm md:text-base"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Lock className="absolute w-4 h-4 left-3 top-3 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 text-sm md:text-base"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={loading}
              >
                {loading ? "Please wait..." : "Register Company"}
              </Button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <div className="relative border rounded-lg border-border/50">
                  <KeyRound className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="inviteCode"
                    placeholder="Enter company invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="pl-10 font-mono text-sm tracking-wider md:text-base"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask your company admin for the invite code
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Name</Label>
                <div className="relative border rounded-lg border-border/50">
                  <User className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 text-sm md:text-base "
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Mail className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 text-sm md:text-base "
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative border rounded-lg border-border/50">
                  <Lock className="absolute w-4 h-4 left-3 top-2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 text-sm md:text-base "
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={loading}
              >
                {loading ? "Please wait..." : "Join Company"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/candidate/auth")}
              className="text-xs transition-colors text-muted-foreground hover:text-foreground"
            >
              Are you a candidate? Login here →
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyAuth;
