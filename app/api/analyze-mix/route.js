// app/api/analyze-mix/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Next.js App Router: no `config` export needed
export async function POST(req) {
  try {
    // 1) Read form-data from the request
    const formData = await req.formData();

    const blob = formData.get("file");

    const rawQuestion =
      formData.get("question") || formData.get("prompt") || "";
    const question =
      typeof rawQuestion === "string" ? rawQuestion.trim() : "";

    const mode = (formData.get("mode") || "Vocals").toString();
    const preset = (formData.get("preset") || "Modern Metalcore").toString();
    const aggression = (formData.get("aggression") || "medium").toString();
    const tightness = (formData.get("tightness") || "medium").toString();
    const brightness = (formData.get("brightness") || "neutral").toString();

    // 2) If there's NO file, fall back to a normal text-only coaching answer
    if (!blob || typeof blob === "string") {
      if (!question) {
        return NextResponse.json(
          {
            reply:
              "I didn't get a mix or a question. Try something like: \"How do I tighten my drum bus for modern metalcore?\"",
          },
          { status: 400 }
        );
      }

      const coachingPrompt = `
You are Dirt Halo Studio Assistant, a blunt but helpful mix engineer for heavy music.

Context:
- Mode: ${mode}
- Preset: ${preset}
- Aggression: ${aggression}
- Tightness: ${tightness}
- Brightness: ${brightness}

User question (no audio attached, give general advice only):
"${question}"

Give focused, practical mix advice with numbered steps and, where useful, ballpark EQ ranges and compressor settings.
`;

      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: coachingPrompt,
          },
        ],
      });

      return NextResponse.json(
        { reply: response.output_text ?? "" },
        { status: 200 }
      );
    }

    // 3) (Optional) guard against huge files (e.g. full albums)
    if (typeof blob.size === "number" && blob.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        {
          reply:
            "That file is pretty large. For now, upload a shorter section (around 60–90 seconds as WAV/MP3) and I'll critique that.",
        },
        { status: 400 }
      );
    }

    // 4) Convert the uploaded Blob into a File that OpenAI understands
    const filename =
      typeof blob.name === "string" && blob.name.length > 0
        ? blob.name
        : "mix.wav";

    const openaiFile = await toFile(blob, filename);

    // 5) Try to transcribe the audio – but don't die if it fails
    let transcriptText = "";
    try {
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1", // safe, general transcription model
        file: openaiFile,
      });
      transcriptText = transcription.text || "";
    } catch (err) {
      console.error("Transcription error (continuing anyway):", err);
      transcriptText = "";
    }

    const trimmedTranscript =
      transcriptText.length > 4000
        ? transcriptText.slice(0, 4000)
        : transcriptText || "(no reliable transcription)";

    // 6) Build the mix-analysis prompt
    const analysisPrompt = `
You are Dirt Halo Studio Assistant, a brutal but helpful metal/rock mix engineer.

Mix context:
- Mode: ${mode}
- Preset: ${preset}
- Aggression: ${aggression}
- Tightness: ${tightness}
- Brightness: ${brightness}

User's question about the uploaded mix:
"${
  question ||
  "(user didn't ask a specific question; give a general critique of this mix)"
}"

Transcription of the uploaded mix audio (may be imperfect, just use as loose context, do NOT focus on the lyrics themselves):
${trimmedTranscript}

Give a detailed, practical answer in this structure:

1. Quick verdict (1–2 sentences) about how the mix feels overall.
2. Frequency balance:
   - Sub (20–40 Hz)
   - Low end (40–120 Hz)
   - Low-mids (120–400 Hz)
   - High-mids (1–5 kHz)
   - Air (8–16 kHz)
   For each, say what feels right or wrong, and which instruments are affected.
3. Dynamics / punch & glue:
   - Comments on compression / limiting
   - Transients on drums, vocals, and master bus
4. Space & width:
   - Reverb, delay, stereo image, depth
5. Concrete action list – 5–10 bullet points of specific moves, for example:
   - "Cut 2–3 dB at 250 Hz on the master bus with a medium-Q bell"
   - "Boost 1–2 dB at 8–10 kHz on the vocals for air"
   - "Use a slower attack and faster release on the drum bus compressor"
   - "Tighten the low end by high-passing guitars around 80–100 Hz"

Write like you're coaching someone in a home studio using common plugins (FabFilter, JST, Waves, Slate, etc.). Be direct but encouraging, and talk in clear, simple language.
`;

    // 7) Ask the reasoning model for detailed advice
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
    });

    const replyText = response.output_text ?? "";

    return NextResponse.json({ reply: replyText }, { status: 200 });
  } catch (err) {
    console.error("analyze-mix error", err);
    return NextResponse.json(
      {
        reply:
          "There was an error analyzing your mix. Make sure the file is a WAV/MP3 and try again.",
      },
      { status: 500 }
    );
  }
}