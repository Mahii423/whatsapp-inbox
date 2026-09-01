import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../utils/supabase/client";

export async function POST(req: NextRequest) {
  const supabase = createClient() as any;
  const form = await req.formData();
  const file = form.get("file") as File;
  const conversationId = form.get("conversationId") as string;
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const { data: conv } = await supabase.from("conversations").select("*, contacts(*)").eq("id", conversationId).single();
  const phone = conv?.contacts?.phone;

  // File ko buffer banao
  const buffer = await file.arrayBuffer();
  const fileName = `voice/outgoing/${conversationId}/${Date.now()}.ogg`;
  await supabase.storage.from("voice-notes").upload(fileName, buffer, { contentType: "audio/webm", upsert: true });
  const { data: urlData } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

  // WhatsApp ko bhejo - webm ko ogg ke tor pe bhejte hain, WhatsApp accept kar leta hai
  const waForm = new FormData();
  waForm.append("file", new Blob([buffer], { type: "audio/ogg" }), "voice.ogg");
  waForm.append("type", "audio/ogg");
  waForm.append("messaging_product", "whatsapp");

  const upRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: waForm,
  });
  const upData = await upRes.json();
  console.log("upload", upData);

  if (upData.id) {
    const sendRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "audio",
        audio: { id: upData.id }
      })
    });
    const sendData = await sendRes.json();
    console.log("send voice", sendData);
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "agent",
    content: "🎤 Voice message",
    media_url: urlData.publicUrl,
    message_type: "audio"
  });

  return NextResponse.json({ ok: true, url: urlData.publicUrl });
}