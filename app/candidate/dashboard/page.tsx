"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Video,
  LogOut,
  Play,
  History,
  Loader2,
  Send,
  Bot,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoRecorder } from "@/app/components/hooks/useVideoRecorder";
import AIInterviewer from "@/app/components/interview/AIInterviewer";
import VideoRecorder from "@/app/components/interview/VideoRecorder";
import FeedbackDisplay from "@/app/components/interview/FeedbackDisplay";
import SessionHistory from "@/app/components/interview/SessionHistory";

type InterviewStep = "setup" | "interview" | "analyzing" | "feedback";

interface Feedback {
  rubric_scores?: {
    content: number;
    structure: number;
    clarity: number;
    impact: number;
    confidence: number;
  };
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
  job_role: string;
  question: string;
  overall_score: number | null;
  status: string;
  created_at: string;
  ai_feedback: Feedback | null;
  video_url: string | null;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type LocalTranscriptionPayload = {
  text?: string;
  language?: string;
  duration?: number | null;
  confidence?: number | null;
  engine?: string;
};

const MIN_TRANSCRIPT_WORDS = 20;

const CandidateDashboard = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const recorder = useVideoRecorder();

  const [step, setStep] = useState<InterviewStep>("setup");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState("practice");
  const [answerTranscript, setAnswerTranscript] = useState("");
  const [transcriptionMode, setTranscriptionMode] = useState<
    "browser-stt" | "local-whisper"
  >("local-whisper");
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const normalizeErrorMessage = useCallback((e: unknown) => {
    if (e instanceof Error) return e.message;

    if (typeof e === "string") return e;

    if (e && typeof e === "object") {
      const maybeError = e as {
        message?: unknown;
        error?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
        status?: unknown;
      };

      if (typeof maybeError.message === "string" && maybeError.message) {
        return maybeError.message;
      }

      if (typeof maybeError.error === "string" && maybeError.error) {
        return maybeError.error;
      }

      const parts = [
        typeof maybeError.code === "string" ? maybeError.code : null,
        typeof maybeError.details === "string" ? maybeError.details : null,
        typeof maybeError.hint === "string" ? maybeError.hint : null,
      ].filter(Boolean) as string[];

      if (parts.length > 0) {
        return parts.join(" | ");
      }

      try {
        const serialized = JSON.stringify(e);
        if (serialized && serialized !== "{}") return serialized;
      } catch {
        // ignore JSON serialization errors and fall through to default
      }
    }

    return "Failed to start interview. Please refresh and try again.";
  }, []);

