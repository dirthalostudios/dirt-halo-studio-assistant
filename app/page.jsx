"use client";

import { useState, useRef, useEffect } from "react";
import { loadProjects, upsertProject, deleteProject } from "./lib/projectsDB";
const MODES = [
  { id: "vocals", label: "Vocals" },
  { id: "guitars", label: "Guitars" },
  { id: "drums", label: "Drums" },
  { id: "bass", label: "Bass" },
  { id: "keys", label: "Keys/Synths" },
  { id: "mastering", label: "Mastering" },
];

const PRESETS_BY_MODE = {
  vocals: [
    { id: "modern-metalcore", label: "Modern Metalcore" },
    { id: "deathcore", label: "Deathcore" },
    { id: "pop-punk", label: "Pop Punk" },
    { id: "lofi-vocals", label: "Lofi Vocals" },
  ],
  guitars: [
    { id: "djent-prog", label: "Djent / Prog" },
    { id: "thrash", label: "Thrash" },
    { id: "radio-rock", label: "Radio Rock" },
  ],
  drums: [
    { id: "tight-punchy", label: "Tight & Punchy" },
    { id: "big-room", label: "Big Room" },
    { id: "blast-beats", label: "Blast Beats" },
  ],
  bass: [
    { id: "edm-bass", label: "EDM Bass" },
    { id: "sub-heavy", label: "Sub Heavy" },
    { id: "grit-parallel", label: "Grit + Parallel" },
  ],
  keys: [
    { id: "ambient-synth", label: "Ambient / Synthwave" },
    { id: "hyperpop", label: "Hyperpop" },
    { id: "cinematic", label: "Cinematic" },
  ],
  mastering: [
    { id: "streaming-loud", label: "Streaming Loud" },
    { id: "dynamic", label: "Dynamic" },
    { id: "club", label: "Club / DJ" },
  ],
};

export default function Home() {
  // =========================
  // STATE
  // =========================
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [mode, setMode] = useState("vocals");
  const [presetId, setPresetId] = useState("modern-metalcore");

  const [tone, setTone] = useState({
    aggression: "medium",
    tightness: "medium",
    brightness: "neutral",
  });

  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);

  // IMPORTANT: referenced by cardStyle + onMouseEnter/onMouseLeave
  const [isHovered, setIsHovered] = useState(false);

  // Mix attach
  const [mixFile, setMixFile] = useState(null);
  const [mixFileName, setMixFileName] = useState("");

  // Projects
  const [projects, setProjects] = useState([]);
const [activeProjectId, setActiveProjectId] = useState("");
const deleteActiveProject = () => {
  if (!activeProjectId) return;

  const project = projects.find(p => p.id === activeProjectId);
  if (!project) return;

  const confirmed = window.confirm(
    `Delete project "${project.name}"?\nThis cannot be undone.`
  );

  if (!confirmed) return;

  setProjects(prev => prev.filter(p => p.id !== activeProjectId));
  setActiveProjectId("");
};
const [projectName, setProjectName] = useState("");
  // =========================
  // REFS
  // =========================
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
const thinkingRef = useRef(null);
  // =========================
 // ===== DERIVED LABELS =====
const MODE_LABELS = {
  vocals: "Vocals",
  guitars: "Guitars",
  drums: "Drums",
  bass: "Bass",
  "keys/synths": "Keys/Synths",
  mastering: "Mastering",
};

const currentModeLabel = MODE_LABELS[mode] ?? mode;

// presets list for the active mode
const currentPresets = PRESETS_BY_MODE?.[mode] ?? [];
const selectedPreset = currentPresets.find((p) => p.id === presetId);
const currentPresetLabel = selectedPreset?.label ?? presetId;
  // =========================
  // HELPERS
  // =========================
  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    });
  };
