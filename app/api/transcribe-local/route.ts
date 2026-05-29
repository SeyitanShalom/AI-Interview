import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

type TranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number | null;
  engine?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type ExecFileError = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

class GeminiTranscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GeminiTranscriptionError";
  }
}

function outputToString(output: string | Buffer | undefined) {
  if (!output) return "";
  return Buffer.isBuffer(output) ? output.toString("utf8") : output;
}

function getScriptErrorMessage(error: unknown) {
  const execError = error as ExecFileError;
  const output = [
    outputToString(execError.stdout),
    outputToString(execError.stderr),
  ]
    .join("\n")
    .trim();

  if (output) {
    try {
      const parsed = JSON.parse(output) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) {
        return parsed.error;
      }
    } catch {
      return output;
    }
  }

  return error instanceof Error ? error.message : String(error);
}

function normalizeGeminiTranscript(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { text?: unknown };
    if (typeof parsed.text === "string") {
      return parsed.text.trim();
    }
  } catch {
    // Fall through and treat the model response as plain transcript text.
  }

  return cleaned
    .replace(/^transcript:\s*/i, "")
    .replace(/^text:\s*/i, "")
    .trim();
}

function getMimeType(file: File) {
  const browserMime = file.type.split(";")[0]?.trim();
  if (browserMime) return browserMime;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "webm") return "video/webm";
  if (extension === "mp4") return "video/mp4";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "m4a") return "audio/mp4";

  return "video/webm";
}

function getGeminiModelsToTry() {
  return Array.from(
    new Set(
      [
        process.env.GEMINI_TRANSCRIPTION_MODEL,
        process.env.GEMINI_MODEL,
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
      ].filter((model): model is string => Boolean(model?.trim())),
    ),
  );
}

function formatGeminiError(model: string, status: number, rawBody: string) {
  let providerMessage = rawBody.trim();
  let providerStatus = "";

  try {
    const parsed = JSON.parse(rawBody) as GeminiErrorResponse;
    providerMessage = parsed.error?.message?.trim() || providerMessage;
    providerStatus = parsed.error?.status?.trim() || "";
  } catch {
    // Keep the raw response body if Gemini did not return JSON.
  }

  if (status === 404 || providerStatus === "NOT_FOUND") {
    return `Gemini model "${model}" is not available for generateContent. Set GEMINI_TRANSCRIPTION_MODEL to a supported multimodal model.`;
  }

  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    return `Gemini quota exceeded for "${model}". Enable billing/increase quota in Google AI Studio, wait for quota reset, or use local Whisper.`;
  }

  return providerMessage
    ? `Gemini transcription failed for "${model}": ${providerMessage}`
    : `Gemini transcription failed for "${model}" with HTTP ${status}.`;
}

async function runGeminiTranscription(
  bytes: Buffer,
  mimeType: string,
  language: string,
  model: string,
): Promise<TranscriptionResult> {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = `
Transcribe the spoken answer in this interview recording.
If the speech is not English, translate it into clear English.
Return ONLY strict JSON in this exact shape:
{"text":"..."}
If there is no audible speech, return {"text":""}.
Language hint: ${language}
`.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: bytes.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new GeminiTranscriptionError(
      formatGeminiError(model, response.status, await response.text()),
      response.status,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const rawText =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
  const text = normalizeGeminiTranscript(rawText);

  return {
    text,
    language,
    confidence: null,
    engine: `gemini:${model}`,
  };
}

async function runWhisperScript(
  filePath: string,
  language: string,
): Promise<TranscriptionResult> {
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "transcribe_whisper.py",
  );
  const model = process.env.WHISPER_MODEL || "base";
  const commands: Array<{ cmd: string; args: string[] }> = [
    {
      cmd: "python",
      args: [
        scriptPath,
        "--input",
        filePath,
        "--model",
        model,
        "--language",
        language,
      ],
    },
    {
      cmd: "py",
      args: [
        "-3",
        scriptPath,
        "--input",
        filePath,
        "--model",
        model,
        "--language",
        language,
      ],
    },
  ];

  let lastError: string | null = null;

  for (const command of commands) {
    try {
      const { stdout } = await execFileAsync(command.cmd, command.args, {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
      });
      const parsed = JSON.parse(stdout) as TranscriptionResult;
      return parsed;
    } catch (error) {
      lastError = getScriptErrorMessage(error);
    }
  }

  throw new Error(
    lastError ||
      "Failed to run local Whisper. Install Python and dependencies from requirements-whisper.txt.",
  );
}

export async function POST(req: NextRequest) {
  let tempFilePath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const language = String(formData.get("language") || "en").trim() || "en";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file payload" },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop() || "webm";
    tempFilePath = path.join(
      os.tmpdir(),
      `interview-audio-${Date.now()}.${extension}`,
    );

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file);
    let geminiError: string | null = null;
    let whisperError: string | null = null;

    const geminiModels = getGeminiModelsToTry();

    if (process.env.GEMINI_API_KEY) {
      const geminiErrors: string[] = [];

      for (const model of geminiModels) {
        try {
          const result = await runGeminiTranscription(
            bytes,
            mimeType,
            language,
            model,
          );

          if (result.text) {
            return NextResponse.json({
              text: result.text,
              language: result.language || language,
              duration: result.duration ?? null,
              confidence:
                typeof result.confidence === "number"
                  ? result.confidence
                  : null,
              engine: result.engine || `gemini:${model}`,
            });
          }

          geminiErrors.push(`${model}: no speech text returned`);
        } catch (error) {
          geminiErrors.push(
            `${model}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      geminiError = geminiErrors.join(" ");
    } else {
      geminiError = "GEMINI_API_KEY is not configured.";
    }

    await fs.writeFile(tempFilePath, bytes);

    let result: TranscriptionResult;
    try {
      result = await runWhisperScript(tempFilePath, language);
    } catch (error) {
      whisperError = error instanceof Error ? error.message : String(error);
      const setupHint =
        "Configure GEMINI_API_KEY for cloud transcription, or install local Whisper dependencies and FFmpeg.";
      throw new Error(
        [geminiError, whisperError, setupHint].filter(Boolean).join(" "),
      );
    }

    return NextResponse.json({
      text: result.text || "",
      language: result.language || language,
      duration: result.duration ?? null,
      confidence:
        typeof result.confidence === "number" ? result.confidence : null,
      engine: result.engine || "faster-whisper",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown transcription error";

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
