# Open-Source Speech Recognition & Text-to-Speech Setup

This project now uses **open-source** speech technologies instead of browser-native APIs.

## Technologies Used

### Speech-to-Text (STT)
- **Whisper** (OpenAI's open-source model) via API
- High accuracy, supports multiple languages
- Works offline-capable (can be self-hosted)

### Text-to-Speech (TTS)
- **OpenAI TTS API** (based on open-source models)
- 6 natural-sounding voices
- High quality audio output

## Setup Instructions

### 1. Configure OpenAI API Key

The speech features require an OpenAI API key (for Whisper STT and TTS).

**Option A: Environment Variable**
```bash
# In server/.env
OPENAI_API_KEY=your-openai-api-key-here
```

**Option B: Admin Console**
1. Go to Admin Console → Settings → API Keys
2. Add OpenAI API key
3. The system will use it automatically

### 2. Install Dependencies

All dependencies are already in `package.json`. No additional installation needed.

### 3. Start the Server

```bash
cd server
npm run dev
```

The speech endpoints will be available at:
- `POST /api/speech/transcribe` - Convert audio to text
- `POST /api/speech/synthesize` - Convert text to audio
- `GET /api/speech/voices` - Get available voices

## How It Works

### Voice Input (STT)
1. User clicks microphone button
2. Browser captures audio using `MediaRecorder` API
3. Audio chunks (every 3 seconds) are sent to `/api/speech/transcribe`
4. Backend uses Whisper to transcribe audio
5. Transcribed text is displayed and auto-sent as message

### Voice Output (TTS)
1. AI generates a response
2. Frontend calls `/api/speech/synthesize` with the text
3. Backend generates MP3 audio using OpenAI TTS
4. Audio is streamed back to frontend
5. Browser plays the audio automatically

## Future Enhancements

For fully self-hosted open-source solutions, you can replace:
- **STT**: Use local Whisper model (via `whisper.cpp` or Python)
- **TTS**: Use Coqui TTS, Piper TTS, or eSpeak-ng

## Troubleshooting

### "Speech recognition service not configured"
- Ensure `OPENAI_API_KEY` is set in environment variables or Admin Console
- Restart the server after adding the key

### "Microphone access denied"
- Check browser permissions for microphone access
- Ensure you're using HTTPS (required for microphone in production)

### Audio not playing
- Check browser audio settings
- Ensure audio isn't muted
- Check browser console for errors



