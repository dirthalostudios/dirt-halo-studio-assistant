import { supabase } from "./supabaseClient";

// Your DB columns are camelCase: presetId, mixFileName
function safeParseTone(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

export async function loadProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      messages,
      mode,
      presetId,
      tone,
      brightness,
      aggression,
      tightness,
      mixFileName,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((p) => ({
    ...p,
    tone: safeParseTone(p.tone),
  }));
}

export async function upsertProject(project) {
  const payload = {
    id: String(project.id),
    name: project.name ?? null,
    messages: project.messages ?? null,
    mode: project.mode ?? null,

    // IMPORTANT: match DB column names exactly
    presetId: project.presetId ?? null,
    tone: project.tone ? JSON.stringify(project.tone) : null,

    brightness: project.brightness ?? null,
    aggression: project.aggression ?? null,
    tightness: project.tightness ?? null,

    mixFileName: project.mixFileName ?? null,
  };

  const { data, error } = await supabase
    .from("projects")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", String(id));
  if (error) throw error;
  return true;
}