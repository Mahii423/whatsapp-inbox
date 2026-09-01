import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({error:"Unauthorized"},{status:401});

  const form = await req.formData();
  const file = form.get("file") as File;
  const conversationId = form.get("conversationId") as string;
  if(!file||!conversationId) return NextResponse.json({error:"missing"},{status:400});

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: conv } = await admin.from("conversations").select("*, contacts(phone)").eq("id", conversationId).single();
  const { data: account } = await admin.from("whatsapp_accounts").select("*").eq("id", conv.whatsapp_account_id).single();

  const fileName = `outgoing/${conversationId}/${Date.now()}.webm`;
  await admin.storage.from("voice-notes").upload(fileName, new Blob([await file.arrayBuffer()],{type:"audio/webm"}), {contentType:"audio/webm", upsert:true});
  const publicUrl = admin.storage.from("voice-notes").getPublicUrl(fileName).data.publicUrl;

  const token = account?.access_token || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneId = account?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if(token && phoneId && conv.contacts?.phone){
    await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`,{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({messaging_product:"whatsapp",to:conv.contacts.phone.replace(/\D/g,""),type:"audio",audio:{link:publicUrl}})
    });
  }

  await admin.from("messages").insert({conversation_id:conversationId,sender_type:"agent",sender_id:userData.user.id,content:"🎤 Voice",media_url:publicUrl,audio_url:publicUrl,message_type:"audio",status:"sent"});
  await admin.from("conversations").update({last_message_text:"🎤 Voice",last_message_at:new Date().toISOString()}).eq("id",conversationId);

  return NextResponse.json({url:publicUrl});
}