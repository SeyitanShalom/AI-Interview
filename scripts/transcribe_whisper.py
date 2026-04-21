import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe media with faster-whisper")
    parser.add_argument("--input", required=True, help="Path to audio/video file")
    parser.add_argument("--model", default="base", help="Whisper model name")
    parser.add_argument("--language", default="en", help="Language code")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {input_path}"}))
        return 1

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(json.dumps({"error": f"faster-whisper import failed: {exc}"}))
        return 1

    try:
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        segments, info = model.transcribe(str(input_path), language=args.language)
        segment_list = list(segments)

        text = " ".join(
            segment.text.strip() for segment in segment_list if segment.text
        ).strip()

        total_weight = 0.0
        weighted_confidence_sum = 0.0
        for segment in segment_list:
            segment_text = (segment.text or "").strip()
            if not segment_text:
                continue

            avg_logprob = getattr(segment, "avg_logprob", None)
            if avg_logprob is None:
                continue

            # Map common log-probability range [-2.0, 0.0] to [0.0, 1.0].
            segment_confidence = max(0.0, min(1.0, (float(avg_logprob) + 2.0) / 2.0))
            weight = float(len(segment_text.split()))

            weighted_confidence_sum += segment_confidence * weight
            total_weight += weight

        confidence = (
            weighted_confidence_sum / total_weight if total_weight > 0 else None
        )

        print(
            json.dumps(
                {
                    "text": text,
                    "language": getattr(info, "language", args.language),
                    "duration": getattr(info, "duration", None),
                    "confidence": confidence,
                },
                ensure_ascii=True,
            )
        )
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"Transcription failed: {exc}"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
