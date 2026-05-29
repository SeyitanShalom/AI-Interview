"use client";

export const dynamic = "force-dynamic";

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
import {
  isMissingProfileResumeColumn,
  isMissingProfileRoleColumn,
} from "@/lib/profileSchema";

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

type ProfileRecord = {
  resume_summary?: string | null;
  resume_roles?: string[] | null;
  target_roles?: string[] | null;
};

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

const previewResponseText = (value: string) => {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
};

const readJsonResponse = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text.trim()) return { data: null as T | null, text };

  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null as T | null, text };
  }
};

const countWords = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const clampScore = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalizeRole = (value: unknown) => {
  if (typeof value !== "string") return null;

  const role = value
    .replace(/[\u2022*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();

  if (role.length < 2 || role.length > 80) return null;
  return role;
};

const normalizeRoles = (values: unknown[]) => {
  const seen = new Set<string>();
  const roles: string[] = [];

  for (const value of values) {
    const role = normalizeRole(value);
    if (!role) continue;

    const key = role.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    roles.push(role);
    if (roles.length >= 12) break;
  }

  return roles;
};

const splitRoleInput = (value: string) =>
  normalizeRoles(value.split(/[,;\n\r]+/));

const getRandomRole = (roles: string[]) =>
  roles.length > 0
    ? roles[Math.floor(Math.random() * roles.length)]
    : "Software Engineer";

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
  const [activeQuestionRole, setActiveQuestionRole] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [resumeRoles, setResumeRoles] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
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
  const profileRoleInitializedRef = useRef(false);

  const profileRoles = useMemo(
    () => normalizeRoles([...targetRoles, ...resumeRoles]),
    [resumeRoles, targetRoles],
  );

  const practiceRolePool = useMemo(
    () => normalizeRoles([...splitRoleInput(jobRole), ...profileRoles]),
    [jobRole, profileRoles],
  );

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

  const getBackupQuestion = useCallback((rolesOrRole: string | string[]) => {
    const roles = Array.isArray(rolesOrRole)
      ? normalizeRoles(rolesOrRole)
      : splitRoleInput(rolesOrRole);
    const normalizedRole = getRandomRole(roles);
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

    const loadProfileContext = async () => {
      const selectProfile = (columns: string) =>
        supabase
          .from("profiles")
          .select(columns)
          .eq("user_id", user.id)
          .maybeSingle();

      let { data, error } = await selectProfile(
        "resume_summary, resume_roles, target_roles",
      );
      let profile = data as ProfileRecord | null;
      let profileSchemaWarning: unknown = null;

      if (error && isMissingProfileRoleColumn(error)) {
        profileSchemaWarning = error;
        const fallback = await selectProfile("resume_summary");
        data = fallback.data;
        error = fallback.error;
        profile = data as ProfileRecord | null;
      }

      if (error && isMissingProfileResumeColumn(error)) {
        profileSchemaWarning = error;
        profile = null;
        error = null;
      }

      if (error) {
        console.warn("Failed to load profile context", error);
        return;
      }

      if (profileSchemaWarning) {
        console.warn("Profile schema migration needed", profileSchemaWarning);
      }

      const nextResumeSummary =
        typeof profile?.resume_summary === "string"
          ? profile.resume_summary.trim()
          : null;
      const nextResumeRoles = normalizeRoles(profile?.resume_roles ?? []);
      const nextTargetRoles = normalizeRoles(profile?.target_roles ?? []);
      const nextProfileRoles = normalizeRoles([
        ...nextTargetRoles,
        ...nextResumeRoles,
      ]);

      setResumeSummary(nextResumeSummary);
      setResumeRoles(nextResumeRoles);
      setTargetRoles(nextTargetRoles);

      if (
        !profileRoleInitializedRef.current &&
        !kitId &&
        nextProfileRoles.length > 0
      ) {
        setJobRole(nextProfileRoles[0]);
        profileRoleInitializedRef.current = true;
      }
    };

    loadProfileContext();
  }, [kitId, user, step]);

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

  const getMediaAccessHint = useCallback(async () => {
    if (typeof window === "undefined") return "";

    const hints: string[] = [];

    if (!window.isSecureContext) {
      hints.push(
        "Open the app from http://localhost:3000 or an HTTPS URL. Browsers block camera prompts on regular network/IP addresses.",
      );
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      hints.push(
        "This browser does not expose camera/microphone recording for this page.",
      );
      return hints.join(" ");
    }

    if (!navigator.permissions?.query) {
      return hints.join(" ");
    }

    const permissionLabels: Record<string, string> = {
      camera: "Camera",
      microphone: "Microphone",
    };

    const permissionStates = await Promise.all(
      (["camera", "microphone"] as const).map(async (name) => {
        try {
          const status = await navigator.permissions.query({
            name,
          } as PermissionDescriptor);
          return { name, state: status.state };
        } catch {
          return null;
        }
      }),
    );

    const deniedPermissions = permissionStates
      .filter(
        (
          permission,
        ): permission is {
          name: "camera" | "microphone";
          state: PermissionState;
        } => Boolean(permission && permission.state === "denied"),
      )
      .map((permission) => permissionLabels[permission.name]);

    if (deniedPermissions.length > 0) {
      hints.push(
        `${deniedPermissions.join(" and ")} permission is blocked for this site. Use the browser address-bar site settings to allow it, then refresh.`,
      );
    }

    return hints.join(" ");
  }, []);

  const startInterview = useCallback(async () => {
    setIsGenerating(true);
    try {
      if (!user?.id) {
        throw new Error("You are not signed in. Please sign in and try again.");
      }

      let question = "";
      let questionRole = linkedKit?.job_role || getRandomRole(practiceRolePool);

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
          const rolePool = practiceRolePool.length
            ? practiceRolePool
            : splitRoleInput(jobRole);
          const roleKeys = new Set(
            rolePool.map((role) => role.trim().toLowerCase()),
          );
          const normalizedJobRole = jobRole.trim().toLowerCase();
          const previousQuestions = sessions
            .filter((session) => {
              const sessionRole = session.job_role.trim().toLowerCase();
              if (sessionRole === normalizedJobRole) return true;

              return splitRoleInput(session.job_role).some((role) =>
                roleKeys.has(role.toLowerCase()),
              );
            })
            .map((session) => session.question)
            .filter(Boolean)
            .slice(0, 12);

          const { data, error } = await supabase.functions.invoke(
            "generate-question",
            {
              body: {
                jobRole,
                rolePool,
                resumeSummary,
                resumeRoles,
                targetRoles,
                previousQuestions,
              },
            },
          );

          if (error) throw error;

          question =
            typeof data?.question === "string" ? data.question.trim() : "";
          questionRole =
            typeof data?.focusRole === "string" && data.focusRole.trim()
              ? data.focusRole.trim()
              : questionRole;

          if (!question) {
            throw new Error("No interview question returned from AI provider");
          }
        } catch (e: unknown) {
          console.warn(
            "AI question generation failed; using backup question.",
            e,
          );
          const fallbackRoles = practiceRolePool.length
            ? practiceRolePool
            : splitRoleInput(jobRole);
          questionRole = getRandomRole(fallbackRoles);
          question = getBackupQuestion([questionRole]);
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
        job_role: questionRole,
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
      setActiveQuestionRole(questionRole);
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
    resumeSummary,
    resumeRoles,
    targetRoles,
    practiceRolePool,
    sessions,
  ]);

  const handleStartRecording = async () => {
    let stream = recorder.stream;

    if (!stream) {
      try {
        stream = await recorder.startCamera();
        setMediaUnavailableMessage(null);
      } catch (error) {
        const hint = await getMediaAccessHint();
        const message = [normalizeErrorMessage(error), hint]
          .filter(Boolean)
          .join(" ");
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

    const { data: payload, text: rawResponse } = await readJsonResponse<
      LocalTranscriptionPayload & { error?: unknown }
    >(response);

    if (!response.ok) {
      const message =
        typeof payload?.error === "string" && payload.error
          ? payload.error
          : rawResponse.trim()
            ? `Local transcription failed (${response.status}): ${previewResponseText(rawResponse)}`
            : "Local transcription failed";
      throw new Error(message);
    }

    if (!payload) {
      const message = rawResponse.trim()
        ? `Transcription endpoint returned non-JSON (${response.status}): ${previewResponseText(rawResponse)}`
        : "Transcription endpoint returned an empty response.";
      throw new Error(message);
    }

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
    setAnswerTranscript("");
    manualTranscriptEditedRef.current = false;
    setTranscriptionError(null);

    try {
      let transcriptForFeedback = "";

      if (recorder.recordedBlob) {
        setIsTranscribing(true);
        try {
          const localResult = await transcribeWithLocalWhisper(
            recorder.recordedBlob,
          );
          const localTranscript = localResult.text;
          if (localTranscript) {
            transcriptForFeedback = localTranscript;
            setAnswerTranscript(localTranscript);
            manualTranscriptEditedRef.current = false;
            toast.success("Transcript generated", {
              description: "Your recording was transcribed successfully.",
            });
          } else if (answerTranscript.trim()) {
            transcriptForFeedback = answerTranscript.trim();
          }
        } catch (transcriptionError) {
          console.warn("Automatic transcription failed:", transcriptionError);
          const transcriptionMessage =
            transcriptionError instanceof Error
              ? transcriptionError.message
              : "Automatic transcription did not return speech text.";

          if (answerTranscript.trim()) {
            transcriptForFeedback = answerTranscript.trim();
          } else {
            setTranscriptionError(
              `${transcriptionMessage} Add the transcript below and submit again.`,
            );
            toast.error("Transcript needed", {
              description: transcriptionMessage,
            });
            return;
          }
        } finally {
          setIsTranscribing(false);
        }
      } else {
        transcriptForFeedback = answerTranscript.trim();

        if (!transcriptForFeedback) {
          setTranscriptionError(
            "Add the transcript below so feedback can be generated.",
          );
          toast.error("Transcript needed", {
            description: "Add the transcript below and submit again.",
          });
          return;
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
            throw new Error(
              uploadError.message || "Failed to upload recording",
            );
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
      const feedbackRole =
        activeQuestionRole || getRandomRole(practiceRolePool);

      try {
        const { data, error } = await supabase.functions.invoke(
          "interview-feedback",
          {
            body: {
              sessionId: currentSessionId,
              jobRole: feedbackRole,
              question: currentQuestion,
              transcript: transcriptForFeedback,
              resumeSummary,
              resumeRoles,
              targetRoles,
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
          feedbackRole,
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
    setActiveQuestionRole("");
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

      <div className="container relative z-10 max-w-5xl px-6 py-10 mx-auto mt-28">
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
              className="gap-2 mb-4 text-muted-foreground hover:text-foreground"
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
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
                      {resumeSummary || profileRoles.length > 0 ? (
                        <div className="px-4 py-3 text-sm border shadow-sm rounded-2xl border-border/40 bg-secondary/20 text-foreground">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Candidate context
                          </p>
                          {resumeSummary && (
                            <p className="leading-6 text-foreground">
                              {resumeSummary}
                            </p>
                          )}
                          {profileRoles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {profileRoles.map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => {
                                    if (!linkedKit) setJobRole(role);
                                  }}
                                  className="px-2 py-1 text-xs border rounded-md border-border/50 bg-background/50 text-muted-foreground hover:text-foreground"
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm border border-dashed rounded-2xl border-border/40 bg-secondary/10 text-muted-foreground">
                          Upload a resume or add practice roles in Profile.
                        </div>
                      )}

                      <Card className="glass-card glow-border">
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
                              Practice Role(s)
                            </label>
                            <Input
                              value={jobRole}
                              onChange={(e) => setJobRole(e.target.value)}
                              placeholder="e.g. Software Engineer, Product Manager"
                              disabled={!!linkedKit}
                              className="bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                            />
                            {!linkedKit && practiceRolePool.length > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Randomized across {practiceRolePool.join(", ")}
                              </p>
                            )}
                            {!linkedKit && profileRoles.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {profileRoles.map((role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    onClick={() => setJobRole(role)}
                                    className={`px-2 py-1 text-xs border rounded-md transition-colors ${
                                      jobRole.trim().toLowerCase() ===
                                      role.toLowerCase()
                                        ? "border-primary/60 bg-primary/10 text-primary"
                                        : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={startInterview}
                            disabled={
                              isGenerating ||
                              kitLoading ||
                              (!linkedKit && practiceRolePool.length === 0) ||
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
                    </div>
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
                      <div className="max-w-3xl p-4 mx-auto text-sm border rounded-xl border-yellow-500/30 bg-yellow-500/10 text-foreground">
                        <p className="font-medium">
                          Recording needs permission
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {mediaUnavailableMessage}
                        </p>
                      </div>
                    )}

                    {(mediaUnavailableMessage ||
                      transcriptionError ||
                      manualTranscriptEditedRef.current) && (
                      <div className="max-w-3xl p-4 mx-auto space-y-2 border rounded-xl border-border/50 bg-secondary/20">
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
                          placeholder="Use this only if recording is unavailable or automatic transcription fails."
                          className="resize-y min-h-32 bg-background/70"
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
                    )}

                    <div className="flex justify-center gap-3">
                      <Button
                        variant="outline"
                        onClick={resetToSetup}
                        className="border-border/50"
                      >
                        Cancel
                      </Button>
                      {!recorder.isRecording &&
                        (recorder.recordedUrl ||
                          ((mediaUnavailableMessage ||
                            transcriptionError ||
                            manualTranscriptEditedRef.current) &&
                            answerTranscript.trim())) && (
                          <Button
                            onClick={handleSubmitAnswer}
                            disabled={isSubmittingAnswer}
                            className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                          >
                            {isSubmittingAnswer ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isTranscribing
                                  ? "Transcribing..."
                                  : "Submitting..."}
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
