import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const form = await req.formData();
    const file = form.get("file") as File;
    const conversationId = form.get("conversationId") as string;

    const fileName = `voice-${Date.now()}.webm`;
    const { error } = await supabase.storage
      .from("voice-notes")
      .upload(fileName, file, { contentType: "audio/webm" });

    if (error) throw error;

    const { data } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      content: "Voice",
      media_url: data.publicUrl,
      audio_url: data.publicUrl,
      message_type: "audio",
      sender_type: "agent",
    });

    return NextResponse.json({ url: data.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}