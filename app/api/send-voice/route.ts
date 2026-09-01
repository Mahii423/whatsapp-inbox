import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const form = await req.formData();
    const file = form.get("file") as File;
    const conversationId = form.get("conversationId") as string;

    if (!file ||!conversationId) {
      return NextResponse.json({ error: "missing file or conversationId" }, { status: 400 });
    }

    const fileName = `outgoing/${conversationId}/${Date.now()}.webm`;
    const blob = new Blob([await file.arrayBuffer()], { type: "audio/webm" });

    const { error: upErr } = await supabase.storage.from("voice-notes").upload(fileName, blob, {
      contentType: "audio/webm",
      upsert: true
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from("voice-notes").getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    const { data: conv } = await supabase.from("conversations").select("contact_id").eq("id", conversationId).single();
    const { data: contact } = await supabase.from("contacts").select("phone").eq("id", conv?.contact_id).single();

    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (token && phoneId && contact?.phone) {
      const waRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "audio",
          audio: { link: publicUrl }
        })
      });
      const waJson = await waRes.json();
      console.log("wa send voice res", waJson);
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "agent",
      content: "🎤 Voice",
      media_url: publicUrl,
      audio_url: publicUrl,
      message_type: "audio",
    });

    await supabase.from("conversations").update({
      last_message_text: "🎤 Voice",
      last_message_at: new Date().toISOString()
    }).eq("id", conversationId);

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    console.log("send-voice error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}