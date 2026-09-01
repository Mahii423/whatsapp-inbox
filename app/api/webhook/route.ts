import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("WEBHOOK BODY:", JSON.stringify(body).slice(0,1000));
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const phoneId = change.value?.metadata?.phone_number_id;
      let wsId: any = null;
      let waAccId: any = null;
      if (phoneId) {
        const { data: acc } = await supabase.from("whatsapp_accounts").select("id,workspace_id").eq("phone_number_id", phoneId).maybeSingle();
        wsId = acc?.workspace_id;
        waAccId = acc?.id;
      }
      // fallback workspace
      if (!wsId) {
        const { data: ws } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
        wsId = ws?.id;
      }

      for (const msg of change.value?.messages || []) {
        const from = msg.from;
        const type = msg.type;
        const profileName = change.value?.contacts?.[0]?.profile?.name || from;

        let { data: contact } = await supabase.from("contacts").select("*").eq("phone", from).maybeSingle();
        if (!contact) {
          const { data: newC } = await supabase.from("contacts").insert({ phone: from, name: profileName, workspace_id: wsId }).select().single();
          contact = newC;
          console.log("NEW CONTACT", contact?.id);
        }

        let { data: conv } = await supabase.from("conversations").select("*").eq("contact_id", contact.id).order("created_at", {ascending:false}).limit(1).maybeSingle();
        if (!conv) {
          const { data: newConv } = await supabase.from("conversations").insert({ contact_id: contact.id, workspace_id: wsId, whatsapp_account_id: waAccId, last_message_at: new Date().toISOString(), unread_count: 0 }).select().single();
          conv = newConv;
          console.log("NEW CONV", conv?.id);
        }

        let content = msg.text?.body || "";
        let media_url: string | null = null;
        let mType = "text";

        if (type === "audio" || msg.audio) {
          content = "🎤 Voice message";
          mType = "audio";
          try {
            const mediaId = msg.audio?.id || msg.voice?.id;
            console.log("AUDIO ID", mediaId);
            if (mediaId && token) {
              const infoRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
              const info = await infoRes.json();
              console.log("MEDIA INFO", info);
              if (info.url) {
                const audRes = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
                const buf = await audRes.arrayBuffer();
                const fileName = `incoming/${conv.id}/${Date.now()}.ogg`;
                const { error: upErr } = await supabase.storage.from("voice-notes").upload(fileName, new Blob([buf], {type:"audio/ogg"}), {contentType:"audio/ogg", upsert:true});
                console.log("UPLOAD ERR", upErr);
                media_url = supabase.storage.from("voice-notes").getPublicUrl(fileName).data.publicUrl;
                console.log("PUBLIC URL", media_url);
              }
            }
          } catch(e){ console.log("AUDIO ERR", e); }
        } else if (type === "voice") {
          // some accounts send type voice
          content = "🎤 Voice message";
          mType = "audio";
          try {
            const mediaId = (msg as any).voice?.id;
            if (mediaId && token) {
              const infoRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
              const info = await infoRes.json();
              if (info.url) {
                const audRes = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
                const buf = await audRes.arrayBuffer();
                const fileName = `incoming/${conv.id}/${Date.now()}.ogg`;
                await supabase.storage.from("voice-notes").upload(fileName, new Blob([buf], {type:"audio/ogg"}), {contentType:"audio/ogg", upsert:true});
                media_url = supabase.storage.from("voice-notes").getPublicUrl(fileName).data.publicUrl;
              }
            }
          } catch(e){ console.log(e); }
        }

        const { error: msgErr } = await supabase.from("messages").insert({
          conversation_id: conv.id,
          sender_type: "contact",
          content,
          media_url,
          audio_url: media_url,
          message_type: mType,
          status: "received"
        });
        console.log("MSG INSERT ERR", msgErr, "URL", media_url);

        await supabase.from("conversations").update({ last_message_text: content, last_message_at: new Date().toISOString(), unread_count: (conv.unread_count||0)+1 }).eq("id", conv.id);
      }
    }
  }
  return NextResponse.json({ok:true});
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const t = req.nextUrl.searchParams.get("hub.verify_token");
  const c = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && t === process.env.WHATSAPP_VERIFY_TOKEN) return new NextResponse(c);
  return new NextResponse("forbidden", {status:403});
}