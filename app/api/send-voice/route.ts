import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/client";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const conversationId = form.get("conversationId") as string;

    if (!file ||!conversationId) return NextResponse.json({ error: "missing" }, { status: 400 });

    const supabase = createClient() as any;
    const { data: conv } = await supabase.from("conversations").select("*, contacts(*)").eq("id", conversationId).single();
    const phone = conv?.contacts?.phone;
    if (!phone) return NextResponse.json({ error: "no phone" }, { status: 400 });

    // 1. Upload to WhatsApp Cloud
    const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;

    // WhatsApp ko audio bhejo
    const waForm = new FormData();
    waForm.append("file", file);
    waForm.append("type", "audio/ogg");
    waForm.append("messaging_product", "whatsapp");

    const uploadRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: waForm,
    });
    const uploadData = await uploadRes.json();
    const mediaId = uploadData.id;

    if (!mediaId) {
      console.log("upload fail", uploadData);
      return NextResponse.json({ error: "upload fail", details: uploadData }, { status: 500 });
    }

    // 2. Send voice message
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "audio",
        audio: { id: mediaId }
      }),
    });

    // 3. Supabase me save karo
    const arrayBuffer = await file.arrayBuffer();
    const fileName = `voice/${conversationId}/${Date.now()}.ogg`;
    await supabase.storage.from("voice-notes").upload(fileName, arrayBuffer, { contentType: "audio/ogg", upsert: true });
    const { data: urlData } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "agent",
      content: "🎤 Voice message",
      media_url: urlData.publicUrl,
      message_type: "audio",
    });

    await supabase.from("conversations").update({ last_message_text: "🎤 Voice message", last_message_at: new Date().toISOString() }).eq("id", conversationId);

    return NextResponse.json({ ok: true, url: urlData.publicUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}