"use client";
import { useState, useRef, useCallback } from "react";

function getMediaAccessErrorMessage(error: unknown) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Camera and microphone access is not available in this browser. Use Chrome or Edge on localhost or HTTPS.";
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera or microphone permission was blocked. Allow both permissions in your browser and try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No available camera or microphone was found on this device.";
      case "NotReadableError":
      case "TrackStartError":
        return "Your camera or microphone is already in use by another app.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "Your camera does not support the requested recording settings.";
      case "SecurityError":
        return "Camera and microphone access requires localhost or HTTPS.";
      default:
        return error.message || "Camera and microphone access failed.";
    }
  }

  return "Camera and microphone access failed.";
}

function getPlayableRecordingMimeType() {
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4",
    'video/webm;codecs="vp8,opus"',
    'video/webm;codecs="vp9,opus"',
    "video/webm",
  ];
  const playbackProbe =
    typeof document !== "undefined" ? document.createElement("video") : null;

  return candidates.find((type) => {
    if (!MediaRecorder.isTypeSupported(type)) return false;
    if (!playbackProbe) return true;

    const baseType = type.split(";")[0];
    return Boolean(
      playbackProbe.canPlayType(type) || playbackProbe.canPlayType(baseType),
    );
  });
}

export const useVideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const constraintsToTry: MediaStreamConstraints[] = [
        {
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: true,
        },
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: "user" },
          },
          audio: true,
        },
        { video: true, audio: true },
      ];

      let mediaStream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const constraints of constraintsToTry) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          lastError = error;

          if (
            error instanceof DOMException &&
            (error.name === "NotAllowedError" ||
              error.name === "PermissionDeniedError" ||
              error.name === "NotFoundError" ||
              error.name === "DevicesNotFoundError" ||
              error.name === "SecurityError")
          ) {
            break;
          }
        }
      }

      if (!mediaStream) {
        throw lastError;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);
      return mediaStream;
    } catch (cameraError) {
      const message = getMediaAccessErrorMessage(cameraError);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startRecording = useCallback((mediaStream: MediaStream) => {
    try {
      chunksRef.current = [];
      setDuration(0);
      setError(null);

      const mimeType = getPlayableRecordingMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType
        ? { mimeType }
        : {};

      if (mediaStream.getVideoTracks().length > 0) {
        recorderOptions.videoBitsPerSecond = 900_000;
      }

      if (mediaStream.getAudioTracks().length > 0) {
        recorderOptions.audioBitsPerSecond = 96_000;
      }

      const recorder = new MediaRecorder(mediaStream, recorderOptions);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setError("Recording failed. Please retake your answer.");
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.onstop = () => {
        const blobType =
          recorder.mimeType || mimeType || chunksRef.current[0]?.type || "";
        const blob = new Blob(chunksRef.current, {
          type: blobType,
        });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      return true;
    } catch {
      setError("Recording could not start in this browser.");
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    chunksRef.current = [];
    setDuration(0);
  }, [recordedUrl]);

  return {
    isRecording,
    recordedBlob,
    recordedUrl,
    stream,
    error,
    duration,
    startCamera,
    stopCamera,
    startRecording,
    stopRecording,
    resetRecording,
  };
};
