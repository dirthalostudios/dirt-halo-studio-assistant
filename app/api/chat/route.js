// app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to turn responses.output into plain text
function extractOutputText(response) {
  let text = "";

  try {
    // New Responses API shape: response.output is an array
    const items = response.output || [];
    for (const item of items) {
      if (!item?.content) continue;

      for (const piece of item.content) {
        if (!piece) continue;

        // Main case: normal text from the model
        if (piece.type === "output_text" || piece.type === "text") {
          const value =
            piece.text?.value ?? // SDK often wraps it like { text: { value: "..." } }
            piece.text ??
            "";
          text += value;
        }
      }
    }
  } catch (err) {
    console.error("extractOutputText error:", err);
  }

  return text.trim();
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Defaults if frontend forgets to send them
    const {
      messages = [],
      mode = "Vocals",
      preset = "Modern Metalcore",
      tone = {
        aggression: "medium",
        tightness: "medium",
        brightness: "neutral",
      },
    } = body;

    // 1) Flatten conversation into a transcript
    const conversation = messages
      .map((m) => {
        const who = m.role === "user" ? "User" : "Assistant";
        return `${who}: ${m.content}`;
      })
      .join("\n");

    // 2) Extra context we feed the model every time
    const mixContext = `
You are Dirt Halo Studio Assistant, a brutal but helpful metal/metalcore mix engineer.

Mode: ${mode}
Preset: ${preset}
Aggression: ${tone.aggression || "medium"}
Tightness: ${tone.tightness || "medium"}
Brightness: ${tone.brightness || "neutral"}

Give clear, practical, step-by-step advice (frequencies, plugin moves, creative tips).
Keep it studio-friendly and conversational.
`.trim();

    const input = `${mixContext}\n\nConversation:\n${conversation}\n\nAssistant:`;

    // 3) Call the Responses API
    const response = await openai.responses.create({
      model: "gpt-4.1-mini", // or "gpt-4.1" later if you want
      input,
    });

    const replyText =
      extractOutputText(response) ||
      "I couldn't generate a reply for some reason. Try rephrasing your question about the mix.";

    return NextResponse.json({ reply: replyText });
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      {
        reply:
          "There was a server error talking to the AI backend. Try again in a moment.",
      },
      { status: 500 }
    );
  }
}