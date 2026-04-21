# Local Whisper Setup

This project now supports local transcription via `app/api/transcribe-local`.

## 1) Install Python dependencies

From project root:

```powershell
pip install -r requirements-whisper.txt
```

If `pip` is not available, use:

```powershell
py -3 -m pip install -r requirements-whisper.txt
```

## 2) Install FFmpeg

`faster-whisper` needs FFmpeg available on PATH.

Windows (winget):

```powershell
winget install Gyan.FFmpeg
```

## 3) Optional model override

Default model is `base`. You can change it by setting:

```powershell
$env:WHISPER_MODEL="small"
```

Or add it to your local environment file before starting Next.js.

## 4) Run app

```powershell
npm run dev
```

When submitting an interview answer, the app will:

1. Attempt browser speech recognition.
2. If empty, call local Whisper endpoint.
3. If still empty, ask for manual transcript input.
