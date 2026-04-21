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
};

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
      lastError = error instanceof Error ? error.message : String(error);
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
    await fs.writeFile(tempFilePath, bytes);

    const result = await runWhisperScript(tempFilePath, language);

    return NextResponse.json({
      text: result.text || "",
      language: result.language || language,
      duration: result.duration ?? null,
      confidence:
        typeof result.confidence === "number" ? result.confidence : null,
      engine: "faster-whisper",
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
