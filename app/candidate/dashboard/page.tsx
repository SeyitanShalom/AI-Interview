"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
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
  Play,
  History,
  Loader2,
  Send,
  Bot,
  Sparkles,
  FileText,
  ArrowRight,
  UserCircle,
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

interface InterviewKit {
  id: string;
  title: string;
  job_role: string;
  company_id: string;
  questions: string[];
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
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

const countWords = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const clampScore = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

const buildFallbackFeedback = (
  jobRole: string,
  question: string,
  transcript: string,
): Feedback => {
  const words = countWords(transcript);
  const hasTranscript = words > 0;

  const content = clampScore(
    hasTranscript ? 45 + Math.min(words * 0.28, 35) : 45,
  );
  const structure = clampScore(
    hasTranscript ? 42 + Math.min(words * 0.24, 35) : 44,
  );
  const clarity = clampScore(
    hasTranscript ? 50 + Math.min(words * 0.18, 30) : 50,
  );
  const impact = clampScore(
    hasTranscript ? 38 + Math.min(words * 0.3, 38) : 40,
  );
  const confidence = clampScore(
    hasTranscript ? 52 + Math.min(words * 0.16, 28) : 52,
  );
  const contentScore = clampScore(
    content * 0.5 + structure * 0.3 + impact * 0.2,
  );
  const styleScore = clampScore(clarity * 0.6 + confidence * 0.4);
  const overallScore = clampScore(contentScore * 0.6 + styleScore * 0.4);

  return {
    rubric_scores: { content, structure, clarity, impact, confidence },
    content_score: contentScore,
    style_score: styleScore,
    overall_score: overallScore,
    summary:
      "Baseline feedback was generated from the available transcript. Add more detail, evidence, and outcomes to make the assessment sharper.",
    strengths: [
      "Your response stayed aligned with the interview prompt.",
      "You provided enough context to begin evaluating the answer.",
      "You showed a willingness to explain your approach.",
    ],
    improvements: [
      "Use the STAR format to make the answer easier to follow.",
      "Add concrete results, metrics, or examples of impact.",
      "Close with one concise takeaway tied to the role.",
    ],
    content_analysis: `Role: ${jobRole}. Question analyzed: ${question}. The transcript supports a baseline review; stronger examples and measurable outcomes would improve the content score.`,
    style_analysis:
      "Aim for confident pacing, clear sentence structure, and a direct closing statement.",
  };
};

const CandidateDashboardContent = () => {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const kitId = searchParams.get("kit");
  const recorder = useVideoRecorder();

  const [step, setStep] = useState<InterviewStep>("setup");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [linkedKit, setLinkedKit] = useState<InterviewKit | null>(null);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [activeKitQuestionIndex, setActiveKitQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState("practice");
  const [answerTranscript, setAnswerTranscript] = useState("");
  const [mediaUnavailableMessage, setMediaUnavailableMessage] = useState<
    string | null
  >(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null,
  );
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<
    "browser-stt" | "local-whisper"
  >("local-whisper");
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const manualTranscriptEditedRef = useRef(false);

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
    if (!user) return;

    const loadProfileSummary = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("resume_summary")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && typeof data.resume_summary === "string") {
        setResumeSummary(data.resume_summary.trim());
      }
    };

