import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Mic, Moon, RotateCcw, Square, Video } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  RecordingQuality,
  summarizeRecordingQuality,
} from "@/lib/recordingQuality";

interface VideoRecorderProps {
  stream: MediaStream | null;
  isRecording: boolean;
  recordedUrl: string | null;
  duration: number;
  quality?: RecordingQuality;
  onQualityChange?: (quality: RecordingQuality) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetake: () => void;
}

const formatTime = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

const VideoRecorder = ({
  stream,
  isRecording,
  recordedUrl,
  duration,
  quality,
  onQualityChange,
  onStartRecording,
  onStopRecording,
  onRetake,
}: VideoRecorderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream || !isRecording || !onQualityChange) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    const AudioContextCtor =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (AudioContextCtor && audioTracks.length > 0) {
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      audioSourceRef.current = source;
    }

    const sampleQuality = () => {
      let averageBrightness: number | null = null;

      if (
        video &&
        context &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        canvas.width = 48;
        canvas.height = 27;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        let brightnessTotal = 0;

        for (let index = 0; index < frame.data.length; index += 4) {
          const red = frame.data[index];
          const green = frame.data[index + 1];
          const blue = frame.data[index + 2];
          brightnessTotal += (red + green + blue) / 3;
        }

        averageBrightness = brightnessTotal / (frame.data.length / 4);
      }

      let audioLevel: number | null = null;
      const analyser = analyserRef.current;

      if (analyser) {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;

        for (const value of data) {
          const centered = (value - 128) / 128;
          sumSquares += centered * centered;
        }

        audioLevel = Math.sqrt(sumSquares / data.length);
      }

      onQualityChange(
        summarizeRecordingQuality({
          durationSeconds: duration,
          cameraAvailable: videoTracks.some((track) => track.readyState === "live"),
          microphoneAvailable: audioTracks.some(
            (track) => track.readyState === "live",
          ),
          averageBrightness,
          audioLevel,
          lowLight:
            averageBrightness !== null &&
            averageBrightness > 12 &&
            averageBrightness < 55,
          cameraObstructed:
            averageBrightness !== null && averageBrightness <= 12,
          quietAudio: audioLevel !== null && duration >= 4 && audioLevel < 0.015,
        }),
      );
    };

    sampleQuality();
    const interval = window.setInterval(sampleQuality, 1000);

    return () => {
      window.clearInterval(interval);
      audioSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
      audioSourceRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
    };
  }, [duration, isRecording, onQualityChange, stream]);

  const visibleWarnings = quality?.warnings.slice(0, 2) ?? [];

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video ring-1 ring-border/30">
      {recordedUrl ? (
        <video
          ref={playbackRef}
          src={recordedUrl}
          controls
          className="w-full h-full object-cover"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex flex-col items-center gap-2 text-center text-white/75">
                <Video className="h-8 w-8" />
                <span className="text-sm">Camera preview will appear here</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-xl px-3.5 py-2 border border-white/10">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-destructive"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
          <span className="text-sm font-mono text-white">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {isRecording && visibleWarnings.length > 0 && (
        <div className="absolute top-4 right-4 max-w-xs space-y-2">
          {visibleWarnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-xl border border-yellow-400/30 bg-black/65 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md"
            >
              {warning.toLowerCase().includes("audio") ? (
                <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-300" />
              ) : warning.toLowerCase().includes("light") ||
                warning.toLowerCase().includes("dark") ? (
                <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-300" />
              )}
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls overlay */}
      {!recordedUrl && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          {!isRecording ? (
            <Button
              onClick={onStartRecording}
              size="lg"
              className="rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.5)]"
            >
              <Video className="w-5 h-5" />{" "}
              {stream ? "Start Recording" : "Enable Camera"}
            </Button>
          ) : (
            <Button
              onClick={onStopRecording}
              size="lg"
              className="rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.5)]"
            >
              <Square className="w-4 h-4" /> Stop
            </Button>
          )}
        </div>
      )}

      {recordedUrl && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            onClick={onRetake}
            variant="secondary"
            className="rounded-xl gap-2 backdrop-blur-sm"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
