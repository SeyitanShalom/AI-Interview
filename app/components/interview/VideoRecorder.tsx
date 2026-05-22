import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Video, Square, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface VideoRecorderProps {
  stream: MediaStream | null;
  isRecording: boolean;
  recordedUrl: string | null;
  duration: number;
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
  onStartRecording,
  onStopRecording,
  onRetake,
}: VideoRecorderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
