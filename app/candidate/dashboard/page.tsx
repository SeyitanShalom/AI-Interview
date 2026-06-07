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
import { useRouter, useSearchParams } from "next/navigation";
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
  ArrowLeft,
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

type InterviewStep =
  | "setup"
  | "interview"
  | "analyzing"
  | "feedback"
  | "complete";

interface Feedback {
  rubric_scores?: {
    content: number;
    structure: number;
    clarity: number;
    impact: number;
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
  content_score?: number | null;
  style_score?: number | null;
  status: string;
  created_at: string;
  ai_feedback: Feedback | null;
  video_url: string | null;
  completed_at?: string | null;
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

type InterviewSessionInsertPayload = {
  user_id: string;
  job_role: string;
  question: string;
  status: string;
  company_id?: string;
  interview_kit_id?: string;
  candidate_application_id?: string;
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

const getRecordingFileExtension = (mimeType: string) => {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase();

  if (normalized === "video/mp4" || normalized === "audio/mp4") return "mp4";
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/wav") return "wav";
  return "webm";
};

const getRecordingFileName = (blob: Blob) =>
  `answer.${getRecordingFileExtension(blob.type)}`;

const getAuthHeaders = async () => {
  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes?.data?.session?.access_token ?? null;
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const countWords = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const MIN_EVALUATION_WORDS = 12;

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

const formatInterviewQuestionSet = (questions: string[]) => {
  const cleanedQuestions = questions
    .map((question) => question.trim())
    .filter(Boolean);

  if (cleanedQuestions.length === 1) return cleanedQuestions[0];

  return cleanedQuestions
    .map((question, index) => `Question ${index + 1}: ${question}`)
    .join("\n\n");
};

const isMissingSchemaColumnError = (
  error: { code?: string; message?: string } | null,
  columnName: string,
) => {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    (message.includes("schema cache") &&
      message.includes("could not find") &&
      message.includes(columnName.toLowerCase())) ||
    message.includes(`interview_sessions.${columnName.toLowerCase()}`) ||
    message.includes(`column ${columnName.toLowerCase()} does not exist`)
  );
};

const insertInterviewSession = async (
  sessionPayload: InterviewSessionInsertPayload,
) => {
  const insertAndSelect = (payload: InterviewSessionInsertPayload) =>
    supabase.from("interview_sessions").insert(payload).select().single();
  const basePayload: InterviewSessionInsertPayload = {
    user_id: sessionPayload.user_id,
    job_role: sessionPayload.job_role,
    question: sessionPayload.question,
    status: sessionPayload.status,
  };
  const withoutKitId: InterviewSessionInsertPayload = {
    ...basePayload,
    ...(sessionPayload.company_id
      ? { company_id: sessionPayload.company_id }
      : {}),
  };

  const modernResult = await insertAndSelect(sessionPayload);
  if (!modernResult.error) return modernResult;

  if (
    sessionPayload.candidate_application_id &&
    isMissingSchemaColumnError(modernResult.error, "candidate_application_id")
  ) {
    console.warn(
      "interview_sessions.candidate_application_id is missing; retrying session insert without the application id.",
      modernResult.error,
    );

    const withoutApplicationId = { ...sessionPayload };
    delete withoutApplicationId.candidate_application_id;
    return insertInterviewSession(withoutApplicationId);
  }

  if (
    sessionPayload.interview_kit_id &&
    isMissingSchemaColumnError(modernResult.error, "interview_kit_id")
  ) {
    console.warn(
      "interview_sessions.interview_kit_id is missing; retrying session insert without the kit id.",
      modernResult.error,
    );

    const fallbackResult = await insertAndSelect(withoutKitId);

    if (
      fallbackResult.error &&
      withoutKitId.company_id &&
      isMissingSchemaColumnError(fallbackResult.error, "company_id")
    ) {
      console.warn(
        "interview_sessions.company_id is missing; retrying session insert with base columns only.",
        fallbackResult.error,
      );

      return insertAndSelect(basePayload);
    }

    return fallbackResult;
  }

  if (
    sessionPayload.company_id &&
    isMissingSchemaColumnError(modernResult.error, "company_id")
  ) {
    console.warn(
      "interview_sessions.company_id is missing; retrying session insert with base columns only.",
      modernResult.error,
    );

    return insertAndSelect(basePayload);
  }

  return modernResult;
};

const buildFallbackFeedback = (
  jobRole: string,
  question: string,
  transcript: string,
): Feedback => {
  const words = countWords(transcript);
  const hasTranscript = words >= MIN_EVALUATION_WORDS;

  if (!hasTranscript) {
    return {
      rubric_scores: {
        content: 0,
        structure: 0,
        clarity: 0,
        impact: 0,
      },
      content_score: 0,
      style_score: 0,
      overall_score: 0,
      summary:
        words > 0
          ? `Only ${words} transcript words were captured, which is not enough speech to evaluate accurately. Please record your answer again or enter the transcript manually.`
          : "No speech transcript was captured, so this answer cannot be evaluated accurately. Please record your answer again or enter the transcript manually.",
      strengths: [],
      improvements: [
        "Record a complete spoken answer before submitting for feedback.",
        "If automatic transcription misses your answer, paste the transcript manually and submit again.",
      ],
      content_analysis: `Role: ${jobRole}. Question analyzed: ${question}. There was not enough transcript evidence to score the answer.`,
      style_analysis:
        "Clarity cannot be assessed until enough speech is captured in the transcript.",
    };
  }

  const content = clampScore(45 + Math.min(words * 0.28, 35));
  const structure = clampScore(42 + Math.min(words * 0.24, 35));
  const clarity = clampScore(50 + Math.min(words * 0.18, 30));
  const impact = clampScore(38 + Math.min(words * 0.3, 38));
  const contentScore = clampScore(
    content * 0.5 + structure * 0.3 + impact * 0.2,
  );
  const styleScore = clarity;
  const overallScore = clampScore(contentScore * 0.6 + styleScore * 0.4);

  return {
    rubric_scores: { content, structure, clarity, impact },
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
      "Aim for clear pacing, concise sentence structure, and a direct closing statement.",
  };
};

const saveSessionFeedback = async ({
  sessionId,
  feedback,
  completedAt,
  videoUrl,
  companyId,
  interviewKitId,
}: {
  sessionId: string;
  feedback: Feedback;
  completedAt: string;
  videoUrl?: string | null;
  companyId?: string | null;
  interviewKitId?: string | null;
}) => {
  const modernPatch = {
    ai_feedback: feedback,
    content_score: feedback.content_score,
    style_score: feedback.style_score,
    overall_score: feedback.overall_score,
    status: "completed",
    completed_at: completedAt,
    ...(videoUrl ? { video_url: videoUrl } : {}),
    ...(companyId ? { company_id: companyId } : {}),
    ...(interviewKitId ? { interview_kit_id: interviewKitId } : {}),
  };

  const modernResult = await supabase
    .from("interview_sessions")
    .update(modernPatch)
    .eq("id", sessionId)
    .select()
    .single();

  if (!modernResult.error) return modernResult;

  console.warn(
    "Completed session save failed; retrying with base feedback columns.",
    modernResult.error,
  );

  const basePatch = {
    ai_feedback: feedback,
    overall_score: feedback.overall_score,
    status: "completed",
    ...(videoUrl ? { video_url: videoUrl } : {}),
  };

  return supabase
    .from("interview_sessions")
    .update(basePatch)
    .eq("id", sessionId)
    .select()
    .single();
};

const ensureInterviewSessionKitLink = async ({
  sessionId,
  companyId,
  interviewKitId,
}: {
  sessionId: string;
  companyId?: string | null;
  interviewKitId?: string | null;
}) => {
  if (!companyId && !interviewKitId) return;

  const patch = {
    ...(companyId ? { company_id: companyId } : {}),
    ...(interviewKitId ? { interview_kit_id: interviewKitId } : {}),
  };

  const { error } = await supabase
    .from("interview_sessions")
    .update(patch)
    .eq("id", sessionId);

  if (error) {
    console.warn("Session company/kit link repair failed.", error);
  }
};

interface CandidateDashboardViewProps {
  kitIdOverride?: string | null;
  applicationIdOverride?: string | null;
  companyInterviewMode?: boolean;
}

const CandidateDashboardView = ({
  kitIdOverride = null,
  applicationIdOverride = null,
  companyInterviewMode = false,
}: CandidateDashboardViewProps = {}) => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryKitId = searchParams.get("kit");
  const queryApplicationId = searchParams.get("application");
  const kitId = kitIdOverride ?? queryKitId;
  const applicationId =
    applicationIdOverride ?? queryApplicationId?.trim() ?? null;
  const recorder = useVideoRecorder();

  const [step, setStep] = useState<InterviewStep>("setup");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [linkedKit, setLinkedKit] = useState<InterviewKit | null>(null);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [activeKitQuestionIndex, setActiveKitQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [sessionQuestion, setSessionQuestion] = useState("");
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
  const isCompanyKitInterview = Boolean(companyInterviewMode && linkedKit);
  const hasMoreKitQuestionsAfterFeedback = Boolean(
    linkedKit &&
    !isCompanyKitInterview &&
    activeKitQuestionIndex < linkedKit.questions.length - 1,
  );

  useEffect(() => {
    if (authLoading || user) return;

    const redirectPath = `${window.location.pathname}${window.location.search}`;
    router.replace(
      `/candidate/auth?redirect=${encodeURIComponent(redirectPath)}`,
    );
  }, [authLoading, router, user]);

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

    if (
      normalized.includes("interview_kit_id") &&
      normalized.includes("schema cache")
    ) {
      return "Database setup is missing the 'interview_kit_id' column on interview_sessions. Run the latest Supabase migration, then refresh the schema cache.";
    }

    if (
      normalized.includes("company_id") &&
      normalized.includes("schema cache")
    ) {
      return "Database setup is missing the 'company_id' column on interview_sessions. Run the company schema migration, then refresh the schema cache.";
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
    if (!user || companyInterviewMode) return;
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
  }, [companyInterviewMode, user, step]);

  useEffect(() => {
    if (!user || companyInterviewMode) return;

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
  }, [companyInterviewMode, kitId, user, step]);

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

  const syncCandidateApplication = useCallback(
    async (
      status: "interview_started" | "interview_completed",
      sessionId: string,
    ) => {
      if (!applicationId) return;

      const { error } = await supabase.rpc(
        "link_candidate_application_session",
        {
          application_uuid: applicationId,
          session_uuid: sessionId,
          next_status: status,
        },
      );

      if (error) {
        console.warn("Candidate application status sync failed.", error);
      }
    },
    [applicationId],
  );

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

      let sessionQuestionText = "";
      let displayQuestion = "";
      let questionRole = linkedKit?.job_role || getRandomRole(practiceRolePool);

      if (linkedKit) {
        if (companyInterviewMode) {
          const kitQuestions = linkedKit.questions
            .map((question) => question.trim())
            .filter(Boolean);

          sessionQuestionText = formatInterviewQuestionSet(kitQuestions);
          displayQuestion = kitQuestions[0] || "";
          setActiveKitQuestionIndex(0);
        } else {
          displayQuestion =
            linkedKit.questions[activeKitQuestionIndex]?.trim() ||
            linkedKit.questions[0]?.trim() ||
            "";
          sessionQuestionText = displayQuestion;
        }

        if (!sessionQuestionText || !displayQuestion) {
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

          sessionQuestionText =
            typeof data?.question === "string" ? data.question.trim() : "";
          displayQuestion = sessionQuestionText;
          questionRole =
            typeof data?.focusRole === "string" && data.focusRole.trim()
              ? data.focusRole.trim()
              : questionRole;

          if (!sessionQuestionText) {
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
          sessionQuestionText = getBackupQuestion([questionRole]);
          displayQuestion = sessionQuestionText;
        }
      }

      const sessionPayload: InterviewSessionInsertPayload = {
        user_id: user.id,
        job_role: questionRole,
        question: sessionQuestionText,
        status: "pending",
      };

      if (linkedKit) {
        sessionPayload.company_id = linkedKit.company_id;
        sessionPayload.interview_kit_id = linkedKit.id;
        if (applicationId) {
          sessionPayload.candidate_application_id = applicationId;
        }
      }

      const { data: session, error: sessionError } =
        await insertInterviewSession(sessionPayload);

      if (sessionError) {
        const sessionErrorMessage =
          [sessionError.message, sessionError.details, sessionError.hint]
            .filter(Boolean)
            .join(" | ") || "Failed to create interview session";
        throw new Error(sessionErrorMessage);
      }

      if (linkedKit) {
        await ensureInterviewSessionKitLink({
          sessionId: session.id,
          companyId: linkedKit.company_id,
          interviewKitId: linkedKit.id,
        });
      }

      await syncCandidateApplication("interview_started", session.id);

      setCurrentQuestion(displayQuestion);
      setSessionQuestion(sessionQuestionText);
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
    applicationId,
    syncCandidateApplication,
    companyInterviewMode,
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
    formData.append("file", blob, getRecordingFileName(blob));
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
      console.warn("Automatic transcription failed:", message);
      throw new Error(
        "Automatic transcription could not detect your answer. Add the transcript below or try recording again.",
      );
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

  const uploadRecording = useCallback(async (blob: Blob, sessionId: string) => {
    const formData = new FormData();
    formData.append("file", blob, getRecordingFileName(blob));
    formData.append("sessionId", sessionId);

    const response = await fetch("/api/candidate/recording", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
    const { data: payload, text: rawResponse } = await readJsonResponse<{
      publicUrl?: string;
      error?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          (rawResponse.trim()
            ? `Recording upload failed (${response.status}): ${previewResponseText(rawResponse)}`
            : "Recording upload failed"),
      );
    }

    if (!payload?.publicUrl) {
      throw new Error("Recording upload did not return a video URL.");
    }

    return payload.publicUrl;
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
      const feedbackQuestion = sessionQuestion || currentQuestion;

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

      const transcriptWordCount = countWords(transcriptForFeedback);
      if (transcriptWordCount < MIN_EVALUATION_WORDS) {
        const message =
          transcriptWordCount > 0
            ? `Only ${transcriptWordCount} words were captured. Record a fuller answer or edit the transcript before submitting.`
            : "No speech was captured. Record your answer again or enter the transcript manually.";
        setTranscriptionError(message);
        toast.error("Not enough speech to evaluate", {
          description: `At least ${MIN_EVALUATION_WORDS} transcript words are needed for accurate feedback.`,
        });
        return;
      }

      setStep("analyzing");

      let uploadedVideoUrl: string | null = null;

      if (recorder.recordedBlob) {
        try {
          uploadedVideoUrl = await uploadRecording(
            recorder.recordedBlob,
            currentSessionId,
          );
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
              question: feedbackQuestion,
              transcript: transcriptForFeedback,
              resumeSummary: companyInterviewMode ? null : resumeSummary,
              resumeRoles: companyInterviewMode ? [] : resumeRoles,
              targetRoles: companyInterviewMode ? [] : targetRoles,
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
          feedbackQuestion,
          transcriptForFeedback,
        );
        usedFallbackFeedback = true;
      }

      if (usedFallbackFeedback) {
        toast.warning("Using baseline feedback", {
          description:
            "AI feedback was unavailable, so a local rubric was used for this submission.",
        });
      }

      if (!nextFeedback) {
        throw new Error("Feedback could not be generated");
      }

      const completedAt = new Date().toISOString();
      const { data: completedSession, error: completedSessionError } =
        await saveSessionFeedback({
          sessionId: currentSessionId,
          feedback: nextFeedback,
          completedAt,
          videoUrl: uploadedVideoUrl,
          companyId: linkedKit?.company_id ?? null,
          interviewKitId: linkedKit?.id ?? null,
        });

      if (completedSessionError) {
        console.warn("Completed session save failed:", completedSessionError);
      }

      await syncCandidateApplication("interview_completed", currentSessionId);

      const completedSessionRecord =
        (completedSession as unknown as Partial<Session> | null) ?? {};
      const sessionForHistory = {
        ...completedSessionRecord,
        id: currentSessionId,
        job_role: completedSessionRecord.job_role ?? feedbackRole,
        question: completedSessionRecord.question ?? feedbackQuestion,
        overall_score: nextFeedback.overall_score,
        content_score: nextFeedback.content_score,
        style_score: nextFeedback.style_score,
        status: "completed",
        created_at:
          completedSessionRecord.created_at ?? new Date().toISOString(),
        ai_feedback: nextFeedback,
        video_url: completedSessionRecord.video_url ?? uploadedVideoUrl,
        completed_at: completedAt,
      } as Session;

      setSessions((previousSessions) => [
        sessionForHistory,
        ...previousSessions.filter(
          (session) => session.id !== currentSessionId,
        ),
      ]);
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

    if (isCompanyKitInterview && linkedKit?.questions[0]) {
      setActiveKitQuestionIndex(0);
      setCurrentQuestion(linkedKit.questions[0]);
    }
  };

  const handleSelectKitQuestion = (index: number) => {
    if (!linkedKit) return;

    const question = linkedKit.questions[index]?.trim();
    if (!question) return;

    setActiveKitQuestionIndex(index);
    setCurrentQuestion(question);
  };

  const resetToSetup = () => {
    stopSpeechRecognition();
    recorder.stopCamera();
    recorder.resetRecording();
    setStep("setup");
    setFeedback(null);
    setCurrentSessionId(null);
    setCurrentQuestion("");
    setSessionQuestion("");
    setActiveQuestionRole("");
    setSelectedSession(null);
    setAnswerTranscript("");
    manualTranscriptEditedRef.current = false;
    setMediaUnavailableMessage(null);
    setTranscriptionError(null);
    if (companyInterviewMode) {
      setActiveKitQuestionIndex(0);
    }
  };

  const handleNextKitQuestion = () => {
    if (!linkedKit) return;

    stopSpeechRecognition();
    recorder.stopCamera();
    recorder.resetRecording();
    setFeedback(null);
    setCurrentSessionId(null);
    setCurrentQuestion("");
    setSessionQuestion("");
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

  const handleFinishCompanyInterview = () => {
    stopSpeechRecognition();
    recorder.stopCamera();
    recorder.resetRecording();
    setFeedback(null);
    setCurrentSessionId(null);
    setCurrentQuestion("");
    setSessionQuestion("");
    setActiveQuestionRole("");
    setSelectedSession(null);
    setAnswerTranscript("");
    manualTranscriptEditedRef.current = false;
    setMediaUnavailableMessage(null);
    setTranscriptionError(null);
    setActiveKitQuestionIndex(0);
    setStep("complete");
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

  if (authLoading || !user) {
    return <DashboardLoadingFallback />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-125 h-125 bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-100 h-100 bg-primary/2 rounded-full blur-[100px]" />
      </div>

      <div className="container relative z-10 max-w-5xl px-6 py-10 mx-auto mt-28">
        {/* Past session feedback view */}
        {!companyInterviewMode && selectedSession && (
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
            <div
              className={
                selectedSession.video_url
                  ? "grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start"
                  : "space-y-6"
              }
            >
              {selectedSession.video_url && (
                <div className="overflow-hidden bg-black rounded-2xl aspect-video ring-1 ring-border/30 lg:sticky lg:top-24">
                  <video
                    controls
                    className="object-cover w-full h-full"
                  >
                    <source
                      src={`/api/candidate/recording/${encodeURIComponent(
                        selectedSession.id,
                      )}`}
                    />
                    <source src={selectedSession.video_url} />
                  </video>
                </div>
              )}
              <div className="min-w-0">
                {selectedSession.ai_feedback ? (
                  <FeedbackDisplay
                    feedback={
                      selectedSession.ai_feedback as unknown as Feedback
                    }
                  />
                ) : (
                  <Card className="glass-card">
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Feedback for this session is not yet available or could
                        not be generated.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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
                  {linkedKit
                    ? linkedKit.title
                    : companyInterviewMode
                      ? "Company Interview"
                      : "Practice Interview"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {linkedKit
                    ? companyInterviewMode
                      ? `${linkedKit.job_role} company interview`
                      : `${linkedKit.job_role} interview kit`
                    : companyInterviewMode
                      ? "Complete your assigned company interview"
                      : "AI-powered mock interviews with real-time feedback"}
                </p>
              </div>
              {!companyInterviewMode && (
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
              )}
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
                      {companyInterviewMode ? (
                        <div className="px-4 py-3 text-sm border shadow-sm rounded-2xl border-border/40 bg-secondary/20 text-foreground">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Company interview
                          </p>
                          {linkedKit ? (
                            <>
                              <p className="text-base font-medium text-foreground">
                                {linkedKit.job_role}
                              </p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {linkedKit.questions.length} question
                                {linkedKit.questions.length !== 1 ? "s" : ""}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {kitLoading
                                ? "Loading your assigned interview..."
                                : kitError || "Interview details unavailable."}
                            </p>
                          )}
                        </div>
                      ) : resumeSummary || profileRoles.length > 0 ? (
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
                            {companyInterviewMode
                              ? "Start Company Interview"
                              : linkedKit
                                ? "Start Interview Kit"
                                : "Start Practice Session"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {companyInterviewMode
                              ? "Answer the company questions in one video and submit it for review."
                              : linkedKit
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
                                    {companyInterviewMode
                                      ? `${linkedKit.questions.length} question${
                                          linkedKit.questions.length !== 1
                                            ? "s"
                                            : ""
                                        }`
                                      : `Question ${
                                          activeKitQuestionIndex + 1
                                        } of ${linkedKit.questions.length}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {!companyInterviewMode && (
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
                                  Randomized across{" "}
                                  {practiceRolePool.join(", ")}
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
                          )}
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
                                  ? companyInterviewMode
                                    ? "Start Interview"
                                    : "Start Kit Question"
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

                    {isCompanyKitInterview &&
                      linkedKit &&
                      linkedKit.questions.length > 1 && (
                        <div className="max-w-3xl p-4 mx-auto space-y-3 border rounded-xl border-border/50 bg-secondary/20">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-medium text-foreground">
                              Question {activeKitQuestionIndex + 1} of{" "}
                              {linkedKit.questions.length}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleSelectKitQuestion(
                                    activeKitQuestionIndex - 1,
                                  )
                                }
                                disabled={activeKitQuestionIndex === 0}
                                className="gap-1.5 border-border/50"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Previous
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleSelectKitQuestion(
                                    activeKitQuestionIndex + 1,
                                  )
                                }
                                disabled={
                                  activeKitQuestionIndex >=
                                  linkedKit.questions.length - 1
                                }
                                className="gap-1.5 border-border/50"
                              >
                                Next
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {linkedKit.questions.map((question, index) => {
                              const isActive = index === activeKitQuestionIndex;

                              return (
                                <button
                                  key={`${question}-${index}`}
                                  type="button"
                                  aria-current={isActive ? "step" : undefined}
                                  onClick={() => handleSelectKitQuestion(index)}
                                  className={`flex min-h-16 items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                    isActive
                                      ? "border-primary/50 bg-primary/10 text-foreground"
                                      : "border-border/40 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                  }`}
                                >
                                  <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                                      isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-muted-foreground"
                                    }`}
                                  >
                                    {index + 1}
                                  </span>
                                  <span className="leading-5 line-clamp-2">
                                    {question}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                                <Send className="w-4 h-4" />{" "}
                                {isCompanyKitInterview
                                  ? "Submit Interview"
                                  : "Submit for Feedback"}
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
                          hasMoreKitQuestionsAfterFeedback
                            ? handleNextKitQuestion
                            : companyInterviewMode
                              ? handleFinishCompanyInterview
                              : resetToSetup
                        }
                        className="gap-2 bg-linear-to-r from-primary to-primary-glow hover:opacity-90"
                      >
                        {hasMoreKitQuestionsAfterFeedback ? (
                          <>
                            <ArrowRight className="w-4 h-4" /> Next Question
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />{" "}
                            {companyInterviewMode
                              ? "Finish Interview"
                              : "Practice Again"}
                          </>
                        )}
                      </Button>
                    </div>
                    <FeedbackDisplay feedback={feedback} />
                  </motion.div>
                )}

                {step === "complete" && companyInterviewMode && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-20 text-center"
                  >
                    <div className="max-w-xl mx-auto">
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.3)]">
                        <FileText className="w-10 h-10 text-primary" />
                      </div>
                      <h2 className="mb-2 text-2xl font-bold font-display">
                        Interview Submitted
                      </h2>
                      <p className="text-muted-foreground">
                        Your responses have been saved for the company to
                        review.
                      </p>
                      {linkedKit && (
                        <Link
                          href={`/interview/kit/${encodeURIComponent(linkedKit.id)}`}
                        >
                          <Button variant="outline" className="mt-6">
                            View Interview Kit
                          </Button>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {!companyInterviewMode && (
              <TabsContent value="history">
                <SessionHistory
                  sessions={sessions}
                  onSelect={viewSession}
                  onDelete={handleDeleteSession}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
};

const DashboardLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="relative">
      <div className="w-12 h-12 border-2 rounded-full border-primary/30 border-t-primary animate-spin" />
      <div className="absolute inset-0 w-12 h-12 rounded-full animate-pulse-glow bg-primary/10" />
    </div>
  </div>
);

export default function CandidateDashboard(
  props: CandidateDashboardViewProps = {},
) {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <CandidateDashboardView {...props} />
    </Suspense>
  );
}
