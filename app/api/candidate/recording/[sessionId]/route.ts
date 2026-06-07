import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getErrorMessage } from "@/lib/profileSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECORDINGS_BUCKET = "interview-recordings";

type RouteContext = {
  params: Promise<{ sessionId: string }> | { sessionId: string };
};

function getStoragePath(videoUrl: string) {
  try {
    const url = new URL(videoUrl);
    const bucketPrefix = `/storage/v1/object/public/${RECORDINGS_BUCKET}/`;
    const signedBucketPrefix = `/storage/v1/object/sign/${RECORDINGS_BUCKET}/`;
    const path = decodeURIComponent(url.pathname);

    if (path.includes(bucketPrefix)) {
      return path.split(bucketPrefix)[1] || null;
    }

    if (path.includes(signedBucketPrefix)) {
      return path.split(signedBucketPrefix)[1] || null;
    }
  } catch {
    return null;
  }

  return null;
}

function sniffVideoMimeType(bytes: Uint8Array, fallback = "video/webm") {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
  ) {
    return "video/mp4";
  }

  const normalizedFallback =
    fallback.split(";")[0]?.trim().toLowerCase() || "video/webm";
  return normalizedFallback.startsWith("video/")
    ? normalizedFallback
    : "video/webm";
}

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function toArrayBuffer(buffer: Buffer) {
  return new Uint8Array(buffer).buffer;
}

function videoResponse(buffer: Buffer, request: NextRequest, fallback: string) {
  const mimeType = sniffVideoMimeType(buffer, fallback);
  const range = parseRange(request.headers.get("range"), buffer.length);

  if (range) {
    const chunk = buffer.subarray(range.start, range.end + 1);

    return new NextResponse(toArrayBuffer(chunk), {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=0, no-store",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${range.start}-${range.end}/${buffer.length}`,
        "Content-Type": mimeType,
      },
    });
  }

  return new NextResponse(toArrayBuffer(buffer), {
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Length": String(buffer.length),
      "Content-Type": mimeType,
    },
  });
}

async function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase config");
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
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
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const cleanSessionId = sessionId?.trim();

    if (!cleanSessionId) {
      return NextResponse.json(
        { error: "Missing interview session id" },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseClient();
    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("id, video_url")
      .eq("id", cleanSessionId)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        { error: getErrorMessage(sessionError) || "Recording lookup failed" },
        { status: 500 },
      );
    }

    if (!session?.video_url) {
      return NextResponse.json(
        { error: "Recording video is not available for this session" },
        { status: 404 },
      );
    }

    const storagePath = getStoragePath(session.video_url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRole && storagePath) {
      const admin = createClient(supabaseUrl, serviceRole, {
        auth: { persistSession: false },
      });
      const { data: file, error: downloadError } = await admin.storage
        .from(RECORDINGS_BUCKET)
        .download(storagePath);

      if (!downloadError && file) {
        return videoResponse(
          Buffer.from(await file.arrayBuffer()),
          request,
          file.type,
        );
      }
    }

    const upstreamResponse = await fetch(session.video_url, {
      headers: request.headers.get("range")
        ? { Range: request.headers.get("range") as string }
        : undefined,
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: "Recording could not be loaded from storage" },
        { status: upstreamResponse.status },
      );
    }

    return videoResponse(
      Buffer.from(await upstreamResponse.arrayBuffer()),
      request,
      upstreamResponse.headers.get("content-type") || "video/webm",
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
