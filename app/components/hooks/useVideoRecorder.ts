"use client";
import { useState, useRef, useCallback } from "react";

export const useVideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      setError(null);
      return mediaStream;
    } catch {
      setError(
        "Camera access denied. Please allow camera and microphone access.",
      );
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  const startRecording = useCallback((mediaStream: MediaStream) => {
    chunksRef.current = [];
    setDuration(0);
    const recorder = new MediaRecorder(mediaStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
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
