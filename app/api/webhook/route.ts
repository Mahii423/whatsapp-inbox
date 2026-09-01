import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createClient() as any;
  const token = process.env.WHATSAPP_TOKEN;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change.value?.messages || [];
      const contacts = change.value?.contacts || [];

      for (const msg of messages) {
        const from = msg.from;
        const type = msg.type;

        // Contact find or create
        let { data: contact } = await supabase.from("contacts").select("*").eq("phone", from).single();
        if (!contact) {
          const { data: newContact } = await supabase.from("contacts").insert({ phone: from, name: contacts[0]?.profile?.name || from, source: "whatsapp" }).select().single();
          contact = newContact;
        }

        let { data: conv } = await supabase.from("conversations").select("*").eq("contact_id", contact.id).single();
        if (!conv) {
          const { data: newConv } = await supabase.from("conversations").insert({ contact_id: contact.id, last_message_at: new Date().toISOString() }).select().single();
          conv = newConv;
        }

        let content = "";
        let media_url = null;
        let message_type = type;

        if (type === "text") content = msg.text?.body || "";
        if (type === "audio" || type === "voice") {
          content = "🎤 Voice message";
          try {
            // WhatsApp se media URL lo
            const mediaId = msg.audio?.id || msg.voice?.id;
            const mediaInfoRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
            const mediaInfo = await mediaInfoRes.json();
            const waUrl = mediaInfo.url;
            if (waUrl) {
              const audioRes = await fetch(waUrl, { headers: { Authorization: `Bearer ${token}` } });
              const buffer = await audioRes.arrayBuffer();
              const fileName = `voice/incoming/${conv.id}/${Date.now()}.ogg`;
              await supabase.storage.from("voice-notes").upload(fileName, buffer, { contentType: "audio/ogg", upsert: true });
              const { data } = supabase.storage.from("voice-notes").getPublicUrl(fileName);
              media_url = data.publicUrl;
            }
          } catch (e) { console.log("voice download err", e); }
        }

        await supabase.from("messages").insert({
          conversation_id: conv.id,
          sender_type: "contact",
          content,
          media_url,
          message_type,
          created_at: new Date().toISOString()
        });

        await supabase.from("conversations").update({
          last_message_text: type === "audio"? "🎤 Voice" : content,
          last_message_at: new Date().toISOString(),
          unread_count: (conv.unread_count || 0) + 1
        }).eq("id", conv.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) return new NextResponse(challenge);
  return new NextResponse("forbidden", { status: 403 });
}
