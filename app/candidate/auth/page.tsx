"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Video, ArrowLeft, User, Mail, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CandidateAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const emailRedirectTo = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return `${window.location.origin}/auth/callback?next=/candidate/dashboard`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error(
            "Could not load your account details. Please try again.",
          );
        }

        // Accept candidate role from either auth metadata or user_roles table.
        const isCandidateFromMetadata =
          user.user_metadata?.role === "candidate";
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "candidate")
          .limit(1);

        const isCandidateFromTable = !!roles && roles.length > 0;
        const hasCandidateRole =
          isCandidateFromMetadata || isCandidateFromTable;

        if (!hasCandidateRole) {
          await supabase.auth.signOut();
          setStatus({
            type: "error",
            message:
              "This account is not registered as a candidate. Please use the company login.",
          });
          return;
        }

        setStatus({ type: "success", message: "Logged in successfully." });
        router.replace(redirectTo || "/candidate/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { role: "candidate" }, // This matches the trigger above!
            emailRedirectTo,
          },
        });
        if (error) throw error;

        // Best-effort role table sync for projects that enforce role checks there.
        if (data.user) {
          await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: "candidate",
          });
        }

        setStatus({
          type: "success",
          message: "Account created! Check your email to verify your account.",
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setStatus({
        type: "error",
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-(--gradient-hero)" />
      <div className="absolute top-6 left-6 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Video className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display">
              {isLogin ? "Candidate Login" : "Create Candidate Account"}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLogin
                ? "Sign in to practice interviews and track your progress"
                : "Start preparing for your dream job with AI-powered mock interviews"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {status && (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  status.type === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-foreground"
                }`}
              >
                {status.message}
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
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
              {loading
                ? "Please wait..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/companies")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Are you a company? Login here →
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateAuth;
