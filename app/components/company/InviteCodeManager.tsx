import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Copy, Check, RefreshCw, Users, Shield } from "lucide-react";
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
}

const InviteCodeManager = ({
  company,
  members,
  onRefresh,
}: InviteCodeManagerProps) => {
  const [copied, setCopied] = useState(false);
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
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Team Invite Code
            </CardTitle>
            <CardDescription>
              Share this code with team members so they can join your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-secondary/40 border border-border/30 rounded-xl px-5 py-3.5 font-mono text-lg tracking-[0.3em] text-foreground text-center">
                {company?.invite_code ?? "—"}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyCode}
                className="border-border/50 hover:border-primary/40 h-12 w-12 rounded-xl"
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
                onClick={regenerateCode}
                disabled={regenerating}
                className="border-border/50 hover:border-primary/40 h-12 w-12 rounded-xl"
              >
                <RefreshCw
                  className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Regenerating the code will invalidate the previous one.
            </p>
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
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Team Members
            </CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
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
                    className="flex items-center justify-between rounded-xl bg-secondary/30 border border-border/20 px-4 py-3 hover:border-border/40 transition-colors"
                  >
                    <span className="text-sm text-foreground font-mono">
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
