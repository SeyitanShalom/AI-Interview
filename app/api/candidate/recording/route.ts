import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/profileSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECORDINGS_BUCKET = "interview-recordings";
const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
const ALLOWED_RECORDING_MIME_TYPES = new Set([
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

function isMissingStorageBucket(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("bucket not found") ||
    message.includes("bucket does not exist") ||
    message.includes("the resource was not found")
  );
}

async function ensureRecordingBucket(admin: SupabaseClient) {
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

async function getOwnerClient(request: Request) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      ownerId: null,
      client: null,
      error: "Missing Supabase config",
      status: 500,
    };
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
    return {
      ownerId: userData.user.id,
      client: supabase,
      error: null,
      status: 200,
    };
  }

  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ownerId: null, client: null, error: "Unauthorized", status: 401 };
  }

  const token = authHeader.split(" ")[1];
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) {
    return { ownerId: null, client: null, error: "Invalid token", status: 401 };
  }

  const userJson = (await userResp.json()) as { id?: string | null };
  return {
    ownerId: userJson?.id ?? null,
    client: createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }),
    error: null,
    status: 200,
  };
}

function getRecordingMimeType(file: File) {
  const browserMime = file.type.split(";")[0]?.trim().toLowerCase();
  if (browserMime) return browserMime;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp4" || extension === "m4a") return "video/mp4";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  return "video/webm";
}

function getRecordingExtension(mimeType: string) {
  if (mimeType === "video/mp4" || mimeType === "audio/mp4") return "mp4";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  return "webm";
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const ownerResult = await getOwnerClient(request);
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
        { error: "Recording is too large. Keep videos under 200 MB." },
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

    const admin = serviceRole
      ? createClient(supabaseUrl, serviceRole, {
          auth: { persistSession: false },
        })
      : null;
    const uploadClient = admin ?? ownerResult.client;

    if (!uploadClient) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const filePath = `${ownerResult.ownerId}/${sessionId}.${getRecordingExtension(
      mimeType,
    )}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (admin) {
      await ensureRecordingBucket(admin);
    }

    const { error: uploadError } = await uploadClient.storage
      .from(RECORDINGS_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "0",
      });

    if (uploadError) {
      if (!admin && isMissingStorageBucket(uploadError)) {
        return NextResponse.json(
          {
            error:
              "Recording storage bucket is missing. Run the Supabase recording migration or configure SUPABASE_SERVICE_ROLE_KEY so the app can create it.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: getErrorMessage(uploadError) || "Recording upload failed" },
        { status: 500 },
      );
    }

    const { data: urlData } = uploadClient.storage
      .from(RECORDINGS_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    const { error: updateError } = await uploadClient
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
