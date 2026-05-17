import { useMemo, useState } from "react";
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
import {
  Plus,
  Trash2,
  FileText,
  Save,
  Sparkles,
  Link2,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/app/components/hooks/useToast";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

interface InterviewKit {
  id: string;
  title: string;
  job_role: string;
  questions: string[];
  created_at: string;
}

interface InterviewKitBuilderProps {
  companyId: string;
  kits: InterviewKit[];
  onRefresh: () => void;
  currentUserRole?: string | null;
}

const InterviewKitBuilder = ({
  companyId,
  kits,
  onRefresh,
  currentUserRole,
}: InterviewKitBuilderProps) => {
  const canManageKits = currentUserRole === "admin";
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questionInputMode, setQuestionInputMode] = useState<"single" | "bulk">(
    "single",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [title, setTitle] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [copiedKitId, setCopiedKitId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const filteredKits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return kits;

    return kits.filter((kit) => {
      const questionText = (kit.questions as string[]).join(" ").toLowerCase();
      return (
        kit.title.toLowerCase().includes(term) ||
        kit.job_role.toLowerCase().includes(term) ||
        questionText.includes(term)
      );
    });
  }, [kits, searchTerm]);

  const copyInviteLink = (kitId: string) => {
    const link = `${window.location.origin}/interview/kit/${kitId}`;
    navigator.clipboard.writeText(link);
    setCopiedKitId(kitId);
    toast({
      title: "Link copied!",
      description: "Share this link with candidates.",
    });
    setTimeout(() => setCopiedKitId(null), 2000);
  };

  const addQuestion = () => setQuestions([...questions, ""]);

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const updateBulkQuestions = (value: string) => {
    const parsedQuestions = value
      .split(/\r?\n/)
      .map((question) => question.trim())
      .filter(Boolean);

    setQuestions(parsedQuestions.length > 0 ? parsedQuestions : [""]);
  };

  const handleSave = async () => {
    if (!canManageKits) {
      toast({
        title: "Access denied",
        description: "Only admins can create interview kits.",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() || !jobRole.trim() || questions.every((q) => !q.trim())) {
      toast({
        title: "Missing fields",
        description:
          "Please fill in the title, role, and at least one question.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const filteredQuestions = questions.filter((q) => q.trim());

    const { error } = await supabase.from("interview_kits").insert({
      company_id: companyId,
      title: title.trim(),
      job_role: jobRole.trim(),
      questions: filteredQuestions,
      created_by: user!.id,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create interview kit.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Kit created!",
        description: `"${title}" is ready for candidates.`,
      });
      setTitle("");
      setJobRole("");
      setQuestions([""]);
      setCreating(false);
      onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async (kitId: string) => {
    if (!canManageKits) {
      toast({
        title: "Access denied",
        description: "Only admins can delete interview kits.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("interview_kits")
      .delete()
      .eq("id", kitId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete kit.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Deleted", description: "Interview kit removed." });
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Interview Kits</h2>
          <p className="text-sm text-muted-foreground">
            Create structured question sets for specific roles
          </p>
          {!canManageKits && (
            <p className="mt-1 text-xs text-muted-foreground/80">
              You can view and share kits, but only admins can create or delete
              them.
            </p>
          )}
        </div>
        {canManageKits && !creating && (
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)]"
          >
            <Plus className="w-4 h-4" /> New Kit
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search kits by title, role, or question"
            className="bg-secondary/30 border-border/50 focus:border-primary/50"
          />
        </div>
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm("")}
            className="self-start text-muted-foreground hover:text-foreground"
          >
            Clear search
          </Button>
        )}
      </div>

      {canManageKits && creating && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card glow-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-display">
                <Sparkles className="w-5 h-5 text-primary" /> Create Interview
                Kit
              </CardTitle>
              <CardDescription>
                Define questions candidates will answer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kit Title</Label>
                  <Input
                    placeholder="e.g. Frontend Developer Screen"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-secondary/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Role</Label>
                  <Input
                    placeholder="e.g. Senior Frontend Engineer"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="bg-secondary/50 border-border/50 focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Questions</Label>
                  <div className="flex items-center p-1 border rounded-lg border-border/40 bg-secondary/30">
                    <Button
                      type="button"
                      variant={
                        questionInputMode === "single" ? "secondary" : "ghost"
                      }
                      size="sm"
                      onClick={() => setQuestionInputMode("single")}
                    >
                      One by one
                    </Button>
                    <Button
                      type="button"
                      variant={
                        questionInputMode === "bulk" ? "secondary" : "ghost"
                      }
                      size="sm"
                      onClick={() => setQuestionInputMode("bulk")}
                    >
                      Paste list
                    </Button>
                  </div>
                </div>

                {questionInputMode === "bulk" ? (
                  <div className="space-y-2">
                    <Textarea
                      value={questions.join("\n")}
                      onChange={(e) => updateBulkQuestions(e.target.value)}
                      placeholder={
                        "Paste one question per line\nExample:\nTell me about a project you are proud of.\nHow do you handle feedback?\nWhat is your process for solving hard problems?"
                      }
                      className="min-h-40 bg-secondary/30 border-border/50 focus:border-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Each line becomes a separate question. Blank lines are
                      ignored.
                    </p>
                  </div>
                ) : (
                  <>
                    {questions.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-2"
                      >
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center mt-2.5 shrink-0">
                          <span className="font-mono text-xs text-primary">
                            {i + 1}
                          </span>
                        </div>
                        <Textarea
                          placeholder={`Question ${i + 1}…`}
                          value={q}
                          onChange={(e) => updateQuestion(i, e.target.value)}
                          className="min-h-15 bg-secondary/30 border-border/50 focus:border-primary/50"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(i)}
                          disabled={questions.length <= 1}
                          className="mt-1 shrink-0 hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </motion.div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addQuestion}
                      className="gap-2 border-border/50"
                    >
                      <Plus className="w-3 h-3" /> Add Question
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Kit"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCreating(false);
                    setTitle("");
                    setJobRole("");
                    setQuestions([""]);
                    setQuestionInputMode("single");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {kits.length === 0 && !creating ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-secondary/50">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No interview kits yet. Create your first one!
            </p>
          </CardContent>
        </Card>
      ) : filteredKits.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-secondary/50">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No kits match your search.</p>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="mt-3"
              >
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredKits.map((kit, i) => (
            <motion.div
              key={kit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="transition-colors glass-card hover:border-primary/20 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base transition-colors font-display group-hover:text-primary">
                        {kit.title}
                      </CardTitle>
                      <CardDescription>{kit.job_role}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInviteLink(kit.id)}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-primary"
                      >
                        {copiedKitId === kit.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        {copiedKitId === kit.id ? "Copied!" : "Share Link"}
                      </Button>
                      {canManageKits && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(kit.id)}
                          className="transition-opacity opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(kit.questions as string[]).map((q, j) => (
                      <div key={j} className="flex gap-2 text-sm">
                        <span className="text-primary font-mono text-xs mt-0.5 shrink-0">
                          {j + 1}.
                        </span>
                        <span className="text-muted-foreground">{q}</span>
                      </div>
                    ))}
                  </div>
                  <p className="pt-3 mt-4 text-xs border-t text-muted-foreground border-border/30">
                    {(kit.questions as string[]).length} question
                    {(kit.questions as string[]).length !== 1 ? "s" : ""} ·
                    Created {new Date(kit.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InterviewKitBuilder;