  const toUserFriendlyStartError = useCallback((message: string) => {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("could not find the table") &&
      normalized.includes("schema cache")
    ) {
      return "Database setup is incomplete: missing table 'interview_sessions'. Run the Supabase migration and try again.";
    }

    return message;
  }, []);

  const getBackupQuestion = useCallback((role: string) => {
    const normalizedRole = role.trim() || "Software Engineer";
    const templates = [
      "Describe a complex problem you solved as a {role}. What options did you consider and why did you choose your final approach?",
      "Tell me about a time you had to deliver results as a {role} under a tight deadline. How did you prioritize?",
      "As a {role}, how would you handle disagreement with a teammate about implementation strategy?",
      "Share an example of feedback you received while working as a {role}. What changed afterward?",
      "What is one project where your impact as a {role} was measurable? Walk me through your specific contributions.",
    ];

    const index = Math.floor(Math.random() * templates.length);
    return templates[index].replace("{role}", normalizedRole);
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadSessions = async () => {
      const { data } = await supabase
        .from("interview_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setSessions(data as unknown as Session[]);
    };
    loadSessions();
  }, [user, step]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const recognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    setTranscriptionMode(recognitionCtor ? "browser-stt" : "local-whisper");
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const recognitionCtor = ((window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;

    if (!recognitionCtor) {
      return false;
    }

    const recognition = new recognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const combinedTranscript = Array.from(event.results)
        .map((result: any) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
      setAnswerTranscript(combinedTranscript);
    };

    recognition.onerror = () => {
      // Keep the interview running even if speech recognition fails.
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
      return true;
    } catch {
      // Ignore start errors (can happen if called twice quickly).
      return false;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // Ignore stop errors.
    }
  }, []);

  const startInterview = useCallback(async () => {
    setIsGenerating(true);
    try {
      if (!user?.id) {
        throw new Error("You are not signed in. Please sign in and try again.");
      }

      let question = "";

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-question",
          {
            body: { jobRole },
          },
        );

        if (error) throw error;

        question =
          typeof data?.question === "string" ? data.question.trim() : "";

        if (!question) {
          throw new Error("No interview question returned from AI provider");
        }
      } catch (e: unknown) {
        question = getBackupQuestion(jobRole);

        if (e instanceof FunctionsHttpError && e.context.status === 429) {
          toast.warning("Rate limit reached", {
            description:
              "AI quota is exhausted, so we started with a backup question.",
          });
        } else if (e instanceof FunctionsHttpError) {
          toast.warning("AI temporarily unavailable", {
            description:
              "Started with a backup question so you can continue practicing.",
          });
        } else if (
          e instanceof FunctionsRelayError ||
          e instanceof FunctionsFetchError
        ) {
          toast.warning("Network issue detected", {
            description:
              "Started with a backup question while AI service reconnects.",
          });
        } else {
          toast.warning("AI unavailable", {
            description:
              "Started with a backup question so your interview is not blocked.",
          });
        }
      }

      setCurrentQuestion(question);

      const { data: session, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert({
          user_id: user.id,
          job_role: jobRole,
          question,
          status: "pending",
        })
        .select()
        .single();

      if (sessionError) {
        const sessionErrorMessage =
          [sessionError.message, sessionError.details, sessionError.hint]
            .filter(Boolean)
            .join(" | ") || "Failed to create interview session";
        throw new Error(sessionErrorMessage);
      }
      setCurrentSessionId(session.id);

      const stream = await recorder.startCamera();
      if (!stream) {
        throw new Error(
          recorder.error ||
            "Camera access denied. Please allow camera and microphone access.",
        );
      }

      setAnswerTranscript("");
      setStep("interview");
    } catch (e: unknown) {
      const message = normalizeErrorMessage(e);
      const userMessage = toUserFriendlyStartError(message);
      console.error("Failed to start interview:", {
        raw: e,
        message,
        userMessage,
      });
      toast.error("Error", {
        description: userMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    jobRole,
    user,
    recorder,
    getBackupQuestion,
    normalizeErrorMessage,
    toUserFriendlyStartError,
  ]);

  const handleStartRecording = () => {
    if (recorder.stream) {
      recorder.startRecording(recorder.stream);
      startSpeechRecognition();
    }
  };

  const handleStopRecording = () => {
    recorder.stopRecording();
    stopSpeechRecognition();
  };

  const transcribeWithLocalWhisper = useCallback(async (blob: Blob) => {
    const formData = new FormData();
    formData.append("file", blob, "answer.webm");
    formData.append("language", "en");

    const response = await fetch("/api/transcribe-local", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let message = "Local transcription failed";
      try {
        const errorPayload = await response.json();
        if (typeof errorPayload?.error === "string" && errorPayload.error) {
          message = errorPayload.error;
        }
      } catch {
        // Ignore JSON parse failures and keep fallback message.
      }
      throw new Error(message);
    }

    const payload = (await response.json()) as LocalTranscriptionPayload;
    return {
      text: typeof payload.text === "string" ? payload.text.trim() : "",
      confidence:
        typeof payload.confidence === "number" ? payload.confidence : null,
      engine: payload.engine,
    };
  }, []);

  const handleSubmitAnswer = async () => {
    if (!recorder.recordedBlob || !currentSessionId) return;

    let transcriptForFeedback = answerTranscript.trim();

    if (!transcriptForFeedback) {
      try {
        const localResult = await transcribeWithLocalWhisper(
          recorder.recordedBlob,
        );
        const localTranscript = localResult.text;
        if (localTranscript) {
          transcriptForFeedback = localTranscript;
          setAnswerTranscript(localTranscript);
          toast.success("Transcript generated", {
            description: "Local Whisper transcription completed.",
          });
        }
      } catch (transcriptionError) {
        console.warn("Local Whisper transcription failed:", transcriptionError);
      }
    }

    const wordCount = transcriptForFeedback.split(/\s+/).filter(Boolean).length;
    if (!transcriptForFeedback) {
      toast.error("Transcript required", {
        description:
          "I couldn't detect enough speech in your recording to generate accurate feedback. Please record again and speak clearly.",
      });
      return;
    }

    if (wordCount < MIN_TRANSCRIPT_WORDS) {
      toast.error("Transcript too short", {
        description: `Please speak for at least ${MIN_TRANSCRIPT_WORDS} words so the feedback can be based on the recorded answer.`,
      });
      return;
    }

    setStep("analyzing");

    try {
      const filePath = `${user!.id}/${currentSessionId}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("interview-recordings")
        .upload(filePath, recorder.recordedBlob, {
          contentType: "video/webm",
          upsert: true,
          cacheControl: "0",
        });
      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload recording");
      }

      const { data: urlData } = supabase.storage
        .from("interview-recordings")
        .getPublicUrl(filePath);

      await supabase
        .from("interview_sessions")
        .update({ video_url: urlData.publicUrl })
        .eq("id", currentSessionId);

      const { data, error } = await supabase.functions.invoke(
        "interview-feedback",
        {
          body: {
            sessionId: currentSessionId,
            jobRole,
            question: currentQuestion,
            transcript: transcriptForFeedback,
          },
        },
      );

      if (error) throw error;

      if (data?.usedFallback) {
        toast.warning("Using fallback feedback", {
          description:
            "AI feedback could not be generated for this submission, so a baseline analysis was used.",
        });
      }

      setFeedback(data.feedback);
      setStep("feedback");
    } catch (e: any) {
      toast.error("Error", {
        description: e?.message ?? "Failed to submit answer",
      });
      setStep("interview");
    }
  };

  const handleRetake = () => {
    recorder.resetRecording();
    setAnswerTranscript("");
  };

  const resetToSetup = () => {
    stopSpeechRecognition();
    recorder.stopCamera();
    recorder.resetRecording();
    setStep("setup");
    setFeedback(null);
    setCurrentSessionId(null);
    setCurrentQuestion("");
    setSelectedSession(null);
    setAnswerTranscript("");
  };

  const viewSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.ai_feedback) {
      setSelectedSession(session);
      setActiveTab("practice");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      {/* <nav className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]">
              <Video className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              InterviewAI
            </span>
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

      <div className="container mx-auto px-6 py-8 max-w-5xl relative z-10 mt-28">
        {/* Past session feedback view */}
        {selectedSession?.ai_feedback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Button
              variant="ghost"
              onClick={() => setSelectedSession(null)}
              className="mb-4 text-muted-foreground hover:text-foreground"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-xl font-display font-bold mb-1">
              {selectedSession.job_role} Interview
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              "{selectedSession.question}"
            </p>
            {selectedSession.video_url && (
              <div className="mb-6 rounded-2xl overflow-hidden aspect-video bg-black ring-1 ring-border/30">
                <video
                  src={selectedSession.video_url}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <FeedbackDisplay
              feedback={selectedSession.ai_feedback as unknown as Feedback}
            />
          </motion.div>
        )}

        {!selectedSession && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-6"
            >
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight">
                  Practice Interview
                </h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered mock interviews with real-time feedback
                </p>
              </div>
              <TabsList className="bg-secondary/30 backdrop-blur-sm border border-border/30 p-1">
                <TabsTrigger
                  value="practice"
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
                >
                  <Play className="w-4 h-4" /> Practice
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] transition-all"
                >
                  <History className="w-4 h-4" /> History
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <TabsContent value="practice">
              <AnimatePresence mode="wait">
                {step === "setup" && (
                  <motion.div
                    key="setup"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className="glass-card glow-border max-w-lg mx-auto">
                      <CardHeader className="text-center pb-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.3)]">
                          <Bot className="w-10 h-10 text-primary" />
                        </div>
                        <CardTitle className="text-xl font-display">
                          Start Practice Session
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Our AI interviewer will ask you a question. Record
                          your answer and get instant feedback.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-2 block">
                            Job Role
                          </label>
                          <Input
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            placeholder="e.g. Software Engineer, Product Manager"
                            className="bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                          />
                        </div>
                        <Button
                          onClick={startInterview}
                          disabled={isGenerating || !jobRole.trim()}
                          className="w-full gap-2 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                          size="lg"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />{" "}
                              Preparing Interview...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" /> Start Interview
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {step === "interview" && (
                  <motion.div
                    key="interview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-center">
                      <span className="text-xs rounded-full border border-border/50 px-3 py-1 bg-secondary/40 text-muted-foreground">
                        {transcriptionMode === "browser-stt"
                          ? "Transcription: Browser STT"
                          : "Transcription: Local Whisper"}
                      </span>
                    </div>

                    <AIInterviewer
                      question={currentQuestion}
                      isThinking={false}
                      isSpeaking={
                        !recorder.isRecording && !recorder.recordedUrl
                      }
                    />

                    <VideoRecorder
                      stream={recorder.stream}
                      isRecording={recorder.isRecording}
                      recordedUrl={recorder.recordedUrl}
                      duration={recorder.duration}
                      onStartRecording={handleStartRecording}
                      onStopRecording={handleStopRecording}
                      onRetake={handleRetake}
                    />

                    <div className="flex justify-center gap-3">
                      <Button
                        variant="outline"
                        onClick={resetToSetup}
                        className="border-border/50"
                      >
                        Cancel
                      </Button>
                      {recorder.recordedUrl && (
                        <Button
                          onClick={handleSubmitAnswer}
                          className="gap-2 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                        >
                          <Send className="w-4 h-4" /> Submit for Feedback
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === "analyzing" && (
                  <motion.div
                    key="analyzing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <motion.div
                      className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.3)]"
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5 }}
                    >
                      <Bot className="w-12 h-12 text-primary" />
                    </motion.div>
                    <h2 className="text-xl font-display font-bold mb-2">
                      Analyzing Your Response
                    </h2>
                    <p className="text-muted-foreground">
                      Our AI is reviewing your content and communication
                      style...
                    </p>
                  </motion.div>
                )}

                {step === "feedback" && feedback && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-display font-bold">
                        Your Feedback
                      </h2>
                      <Button
                        onClick={resetToSetup}
                        className="gap-2 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                      >
                        <Play className="w-4 h-4" /> Practice Again
                      </Button>
                    </div>
                    <FeedbackDisplay feedback={feedback} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="history">
              <SessionHistory sessions={sessions} onSelect={viewSession} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default CandidateDashboard;
