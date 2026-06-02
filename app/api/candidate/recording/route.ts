import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/profileSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECORDINGS_BUCKET = "interview-recordings";
const MAX_RECORDING_BYTES = 80 * 1024 * 1024;
const ALLOWED_RECORDING_MIME_TYPES = new Set([
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

type StorageAdmin = {
  storage: {
    getBucket: (bucketId: string) => Promise<{ error: unknown | null }>;
    updateBucket: (
      bucketId: string,
      options: { public: boolean },
    ) => Promise<{ error: unknown | null }>;
    createBucket: (
      bucketId: string,
      options: { public: boolean },
    ) => Promise<{ error: unknown | null }>;
    from: (bucketId: string) => {
      upload: (
        path: string,
        body: Buffer,
        options: {
          contentType: string;
          upsert: boolean;
          cacheControl: string;
        },
      ) => Promise<{ error: unknown | null }>;
      getPublicUrl: (path: string) => {
        data: { publicUrl: string };
      };
    };
  };
};

function isMissingStorageBucket(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("bucket not found") ||
    message.includes("bucket does not exist") ||
    message.includes("the resource was not found")
  );
}

async function ensureRecordingBucket(admin: StorageAdmin) {
  const { error: bucketError } = await admin.storage.getBucket(
    RECORDINGS_BUCKET,
  );

  if (!bucketError) {
    await admin.storage.updateBucket(RECORDINGS_BUCKET, { public: true });
    return;
  }

  if (!isMissingStorageBucket(bucketError)) {
    throw new Error(
      getErrorMessage(bucketError) || "Recording bucket check failed",
    );
  }

  const { error: createError } = await admin.storage.createBucket(
    RECORDINGS_BUCKET,
    { public: true },
  );

  if (
    createError &&
    !getErrorMessage(createError).toLowerCase().includes("already exists")
  ) {
    throw new Error(
      getErrorMessage(createError) || "Recording bucket creation failed",
    );
  }
}

async function getOwnerId(request: Request) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { ownerId: null, error: "Missing Supabase config", status: 500 };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (!userErr && userData?.user) {
    return { ownerId: userData.user.id, error: null, status: 200 };
  }

  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ownerId: null, error: "Unauthorized", status: 401 };
  }

  const token = authHeader.split(" ")[1];
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) {
    return { ownerId: null, error: "Invalid token", status: 401 };
  }

  const userJson = (await userResp.json()) as { id?: string | null };
  return { ownerId: userJson?.id ?? null, error: null, status: 200 };
}

function getRecordingMimeType(file: File) {
  return file.type.split(";")[0]?.trim().toLowerCase() || "video/webm";
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { error: "Missing Supabase recording upload config" },
        { status: 500 },
      );
    }

    const ownerResult = await getOwnerId(request);
    if (!ownerResult.ownerId) {
      return NextResponse.json(
        { error: ownerResult.error || "Unauthorized" },
        { status: ownerResult.status },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const sessionId = String(form.get("sessionId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing recording file" },
        { status: 400 },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing interview session id" },
        { status: 400 },
      );
    }

    if (file.size > MAX_RECORDING_BYTES) {
      return NextResponse.json(
        { error: "Recording is too large. Keep videos under 80 MB." },
        { status: 413 },
      );
    }

    const mimeType = getRecordingMimeType(file);
    if (!ALLOWED_RECORDING_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported recording format." },
        { status: 400 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });
    const filePath = `${ownerResult.ownerId}/${sessionId}.webm`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await ensureRecordingBucket(admin);

    const { error: uploadError } = await admin.storage
      .from(RECORDINGS_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "0",
      });

    if (uploadError) {
      return NextResponse.json(
        { error: getErrorMessage(uploadError) || "Recording upload failed" },
        { status: 500 },
      );
    }

    const { data: urlData } = admin.storage
      .from(RECORDINGS_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    const { error: updateError } = await admin
      .from("interview_sessions")
      .update({ video_url: publicUrl })
      .eq("id", sessionId)
      .eq("user_id", ownerResult.ownerId);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            getErrorMessage(updateError) || "Recording URL update failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
