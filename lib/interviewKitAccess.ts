import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SharedInterviewKit {
  id: string;
  title: string;
  job_role: string;
  questions: string[];
  company_id: string;
  created_at: string;
}

type RawSharedInterviewKit = Omit<SharedInterviewKit, "questions"> & {
  questions: unknown;
};

function isMissingRpcError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("get_shared_interview_kit")
  );
}

export function normalizeInterviewKitQuestions(rawQuestions: unknown) {
  if (Array.isArray(rawQuestions)) {
    return rawQuestions
      .map((question) => String(question).trim())
      .filter(Boolean);
  }

  if (typeof rawQuestions === "string") {
    try {
      const parsed = JSON.parse(rawQuestions) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((question) => String(question).trim())
          .filter(Boolean);
      }
    } catch {
      return rawQuestions.trim() ? [rawQuestions.trim()] : [];
    }
  }

  return [];
}

function normalizeKit(kit: RawSharedInterviewKit | null) {
  if (!kit) return null;

  return {
    ...kit,
    questions: normalizeInterviewKitQuestions(kit.questions),
  };
}

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) return null;

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

async function getKitFromTable(supabase: SupabaseClient, kitId: string) {
  const { data, error } = await supabase
    .from("interview_kits")
    .select("id, title, job_role, questions, company_id, created_at")
    .eq("id", kitId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeKit(data as RawSharedInterviewKit | null);
}

export async function getSharedInterviewKit(
  supabase: SupabaseClient,
  kitId: string,
) {
  const { data: sharedKit, error: sharedKitError } = await supabase
    .rpc("get_shared_interview_kit", { kit_uuid: kitId })
    .maybeSingle();

  if (!sharedKitError) {
    const kit = normalizeKit(sharedKit as RawSharedInterviewKit | null);
    if (kit) return kit;
  } else if (!isMissingRpcError(sharedKitError)) {
    throw sharedKitError;
  }

  const serviceClient = createServiceClient();
  if (serviceClient) {
    return getKitFromTable(serviceClient, kitId);
  }

  if (sharedKitError && isMissingRpcError(sharedKitError)) {
    return getKitFromTable(supabase, kitId);
  }

  return null;
}
