import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  Copy,
  Check,
  RefreshCw,
  Users,
  Shield,
  Share2,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/app/components/hooks/useToast";
import { motion } from "framer-motion";

interface InviteCodeManagerProps {
  company: { id: string; name: string; invite_code: string } | null;
  members: Array<{
    id: string;
    role: string;
    user_id: string;
    joined_at: string;
  }>;
  onRefresh: () => void;
  currentUserRole?: string | null;
}

const InviteCodeManager = ({
  company,
  members,
  onRefresh,
  currentUserRole,
}: InviteCodeManagerProps) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [secureLinkCopied, setSecureLinkCopied] = useState(false);
  const [secureSharing, setSecureSharing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const copyCode = async () => {
    if (!company) return;
    await navigator.clipboard.writeText(company.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard.",
    });
  };

  const shareInvite = async () => {
    if (!company) return;
    const inviteUrl = `${window.location.origin}/company/auth?invite=${company.invite_code}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${company.name}`,
          text: `Join ${company.name} on InterviewAI using this invite code: ${company.invite_code}`,
          url: inviteUrl,
        });
        toast({ title: "Shared!", description: "Invite link shared." });
        return;
      }

      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to share invite.",
        variant: "destructive",
      });
    }
  };

  const createSecureShare = async () => {
    if (!company) return;

    setSecureSharing(true);

    try {
      const response = await fetch("/api/company/invite-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId: company.id }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Failed to create secure share.");
      }

      if (navigator.share) {
        await navigator.share({
          title: `Join ${company.name}`,
          text: `Use this short-lived secure link to join ${company.name}.`,
          url: payload.url,
        });
        toast({ title: "Shared!", description: "Secure invite link shared." });
        return;
      }

      await navigator.clipboard.writeText(payload.url);
      setSecureLinkCopied(true);
      setTimeout(() => setSecureLinkCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Secure invite link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create secure share.",
        variant: "destructive",
      });
    } finally {
      setSecureSharing(false);
    }
  };

  const regenerateCode = async () => {
    if (!company) return;
    setRegenerating(true);
    const newCode = Math.random().toString(36).substring(2, 10);
    const { error } = await supabase
      .from("companies")
      .update({ invite_code: newCode } as any)
      .eq("id", company.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate code.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "New code generated!",
        description: "Share the new invite code with your team.",
      });
      onRefresh();
    }
    setRegenerating(false);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card glow-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <Shield className="w-5 h-5 text-primary" /> Team Invite Code
            </CardTitle>
            <CardDescription>
              Share this code with team members so they can join your company.
              Use a secure link when you want a short-lived, single-use invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 bg-secondary/10 dark:bg-secondary/40 border border-border/30 rounded-xl px-5 py-3.5 font-mono text-lg tracking-[0.3em] text-foreground text-center">
                {company?.invite_code ?? "—"}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyCode}
                className="w-12 h-12 border-border/50 hover:border-primary/40 rounded-xl"
                aria-label="Copy invite code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={shareInvite}
                className="w-12 h-12 border-border/50 hover:border-primary/40 rounded-xl"
                aria-label="Share invite link"
              >
                {linkCopied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={createSecureShare}
                disabled={secureSharing || currentUserRole !== "admin"}
                className="w-12 h-12 border-border/50 hover:border-primary/40 rounded-xl"
                aria-label="Create secure share"
              >
                {secureLinkCopied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={regenerateCode}
                disabled={regenerating || currentUserRole !== "admin"}
                className="w-12 h-12 border-border/50 hover:border-primary/40 rounded-xl"
                aria-label="Regenerate invite code"
              >
                <RefreshCw
                  className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Regenerating the code will invalidate the previous one.
            </p>
            <p className="text-xs text-muted-foreground">
              Secure shares expire after 24 hours and can only be redeemed once.
            </p>
            {currentUserRole !== "admin" && (
              <p className="text-xs text-muted-foreground/80">
                Only admins can regenerate the invite code.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <Users className="w-5 h-5 text-primary" /> Team Members
            </CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="py-4 text-sm text-center text-muted-foreground">
                No team members yet. Share your invite code!
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between px-4 py-3 transition-colors border rounded-xl bg-secondary/10 dark:bg-secondary/30 border-border/20 hover:border-border/40"
                  >
                    <span className="font-mono text-sm text-foreground">
                      {member.user_id.slice(0, 8)}…
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        member.role === "admin"
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "bg-secondary text-secondary-foreground border border-border/30"
                      }`}
                    >
                      {member.role}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default InviteCodeManager;