useEffect(() => {
  if (isThinking) {
    requestAnimationFrame(() => {
      thinkingRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }
}, [isThinking]);
  // =========================
  // EFFECTS (TOP LEVEL ONLY)
  // =========================
 // ==============================
// PROJECT LOADING (SINGLE SOURCE)
// ==============================

// IMPORTANT: make sure you have this import at the top of page.jsx
// import { loadProjects, upsertProject, deleteProject } from "./lib/projectsDB";

async function refreshProjects() {
  try {
    const list = await loadProjects();
    setProjects(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error("refreshProjects failed:", e?.message || e);
    setProjects([]);
  }
}

useEffect(() => {
  refreshProjects();
}, []);

useEffect(() => {
  if (!activeProjectId) return;

  const project = projects.find((p) => String(p.id) === String(activeProjectId));
  if (!project) return;

  // ✅ Load name
  setProjectName(project.name || "");

  // ✅ Load chat messages safely
  setMessages(Array.isArray(project.messages) ? project.messages : (project.messages ? project.messages : []));

  // ✅ Load UI settings
  if (project.mode) setMode(project.mode);
  if (project.presetId) setPresetId(project.presetId);

  // ✅ Tone is stored as TEXT (often JSON string). Handle both string + object.
  if (project.tone) {
    try {
      const parsed = typeof project.tone === "string" ? JSON.parse(project.tone) : project.tone;
      if (parsed && typeof parsed === "object") setTone(parsed);
    } catch (e) {
      console.warn("Bad tone JSON in DB:", project.tone);
    }
  }

  // ✅ Set mix filename label if present (file itself cannot be restored)
  if (project.mixFileName != null) setMixFileName(project.mixFileName);
}, [activeProjectId, projects]);
  // Drive the “Thinking…” animation
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % 3);
    }, 180);
    return () => clearInterval(interval);
  }, [isThinking]);

  // =========================
  // HANDLERS
  // =========================
  const handleProjectChange = (e) => {
  const id = e.target.value; // "" or "projectId"
  setActiveProjectId(id);

  // "Current session (unsaved)"
  if (id === "") return;

  const project = projects.find((p) => String(p.id) === String(id));
  if (!project) return;

  // ✅ support BOTH: project.snapshot.messages OR project.messages
  const s = project.snapshot ?? project;

  setMessages(Array.isArray(s.messages) ? s.messages : []);

  if (s.mode) setMode(s.mode);
  if (s.presetId) setPresetId(s.presetId);
  if (s.tone) setTone(s.tone);

  if (s.mixFileName !== undefined) setMixFileName(s.mixFileName);
};
 function handleNewSession() {
  setMessages([]);
  setInput("");
  setMixFile(null);
  setMixFileName("");
  setActiveProjectId("");
  setProjectName("");

  // set your defaults (use whatever your app expects)
  setMode("vocals");
  setPresetId("modern-metalcore");
  setTone({
    aggression: "medium",
    tightness: "medium",
    brightness: "neutral",
  });
}
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setMixFile(null);
      setMixFileName("");
      return;
    }
    setMixFile(file);
    setMixFileName(file.name);
  }

  function handleAttachClick() {
    if (fileInputRef.current) fileInputRef.current.click();
  }
