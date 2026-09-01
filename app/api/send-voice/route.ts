import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const conversationId = form.get("conversationId") as string;

    if (!file || !conversationId) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }

    const fileName = `voice-${Date.now()}.webm`;
    const { error } = await supabase.storage
      .from("voice-notes")
      .upload(fileName, file, { contentType: "audio/webm" });

    if (error) throw error;

    const { data } = supabase.storage.from("voice-notes").getPublicUrl(fileName);
    const url = data.publicUrl;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      content: "🎤 Voice",
      media_url: url,
      audio_url: url,
      message_type: "audio",
      sender_type: "agent",
    });

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}