    loadProfileSummary();
  }, [user, step]);

  useEffect(() => {
    let cancelled = false;

    if (!kitId) {
      setLinkedKit(null);
      setKitError(null);
      setKitLoading(false);
      setActiveKitQuestionIndex(0);
      return;
    }

    const loadLinkedKit = async () => {
      setKitLoading(true);
      setKitError(null);

      try {
        const response = await fetch(
          `/api/interview-kits/${encodeURIComponent(kitId)}`,
        );
        const payload = (await response.json().catch(() => ({}))) as
          | InterviewKit
          | { error?: string };

        if (!response.ok || !("id" in payload)) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Interview kit could not be loaded.",
          );
        }

        const questions = Array.isArray(payload.questions)
          ? payload.questions.filter(
              (question): question is string =>
                typeof question === "string" && question.trim().length > 0,
            )
          : [];

        if (questions.length === 0) {
          throw new Error("This interview kit does not contain any questions.");
        }

        if (!cancelled) {
          setLinkedKit({ ...payload, questions });
          setJobRole(payload.job_role);
          setActiveKitQuestionIndex(0);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Interview kit could not be loaded.";
          setLinkedKit(null);
          setKitError(message);
          toast.error("Interview kit unavailable", {
            description: message,
          });
        }
      } finally {
        if (!cancelled) {
          setKitLoading(false);
        }
      }
    };

    loadLinkedKit();

    return () => {
      cancelled = true;
    };
  }, [kitId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const recognitionCtor =
      (
        window as unknown as {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;

    setTranscriptionMode(recognitionCtor ? "browser-stt" : "local-whisper");
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const recognitionCtor =
      (
        window as unknown as {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;

    if (!recognitionCtor) {
      return false;
    }

    const recognition = new recognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const combinedTranscript = Array.from(event.results)
        .map(
          (result: BrowserSpeechRecognitionResult) =>
            result?.[0]?.transcript || "",
        )
        .join(" ")
        .trim();
      if (!manualTranscriptEditedRef.current) {
        setAnswerTranscript(combinedTranscript);
      }
      if (combinedTranscript) {
        setTranscriptionError(null);
      }
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      const message =
        event.error === "not-allowed"
          ? "Browser transcription needs microphone permission."
          : "Browser transcription stopped. The recording can still be transcribed after submission.";
      setTranscriptionError(message);
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

      if (linkedKit) {
        question =
          linkedKit.questions[activeKitQuestionIndex]?.trim() ||
          linkedKit.questions[0]?.trim() ||
          "";

        if (!question) {
          throw new Error("This interview kit does not have a valid question.");
        }
      } else {
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
          console.warn("AI question generation failed; using backup question.", e);
          question = getBackupQuestion(jobRole);
        }
      }

      const sessionPayload: {
        user_id: string;
        job_role: string;
        question: string;
        status: string;
        company_id?: string;
        interview_kit_id?: string;
      } = {
        user_id: user.id,
        job_role: linkedKit?.job_role || jobRole,
        question,
        status: "pending",
      };

      if (linkedKit) {
        sessionPayload.company_id = linkedKit.company_id;
        sessionPayload.interview_kit_id = linkedKit.id;
      }

      const { data: session, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert(sessionPayload)
        .select()
        .single();

      if (sessionError) {
        const sessionErrorMessage =
          [sessionError.message, sessionError.details, sessionError.hint]
            .filter(Boolean)
            .join(" | ") || "Failed to create interview session";
        throw new Error(sessionErrorMessage);
      }

      setCurrentQuestion(question);
      setCurrentSessionId(session.id);

      setAnswerTranscript("");
      manualTranscriptEditedRef.current = false;
      setMediaUnavailableMessage(null);
      setTranscriptionError(null);
      setStep("interview");
    } catch (e: unknown) {
      recorder.stopCamera();
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
    linkedKit,
    activeKitQuestionIndex,
  ]);

  const handleStartRecording = async () => {
    let stream = recorder.stream;

    if (!stream) {
      try {
        stream = await recorder.startCamera();
        setMediaUnavailableMessage(null);
      } catch (error) {
        const message = normalizeErrorMessage(error);
        setMediaUnavailableMessage(message);
        toast.error("Recording unavailable", {
          description: message,
        });
        return;
      }
    }

    if (!stream) {
      toast.error("Recording unavailable", {
        description:
          mediaUnavailableMessage ||
          recorder.error ||
          "Camera and microphone access is not available.",
      });
      return;
    }

    setTranscriptionError(null);
    const started = recorder.startRecording(stream);
    if (started) {
      startSpeechRecognition();
    } else {
      toast.error("Recording unavailable", {
        description:
          recorder.error || "Recording could not start in this browser.",
      });
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
    if (!currentSessionId || isSubmittingAnswer) {
      return;
    }

    if (!user?.id) {
      toast.error("Error", {
        description: "You are not signed in. Please sign in and try again.",
      });
      return;
    }

    setIsSubmittingAnswer(true);
    setTranscriptionError(null);

    try {
      let transcriptForFeedback = answerTranscript.trim();

      if (!transcriptForFeedback && recorder.recordedBlob) {
        setIsTranscribing(true);
        try {
          const localResult = await transcribeWithLocalWhisper(
            recorder.recordedBlob,
          );
          const localTranscript = localResult.text;
          if (localTranscript) {
            transcriptForFeedback = localTranscript;
            setAnswerTranscript(localTranscript);
            toast.success("Transcript generated", {
              description: "Your recording was transcribed successfully.",
            });
          }
        } catch (transcriptionError) {
          console.warn(
            "Automatic transcription failed:",
            transcriptionError,
          );
          setTranscriptionError(
            "Automatic transcription could not produce text. Add the transcript below and submit again.",
          );
          toast.error("Transcript needed", {
            description:
              "Automatic transcription did not return speech text. Add the transcript below and submit again.",
          });
          return;
        } finally {
          setIsTranscribing(false);
        }
      }

      if (!transcriptForFeedback) {
        setTranscriptionError(
          "Add the transcript below so feedback can be generated.",
        );
        toast.error("Transcript needed", {
          description: "Add the transcript below and submit again.",
        });
        return;
      }

      setStep("analyzing");

      if (recorder.recordedBlob) {
        const filePath = `${user.id}/${currentSessionId}.webm`;
        try {
          const { error: uploadError } = await supabase.storage
            .from("interview-recordings")
            .upload(filePath, recorder.recordedBlob, {
              contentType: recorder.recordedBlob.type || "video/webm",
              upsert: true,
              cacheControl: "0",
            });
          if (uploadError) {
            throw new Error(uploadError.message || "Failed to upload recording");
          }

          const { data: urlData } = supabase.storage
            .from("interview-recordings")
            .getPublicUrl(filePath);

          const { error: updateVideoError } = await supabase
            .from("interview_sessions")
            .update({ video_url: urlData.publicUrl })
            .eq("id", currentSessionId);

          if (updateVideoError) {
            console.warn("Recording URL update failed:", updateVideoError);
          }
        } catch (uploadError) {
          console.warn("Recording upload failed:", uploadError);
          toast.warning("Recording upload skipped", {
            description:
              "Feedback will still be generated, but this session may not include video playback.",
          });
        }
      }

      let nextFeedback: Feedback | null = null;
      let usedFallbackFeedback = false;

      try {
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

        if (!data?.feedback) {
          throw new Error("No feedback returned from AI provider");
        }

        nextFeedback = data.feedback as Feedback;
        usedFallbackFeedback = Boolean(data.usedFallback);
      } catch (feedbackError) {
        console.warn("Feedback function failed; using baseline feedback.", {
          error: feedbackError,
        });
        nextFeedback = buildFallbackFeedback(
          jobRole,
          currentQuestion,
          transcriptForFeedback,
        );
        usedFallbackFeedback = true;

        const { error: updateFeedbackError } = await supabase
          .from("interview_sessions")
          .update({
            ai_feedback: nextFeedback,
            content_score: nextFeedback.content_score,
            style_score: nextFeedback.style_score,
            overall_score: nextFeedback.overall_score,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", currentSessionId);

        if (updateFeedbackError) {
          console.warn("Fallback feedback save failed:", updateFeedbackError);
        }
      }

      if (usedFallbackFeedback) {
        toast.warning("Using baseline feedback", {
          description:
            "AI feedback was unavailable, so a local rubric was used for this submission.",
        });
      }

      setFeedback(nextFeedback);
      setStep("feedback");
    } catch (e: unknown) {
      toast.error("Error", {
        description: e instanceof Error ? e.message : "Failed to submit answer",
      });
      setStep("interview");
    } finally {
      setIsTranscribing(false);
      setIsSubmittingAnswer(false);
    }
  };

  const handleRetake = () => {
    recorder.resetRecording();
    setAnswerTranscript("");
    manualTranscriptEditedRef.current = false;
    setTranscriptionError(null);
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
    manualTranscriptEditedRef.current = false;
    setMediaUnavailableMessage(null);
    setTranscriptionError(null);
  };

  const handleNextKitQuestion = () => {
    if (!linkedKit) return;

    stopSpeechRecognition();
    recorder.stopCamera();
    recorder.resetRecording();
    setFeedback(null);
    setCurrentSessionId(null);
    setCurrentQuestion("");
    setSelectedSession(null);
    setAnswerTranscript("");
    manualTranscriptEditedRef.current = false;
    setMediaUnavailableMessage(null);
    setTranscriptionError(null);
    setActiveKitQuestionIndex((index) =>
      Math.min(index + 1, linkedKit.questions.length - 1),
    );
    setStep("setup");
  };

  const viewSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setSelectedSession(session);
      setActiveTab("practice");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("interview_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) {
        throw error;
      }

      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
      toast.success("Session deleted", {
        description: "The interview session has been removed.",
      });
    } catch (error: unknown) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to delete session",
      });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-125 h-125 bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-100 h-100 bg-primary/2 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      {/* <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16 px-6 mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]">
              <Video className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight font-display">
              InterviewAI
            </span>
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

      <div className="container relative z-10 max-w-5xl px-6 py-8 mx-auto mt-28">
        {/* Past session feedback view */}
        {selectedSession && (
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
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="mb-1 text-xl font-bold font-display">
                  {selectedSession.job_role} Interview
                </h2>
                <p className="text-sm text-muted-foreground">
                  &quot;{selectedSession.question}&quot;
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteSession(selectedSession.id)}
              >
                Delete
              </Button>
            </div>
            {selectedSession.video_url && (
              <div className="mb-6 overflow-hidden bg-black rounded-2xl aspect-video ring-1 ring-border/30">
                <video
                  src={selectedSession.video_url}
                  controls
                  className="object-cover w-full h-full"
                />
              </div>
            )}
            {selectedSession.ai_feedback ? (
              <FeedbackDisplay
                feedback={selectedSession.ai_feedback as unknown as Feedback}
              />
            ) : (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Feedback for this session is not yet available or could not
                    be generated.
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {!selectedSession && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between"
            >
              <div>
                <h1 className="text-xl font-bold tracking-tight md:text-2xl font-display">
                  {linkedKit ? linkedKit.title : "Practice Interview"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {linkedKit
                    ? `${linkedKit.job_role} interview kit`
                    : "AI-powered mock interviews with real-time feedback"}
                </p>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex items-center gap-3">
                  <Link href="/candidate/profile">
                    <Button variant="outline" size="sm" className="gap-2">
                      <UserCircle className="w-4 h-4" />
                      Profile
                    </Button>
                  </Link>
                  <TabsList className="p-1 border bg-secondary/30 backdrop-blur-sm border-border/30">
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
                </div>

                {resumeSummary ? (
                  <div className="max-w-2xl rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm text-foreground shadow-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Resume summary
                    </p>
                    <p className="leading-6 text-foreground">{resumeSummary}</p>
                  </div>
                ) : (
                  <div className="max-w-2xl rounded-2xl border border-dashed border-border/40 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
                    Upload a resume in Profile to generate a summary.
                  </div>
                )}
              </div>
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
                    <Card className="max-w-lg mx-auto glass-card glow-border">
                      <CardHeader className="pb-4 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.3)]">
                          <Bot className="w-10 h-10 text-primary" />
                        </div>
                        <CardTitle className="text-xl font-display">
                          {linkedKit
                            ? "Start Interview Kit"
                            : "Start Practice Session"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {linkedKit
                            ? "Answer this company question on video and get instant feedback."
                            : "Our AI interviewer will ask you a question. Record your answer and get instant feedback."}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {kitLoading && (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm border rounded-xl border-border/50 bg-secondary/30 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading interview kit...
                          </div>
                        )}

                        {kitError && (
                          <div className="px-4 py-3 text-sm border rounded-xl border-destructive/30 bg-destructive/10 text-destructive">
                            {kitError}
                          </div>
                        )}

                        {linkedKit && (
                          <div className="px-4 py-3 border rounded-xl border-primary/20 bg-primary/10">
                            <div className="flex items-start gap-3">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {linkedKit.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Question {activeKitQuestionIndex + 1} of{" "}
                                  {linkedKit.questions.length}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block mb-2 text-sm font-medium text-foreground">
                            Job Role
                          </label>
                          <Input
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            placeholder="e.g. Software Engineer, Product Manager"
                            disabled={!!linkedKit}
                            className="bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                          />
                        </div>
                        <Button
                          onClick={startInterview}
                          disabled={
                            isGenerating ||
                            kitLoading ||
                            !jobRole.trim() ||
                            (!!kitId && !linkedKit)
                          }
                          className="w-full gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                          size="lg"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />{" "}
                              Preparing Interview...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />{" "}
                              {linkedKit
                                ? "Start Kit Question"
                                : "Start Interview"}
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
                      <span className="px-3 py-1 text-xs border rounded-full border-border/50 bg-secondary/40 text-muted-foreground">
                        {mediaUnavailableMessage
                          ? "Response: Text transcript"
                          : transcriptionMode === "browser-stt"
                            ? "Recording: Video/audio + browser transcript"
                            : "Recording: Video/audio + local transcript"}
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

                    {mediaUnavailableMessage && !recorder.stream && (
                      <div className="mx-auto max-w-3xl rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-foreground">
                        <p className="font-medium">Recording needs permission</p>
                        <p className="mt-1 text-muted-foreground">
                          {mediaUnavailableMessage}
                        </p>
                      </div>
                    )}

                    <div className="mx-auto max-w-3xl space-y-2 rounded-xl border border-border/50 bg-secondary/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="answer-transcript"
                          className="text-sm font-medium text-foreground"
                        >
                          Text answer / transcript
                        </label>
                        {isTranscribing && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Transcribing...
                          </span>
                        )}
                      </div>
                      <Textarea
                        id="answer-transcript"
                        value={answerTranscript}
                        onChange={(event) => {
                          manualTranscriptEditedRef.current = true;
                          setAnswerTranscript(event.target.value);
                          if (transcriptionError) {
                            setTranscriptionError(null);
                          }
                        }}
                        placeholder="Type your answer here or edit the generated transcript before submitting."
                        className="min-h-32 resize-y bg-background/70"
                      />
                      {transcriptionError ? (
                        <p className="text-xs text-destructive">
                          {transcriptionError}
                        </p>
                      ) : answerTranscript.trim() ? (
                        <p className="text-xs text-muted-foreground">
                          {countWords(answerTranscript)} words captured.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex justify-center gap-3">
                      <Button
                        variant="outline"
                        onClick={resetToSetup}
                        className="border-border/50"
                      >
                        Cancel
                      </Button>
                      {!recorder.isRecording &&
                        (recorder.recordedUrl || answerTranscript.trim()) && (
                        <Button
                          onClick={handleSubmitAnswer}
                          disabled={isSubmittingAnswer}
                          className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                        >
                          {isSubmittingAnswer ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {isTranscribing ? "Transcribing..." : "Submitting..."}
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" /> Submit for Feedback
                            </>
                          )}
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
                    className="py-20 text-center"
                  >
                    <motion.div
                      className="w-24 h-24 rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.3)]"
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5 }}
                    >
                      <Bot className="w-12 h-12 text-primary" />
                    </motion.div>
                    <h2 className="mb-2 text-xl font-bold font-display">
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
                      <h2 className="text-xl font-bold font-display">
                        Your Feedback
                      </h2>
                      <Button
                        onClick={
                          linkedKit &&
                          activeKitQuestionIndex <
                            linkedKit.questions.length - 1
                            ? handleNextKitQuestion
                            : resetToSetup
                        }
                        className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                      >
                        {linkedKit &&
                        activeKitQuestionIndex <
                          linkedKit.questions.length - 1 ? (
                          <>
                            <ArrowRight className="w-4 h-4" /> Next Question
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" /> Practice Again
                          </>
                        )}
                      </Button>
                    </div>
                    <FeedbackDisplay feedback={feedback} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="history">
              <SessionHistory
                sessions={sessions}
                onSelect={viewSession}
                onDelete={handleDeleteSession}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

const DashboardFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="relative">
      <div className="w-12 h-12 border-2 rounded-full border-primary/30 border-t-primary animate-spin" />
      <div className="absolute inset-0 w-12 h-12 rounded-full animate-pulse-glow bg-primary/10" />
    </div>
  </div>
);

export default function CandidateDashboard() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <CandidateDashboardContent />
    </Suspense>
  );
}
