export type RecordingQualityStatus = "good" | "fair" | "poor";

export type RecordingQuality = {
  durationSeconds: number;
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  lowLight: boolean;
  cameraObstructed: boolean;
  quietAudio: boolean;
  averageBrightness: number | null;
  audioLevel: number | null;
  status: RecordingQualityStatus;
  warnings: string[];
};

export const createDefaultRecordingQuality = (): RecordingQuality => ({
  durationSeconds: 0,
  cameraAvailable: false,
  microphoneAvailable: false,
  lowLight: false,
  cameraObstructed: false,
  quietAudio: false,
  averageBrightness: null,
  audioLevel: null,
  status: "fair",
  warnings: [],
});

export const summarizeRecordingQuality = (
  partial: Partial<RecordingQuality>,
): RecordingQuality => {
  const durationSeconds = Math.max(0, Math.round(partial.durationSeconds ?? 0));
  const averageBrightness = partial.averageBrightness ?? null;
  const audioLevel = partial.audioLevel ?? null;
  const cameraAvailable = Boolean(partial.cameraAvailable);
  const microphoneAvailable = Boolean(partial.microphoneAvailable);
  const lowLight = Boolean(partial.lowLight);
  const cameraObstructed = Boolean(partial.cameraObstructed);
  const quietAudio = Boolean(partial.quietAudio);
  const warnings: string[] = [];

  if (!cameraAvailable) warnings.push("Camera was not available.");
  if (!microphoneAvailable) warnings.push("Microphone was not available.");
  if (durationSeconds > 0 && durationSeconds < 15) {
    warnings.push("Recording was very short.");
  }
  if (cameraObstructed) {
    warnings.push("Camera preview appeared blocked or almost fully dark.");
  } else if (lowLight) {
    warnings.push("Lighting appeared low during recording.");
  }
  if (quietAudio) warnings.push("Audio level was very quiet.");

  const seriousFlags =
    !cameraAvailable ||
    !microphoneAvailable ||
    cameraObstructed ||
    (durationSeconds > 0 && durationSeconds < 8);
  const cautionFlags =
    lowLight || quietAudio || (durationSeconds > 0 && durationSeconds < 15);

  const status: RecordingQualityStatus = seriousFlags
    ? "poor"
    : cautionFlags
      ? "fair"
      : "good";

  return {
    durationSeconds,
    cameraAvailable,
    microphoneAvailable,
    lowLight,
    cameraObstructed,
    quietAudio,
    averageBrightness,
    audioLevel,
    status,
    warnings,
  };
};