async function handleDeleteActiveProject() {
  if (!activeProjectId) return;

  const project = projects.find((p) => String(p.id) === String(activeProjectId));
  if (!project) return;

  const confirmed = window.confirm(
    `Delete project "${project.name}"?\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  try {
  await deleteProject(activeProjectId);
} catch (err) {
  console.error("Delete error:", err);
  alert("Failed to delete project");
  return;
}

  setActiveProjectId("");
  setMessages([]);
  // (optional) reset anything else you want here

  const fresh = await loadProjects();
  setProjects(Array.isArray(fresh) ? fresh : []);
}
  async function handleSaveProject() {
  try {
    const id = activeProjectId || crypto.randomUUID();

    const cleanName =
      (projectName || mixFileName || "Untitled Project").trim();

    const project = {
      id,
      name: cleanName,
      messages,               // ✅ saves chat
      mode,
      presetId,               // ✅ camelCase in code
      tone: JSON.stringify(tone), // ✅ store as text JSON
      brightness: tone?.brightness ?? null,
      aggression: tone?.aggression ?? null,
      tightness: tone?.tightness ?? null,
      mixFileName: mixFileName || null,
    };

    await upsertProject(project);

    // Refresh list + keep selection
    await refreshProjects();
    setActiveProjectId(id);
    setProjectName(cleanName);
  } catch (err) {
    console.error("Save error:", err);
    alert("Failed to save project");
  }
}
  async function handleSend() {
    if (!input.trim() && !mixFile) return;
    if (isSending) return;

    // If a project was loaded, mixFile will be null (only filename exists)
    if (mixFileName && !mixFile) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This project remembers the filename, but not the actual audio file. Please re-attach the WAV/MP3 to analyze.",
        },
      ]);
      return;
    }

    const userContent = mixFile
      ? `Mode: ${currentModeLabel}, Preset: ${currentPresetLabel}, Aggression: ${tone.aggression}, Tightness: ${tone.tightness}, Brightness: ${tone.brightness}\n\n${input || "(no question provided)"}`
      : input;

    const userMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsSending(true);
    setIsThinking(true);
    scrollToBottom(true);

    try {
      let replyText = "";

      if (mixFile) {
        // MIX ANALYZER MODE
        const formData = new FormData();
        formData.append("file", mixFile);
        formData.append("question", input || "");
        formData.append("mode", currentModeLabel);
        formData.append("preset", currentPresetLabel);
        formData.append("aggression", tone.aggression);
        formData.append("tightness", tone.tightness);
        formData.append("brightness", tone.brightness);

        const res = await fetch("/api/analyze-mix", { method: "POST", body: formData });

        if (!res.ok) {
          console.error("Analyze mix error:", await res.text());
          replyText =
            "There was an error analyzing your mix. Make sure the file is a WAV/MP3 and try again.";
        } else {
          const data = await res.json();
          replyText = data.reply || "";
        }
      } else {
        // REGULAR CHAT
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            mode,
            preset: currentPresetLabel,
            tone,
          }),
        });

        if (!res.ok) {
          console.error("Chat error:", await res.text());
          replyText = "There was an error talking to the AI backend. Try again in a second.";
        } else {
          const data = await res.json();
          replyText = data.reply || "No response from model.";
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "There was a server error. Check your internet connection and that the app is still running.",
        },
      ]);
      scrollToBottom(true);
    } finally {
      setIsSending(false);
      setIsThinking(false);
    }
  }
  // ================= STYLES =====================
const chatScrollStyle = { maxHeight: 320, overflowY: "auto", paddingRight: 8, marginBottom: 12 };
  const rootStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    backgroundImage:
      "radial-gradient(circle at 0% 0%, rgba(255,47,208,0.25), transparent 55%)," +
      "radial-gradient(circle at 100% 100%, rgba(80,200,255,0.20), transparent 55%)," +
      "linear-gradient(120deg, #050016, #15002b, #28004d, #15002b, #050016)",
    backgroundSize: "200% 200%",
    animation: "dh-synthwave-pan 26s ease-in-out infinite",
  };
const newSessionButtonStyle = {
  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
  border: "none",
  borderRadius: "10px",
  padding: "10px 18px",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(236,72,153,0.45)",
};
  const cardStyle = {
    width: "1000px",
    maxWidth: "100%",
    borderRadius: 24,
    padding: 24,
    background:
      "radial-gradient(circle at top left, rgba(255,47,208,0.3), transparent 55%)," +
      "radial-gradient(circle at bottom right, rgba(80,200,255,0.35), transparent 55%)," +
      "rgba(5,0,20,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow:
      "0 0 40px rgba(255,47,208,0.5), 0 0 90px rgba(80,200,255,0.40), 0 0 160px rgba(255,47,208,0.25)",
    position: "relative",
    overflow: "hidden",
    transform: isHovered ? "translateY(-2px) scale(1.01)" : "none",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};
const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: "0 0 auto"
};
const headerRightStyle = {
  marginLeft: "auto",
  textAlign: "right",
  fontSize: 11,
  opacity: 0.9,
  whiteSpace: "nowrap",
};
  const logoWrapperStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
  };

  const logoCircleStyle = {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 30% 0%, #ffffff, #ff8af2 25%, #ff27de 45%, #7f1fff 80%)",
    boxShadow:
      "0 0 25px rgba(255,47,208,0.9), 0 0 45px rgba(80,200,255,0.8), 0 0 120px rgba(255,47,208,0.61)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0b0015",
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 1,
    animation: "dh-pulse-glow 3.5s ease-in-out infinite",
    overflow: "hidden",
  };

  const logoImageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  };

  const titleBlockStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  textAlign: "left",
};
  const titleStyle = {
    fontSize: 20,
    fontWeight: 700,
  };

  const subtitleStyle = {
    fontSize: 12,
    opacity: 0.85,
  };

  const modeRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 18,
    flexWrap: "wrap",
  };

  const labelStyle = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
  };
const presetsRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 16,
};
  const modeButtonsRowStyle = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };

  const modeButtonStyle = (active) => ({
    padding: "6px 16px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(255,255,255,0.95)"
      : "1px solid rgba(255,255,255,0.25)",
    background: active
      ? "linear-gradient(120deg, #ff4be9, #b96bff)"
      : "rgba(8,0,32,0.8)",
    color: active ? "#0a0014" : "#f9e9ff",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  });

  const presetRowStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  };

  const presetChipStyle = (active) => ({
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 11,
    border: active
      ? "1px solid rgba(255,255,255,0.9)"
      : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(255,75,233,0.22)" : "rgba(10,0,35,0.85)",
    color: "#f9e9ff",
    cursor: "pointer",
  });

  const toneGroupStyle = {
    marginBottom: 10,
  };

  const toneButtonsRowStyle = {
    display: "flex",
    gap: 8,
  };

  const toneButtonStyle = (active) => ({
    padding: "4px 10px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(255,255,255,0.9)"
      : "1px solid rgba(255,255,255,0.25)",
    background: active ? "rgba(120,200,255,0.25)" : "rgba(8,0,40,0.8)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    cursor: "pointer",
  });

  const assistantHeaderStyle = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
    marginBottom: 6,
  };

  const chatBoxStyle = {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: 14,
    minHeight: 220,
    maxHeight: 260,
    overflowY: "auto",
    background: "rgba(5,0,20,0.92)",
    boxShadow: "inset 0 0 18px rgba(0,0,0,0.65)",
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };

    const messageStyle = (role) => ({
    marginBottom: 8,
    padding: "8px 10px",
    borderRadius: 8,
    maxWidth: "100%",
    fontSize: 13,
    whiteSpace: "pre-wrap",
    background:
      role === "user"
        ? "linear-gradient(135deg, rgba(255,120,220,0.35), rgba(255,120,220,0.08))"
        : "linear-gradient(135deg, rgba(120,220,255,0.22), rgba(80,170,255,0.06))",
    border:
      role === "user"
        ? "1px solid rgba(255,140,240,0.75)"
        : "1px solid rgba(160,210,255,0.55)",
    color: "#fef7ff",
    boxShadow:
      role === "user"
        ? "0 0 10px rgba(255,100,230,0.35)"
        : "0 0 10px rgba(120,200,255,0.25)",
  });

const thinkingTextStyle = {
  opacity: 0.8,
};
  const inputRowStyle = {
    display: "flex",
    gap: 8,
    marginTop: 6,
    alignItems: "center",
  };
{isThinking && (
  <div className="thinking-indicator">
    <div className="thinking-bar bar1" />
    <div className="thinking-bar bar2" />
    <div className="thinking-bar bar3" />
    <span style={{ marginLeft: 8 }}>Thinking…</span>
  </div>
)}
  const inputStyle = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(6,0,25,0.95)",
    color: "white",
    fontSize: 13,
    outline: "none",
  };

  const sendButtonStyle = {
    fontWeight: 600,
    fontSize: 13,
    cursor: isSending ? "default" : "pointer",
    padding: "9px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.85)",
    background: isSending
      ? "rgba(150,150,150,0.35)"
      : "linear-gradient(120deg, #ff4be9, #b96bff)",
    color: "#0b0015",
    whiteSpace: "nowrap",
  };

  const attachRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  };

  const attachButtonStyle = {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px dashed rgba(255,255,255,0.4)",
    background: "rgba(8,0,35,0.8)",
    fontSize: 11,
    cursor: "pointer",
  };

  const fileNameStyle = {
    fontSize: 11,
    opacity: 0.8,
  };

  const footerHintStyle = {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.65,
  };
    const thinkingStyle = {
    marginTop: 4,
    fontSize: 11,
    opacity: 0.75,
    fontStyle: "italic",
  };
    const projectBarStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  };

  const projectSelectStyle = {
    marginLeft: 8,
    background: "rgba(0,0,0,0.45)",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#ffffff",
    fontSize: 11,
    padding: "4px 8px",
    outline: "none",
  };
// Row for the "Change Mix" + "Remove Mix" + filename
const attachedRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 12,
};

// Small purple button
const smallButtonStyle = {
  padding: "6px 12px",
  fontSize: 11,
  borderRadius: 8,
  background: "rgba(140,0,255,0.4)",
  border: "1px solid rgba(255,255,255,0.35)",
  cursor: "pointer",
  transition: "0.2s",
};

// Clear/remove button (pink)
const smallClearButtonStyle = {
  padding: "6px 12px",
  fontSize: 11,
  borderRadius: 8,
  background: "rgba(255,50,150,0.35)",
  border: "1px solid rgba(255,255,255,0.3)",
  cursor: "pointer",
  transition: "0.2s",
};
  return (
  <main style={rootStyle}>
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* HEADER */}
      <header style={headerStyle}>
  <div style={headerLeftStyle}>
    <div style={logoWrapperStyle}>
      <div style={logoCircleStyle}>
        <img
          src="/dirt-halo-logo.png"
          alt="Dirt Halo Logo"
          style={logoImageStyle}
        />
      </div>
    </div>

    <div style={titleBlockStyle}>
      <div style={titleStyle}>Dirt Halo Studio Assistant</div>
      <div style={subtitleStyle}>
        Neon-powered mix engineer for screams, riffs, and heavy records.
      </div>
    </div>
  </div>

  <div style={headerRightStyle}>
    <div>Mode: {currentModeLabel}</div>
    <div style={{ opacity: 0.8 }}>Preset: {currentPresetLabel}</div>
  </div>
</header>

        {/* MODE SELECTOR */}
        <div style={modeRowStyle}>
          <span style={labelStyle}>Mode:</span>
          <div style={modeButtonsRowStyle}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                style={modeButtonStyle(mode === m.id)}
                onClick={() => {
                  setMode(m.id);
                  const firstPreset = PRESETS_BY_MODE[m.id][0];
                  if (firstPreset) setPresetId(firstPreset.id);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* PRESETS */}
        {currentPresets.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Preset:</div>
            <div style={presetsRowStyle}>
              {currentPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  style={presetChipStyle(presetId === p.id)}
                  onClick={() => setPresetId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TONE CONTROLS */}
        <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
          <div style={toneGroupStyle}>
            <span style={labelStyle}>Aggression:</span>
            <div style={toneButtonsRowStyle}>
              {["low", "medium", "high"].map((level) => (
                <button
                  key={level}
                  type="button"
                  style={toneButtonStyle(tone.aggression === level)}
                  onClick={() =>
                    setTone((prev) => ({ ...prev, aggression: level }))
                  }
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={toneGroupStyle}>
            <span style={labelStyle}>Tightness:</span>
            <div style={toneButtonsRowStyle}>
              {["loose", "medium", "ultra-tight"].map((level) => (
                <button
                  key={level}
                  type="button"
                  style={toneButtonStyle(tone.tightness === level)}
                  onClick={() =>
                    setTone((prev) => ({ ...prev, tightness: level }))
                  }
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={toneGroupStyle}>
            <span style={labelStyle}>Brightness:</span>
            <div style={toneButtonsRowStyle}>
              {["dark", "neutral", "bright"].map((level) => (
                <button
                  key={level}
                  type="button"
                  style={toneButtonStyle(tone.brightness === level)}
                  onClick={() =>
                    setTone((prev) => ({ ...prev, brightness: level }))
                  }
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

         {/* ASSISTANT CHAT */}
      {/* SESSION TOOLS BAR */}
<div style={projectBarStyle}>
  <span style={{ opacity: 0.85, fontSize: 11, marginRight: 8 }}>
    Session tools:
  </span>

  <button
  style={newSessionButtonStyle}
  onClick={handleNewSession}
>
  New Session
</button>

  <button onClick={handleSaveProject}>
  {activeProjectId ? "Save Changes" : "Save as Project"}
</button>
  <input
  type="text"
  value={projectName}
  onChange={(e) => setProjectName(e.target.value)}
  placeholder="Project name…"
  style={{
    width: 220,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  }}
/>

<select
  value={activeProjectId}
  onChange={(e) => setActiveProjectId(e.target.value)}
>
  <option value="">Current session (unsaved)</option>

  {(projects ?? []).map((p) => (
    <option key={p.id} value={String(p.id)}>
      {p.name}
    </option>
  ))}
</select>
 {(projects ?? []).map((p) => (
  <option key={p.id} value={p.id}>{p.name}</option>
))}
{activeProjectId && (
  <button onClick={handleDeleteActiveProject}>Delete Project</button>
)}
</div>
{/* CHAT BOX */}
<div style={chatBoxStyle}>

  {/* Empty-state hint */}
  {messages.length === 0 && (
    <div style={{ opacity: 0.85, fontSize: 13 }}>
      Ask me how to clean up muddy screams, tighten djent guitars,
      glue a drum bus, dial in sub bass, or push a metalcore master
      without destroying punch. You can also upload a mix file below
      and ask for specific critique.
    </div>
  )}

  {/* Chat history */}
  <div style={chatScrollStyle}>
    {messages.map((m, idx) => (
      <div key={idx} style={messageStyle(m.role)}>
        <strong style={{ opacity: 0.85 }}>
          {m.role === "user" ? "You" : "Assistant"}:
        </strong>{" "}
        {m.content}
      </div>
    ))}

    {isThinking && (
      <div className="thinking-row" ref={thinkingRef}>
        <span className="thinking-label">Thinking…</span>
        <div className="thinking-bars">
          <div className="thinking-bar" />
          <div className="thinking-bar" />
          <div className="thinking-bar" />
        </div>
      </div>
    )}

    <div ref={chatEndRef} />
  </div>

</div>
      {/* INPUT + SEND */}
      <div style={inputRowStyle}>
        <input
          style={inputStyle}
          placeholder={
            mixFile
              ? 'Ask about this uploaded mix (e.g. "Why is my snare buried?")'
              : "Ask about vocals, drums, guitars, bass, keys, or mastering..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          style={sendButtonStyle}
        >
          {isSending
            ? mixFile
              ? "Analyzing..."
              : "Summoning..."
            : mixFile
            ? "Analyze Mix"
            : "Send"}
        </button>
      </div>

      {/* ATTACH / REMOVE MIX ROW */}
<div style={attachRowStyle}>
  {/* hidden file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept="audio/wav,audio/mp3,audio/mpeg,audio/aac"
    style={{ display: "none" }}
   onChange={(e) => {
  const file = e.target.files?.[0] || null;
  setMixFile(file);
  setMixFileName(file ? file.name : "");
}}
  />

  {/* main attach / change button */}
  <button
    type="button"
    style={attachButtonStyle}
    onClick={() => fileInputRef.current?.click()}
  >
    {mixFile ? "Change Attached Mix" : "Attach Mix (WAV/MP3)"}
  </button>

  {/* show filename + remove button when a mix is attached */}
  {mixFile && (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button
        type="button"
        style={smallClearButtonStyle}
        onClick={() => {
  setMixFile(null);
  setMixFileName("");
  if (fileInputRef.current) fileInputRef.current.value = "";
}}
      >
        Remove Mix
      </button>

      <span style={fileNameStyle}>Attached: {mixFile?.name || mixFileName || "(none)"}</span>
    </div>
  )}
</div>

      {/* FOOTER TIP */}
      <div style={footerHintStyle}>
        Tip: attach a mix, then ask something like "what's wrong with my low end
        in the chorus?" for very targeted advice.
      </div>
    </div>
  </main>
);
}