import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { Button } from "@/app/components/ui/button";
import {
  Video,
  Clock,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle2,
  Target,
  TrendingUp,
  AlertTriangle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

interface Feedback {
  content_score: number;
  style_score: number;
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  content_analysis: string;
  style_analysis: string;
}

interface Session {
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
  ai_feedback: Feedback | null;
  interview_kit_id: string | null;
}

interface CandidateProfile {
  user_id: string;
  full_name: string;
}

interface CandidateReviewProps {
  sessions: Session[];
  profiles?: CandidateProfile[];
}

const scoreColor = (score: number) => {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-yellow-400";
  return "text-destructive";
};

const scoreBg = (score: number) => {
  if (score >= 80) return "bg-primary/10 border-primary/20";
  if (score >= 60) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-destructive/10 border-destructive/20";
};

const CandidateReview = ({ sessions, profiles = [] }: CandidateReviewProps) => {
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [videoDialogUrl, setVideoDialogUrl] = useState<string | null>(null);

  const getProfileName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || null;
  };

  if (completedSessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-display font-bold">
            Candidate Recordings
          </h2>
          <p className="text-sm text-muted-foreground">
            Review AI-scored candidate interview responses
          </p>
        </div>
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No candidate recordings yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Recordings will appear here when candidates complete interviews
              linked to your company.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Candidate Recordings</h2>
        <p className="text-sm text-muted-foreground">
          {completedSessions.length} completed interview
          {completedSessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Video Dialog */}
      <Dialog
        open={!!videoDialogUrl}
        onOpenChange={() => setVideoDialogUrl(null)}
      >
        <DialogContent className="max-w-3xl bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display">
              Candidate Recording
            </DialogTitle>
          </DialogHeader>
          {videoDialogUrl && (
            <video
              src={videoDialogUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black aspect-video"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {completedSessions.map((session, i) => {
          const isExpanded = expandedId === session.id;
          const candidateName = getProfileName(session.user_id);
          const feedback = session.ai_feedback;

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="glass-card hover:border-primary/20 transition-colors group">
                <CardHeader
                  className="pb-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center border border-border/30">
                        <UserCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="font-display text-base flex items-center gap-2">
                          {candidateName ||
                            `Candidate ${session.user_id.slice(0, 8)}`}
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-secondary/50 border border-border/30 font-normal"
                          >
                            {session.job_role}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.completed_at
                            ? new Date(session.completed_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )
                            : new Date(session.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.overall_score != null && (
                        <div
                          className={`text-right px-3 py-1.5 rounded-lg border ${scoreBg(session.overall_score)}`}
                        >
                          <div
                            className={`text-xl font-bold font-display ${scoreColor(session.overall_score)}`}
                          >
                            {session.overall_score}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            / 100
                          </span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <span className="text-foreground font-medium">Q:</span>{" "}
                    {session.question}
                  </p>

                  {session.content_score != null &&
                    session.style_score != null && (
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Content
                            </span>
                            <span className={scoreColor(session.content_score)}>
                              {session.content_score}%
                            </span>
                          </div>
                          <Progress
                            value={session.content_score}
                            className="h-1.5"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Style</span>
                            <span className={scoreColor(session.style_score)}>
                              {session.style_score}%
                            </span>
                          </div>
                          <Progress
                            value={session.style_score}
                            className="h-1.5"
                          />
                        </div>
                      </div>
                    )}

                  <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                    {session.video_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoDialogUrl(session.video_url);
                        }}
                      >
                        <Play className="w-3 h-3" /> Watch Recording
                      </Button>
                    )}
                    {feedback && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 border-border/30 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : session.id);
                        }}
                      >
                        <Target className="w-3 h-3" />{" "}
                        {isExpanded ? "Hide" : "View"} Feedback
                      </Button>
                    )}
                  </div>

                  {/* Expanded feedback section */}
                  <AnimatePresence>
                    {isExpanded && feedback && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 border-t border-border/20 space-y-4">
                          {/* Summary */}
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                            <p className="text-sm text-foreground">
                              {feedback.summary}
                            </p>
                          </div>

                          {/* Strengths & Improvements */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                                Strengths
                              </h4>
                              <ul className="space-y-1.5">
                                {feedback.strengths?.map((s, idx) => (
                                  <li
                                    key={idx}
                                    className="text-xs text-muted-foreground flex items-start gap-2"
                                  >
                                    <TrendingUp className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Areas
                                to Improve
                              </h4>
                              <ul className="space-y-1.5">
                                {feedback.improvements?.map((s, idx) => (
                                  <li
                                    key={idx}
                                    className="text-xs text-muted-foreground flex items-start gap-2"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Detailed Analysis */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg bg-secondary/20 border border-border/10 space-y-1">
                              <h4 className="text-xs font-semibold text-foreground">
                                Content Analysis
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {feedback.content_analysis}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-secondary/20 border border-border/10 space-y-1">
                              <h4 className="text-xs font-semibold text-foreground">
                                Style Analysis
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {feedback.style_analysis}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateReview;
