import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  failedStatusError,
  nextDeliveryStatus,
  normalizeWhatsAppStatus,
} from "../../../lib/whatsapp/delivery-status";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function getServiceClient(): SupabaseClient | null {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url ||!key) return null;
  return createClient(url, key);
}

// SaaS FIX: Token har account ka alag hoga
async function fetchWhatsAppProfilePic(customerPhone: string, accessToken: string): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${customerPhone}?fields=profile_picture&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile_picture?.url || null;
  } catch {
    return null;
  }
}

function messageContent(message: any): string {
  const t = message?.type || "text";
  if (t === "text") return message?.text?.body || "";
  if (t === "image") return message?.image?.caption || "[image]";
  if (t === "video") return message?.video?.caption || "[video]";
  if (t === "audio") return "[audio]";
  if (t === "document") return message?.document?.filename || "[document]";
  return `[${t}]`;
}

async function handleStatuses(supabase: SupabaseClient, statuses: any[]) {
  const results: any[] = [];
  for (const item of statuses) {
    const whatsappMessageId = item?.id;
    const incoming = normalizeWhatsAppStatus(item?.status);
    if (!whatsappMessageId ||!incoming) continue;

    const { data: existing } = await supabase.from("messages").select("id, status").eq("whatsapp_message_id", whatsappMessageId).maybeSingle();
    if (!existing) continue;

    const nextStatus = nextDeliveryStatus(existing.status, incoming);
    await supabase.from("messages").update({ status: nextStatus, status_error: nextStatus === "failed"? failedStatusError(item) : null }).eq("id", existing.id);
    results.push({ updated: true, whatsappMessageId, status: nextStatus });
  }
  return results;
}

async function handleIncomingMessage(supabase: SupabaseClient, value: any, message: any) {
  const phoneNumberId = value?.metadata?.phone_number_id;
  const customerPhone = message?.from;
  const whatsappMessageId = message?.id;
  const messageType = message?.type;
  const contact = value.contacts?.[0];
  const customerName = contact?.profile?.name || customerPhone || "WhatsApp Customer";

  if (!phoneNumberId ||!customerPhone ||!whatsappMessageId ||!messageType) {
    return { error: "Missing data" };
  }

  // SaaS FIX: access_token bhi lo taake profile pic fetch ho sake
  const { data: whatsappAccount } = await supabase
   .from("whatsapp_accounts")
   .select("id, workspace_id, phone_number_id, access_token")
   .eq("phone_number_id", phoneNumberId)
   .maybeSingle();

  if (!whatsappAccount) {
    return { error: "WhatsApp account not configured", phone_number_id: phoneNumberId };
  }

  const workspaceId = whatsappAccount.workspace_id;
  const content = messageContent(message);
  const avatarUrl = await fetchWhatsAppProfilePic(customerPhone, whatsappAccount.access_token);

  const { data: existingContact } = await supabase.from("contacts").select("id, name, avatar_url").eq("workspace_id", workspaceId).eq("phone", customerPhone).maybeSingle();
  let contactId: string;

  if (existingContact) {
    contactId = existingContact.id;
    const updates: any = {};
    if (customerName && customerName!== customerPhone && customerName!== existingContact.name) updates.name = customerName;
    if (avatarUrl && avatarUrl!== existingContact.avatar_url) updates.avatar_url = avatarUrl;
    if (Object.keys(updates).length > 0) {
      await supabase.from("contacts").update(updates).eq("id", contactId);
    }
  } else {
    const { data: newContact } = await supabase.from("contacts").insert({ workspace_id: workspaceId, name: customerName, phone: customerPhone, avatar_url: avatarUrl }).select("id").single();
    if (!newContact) return { error: "Contact creation failed" };
    contactId = newContact.id;
  }

  const { data: existingConversation } = await supabase.from("conversations").select("id").eq("workspace_id", workspaceId).eq("contact_id", contactId).eq("whatsapp_account_id", whatsappAccount.id).maybeSingle();
  let conversationId: string;
  const now = new Date().toISOString();

  if (existingConversation) {
    conversationId = existingConversation.id;
    await supabase.from("conversations").update({ status: "open", last_message_at: now }).eq("id", conversationId);
  } else {
    const { data: newConversation } = await supabase.from("conversations").insert({ workspace_id: workspaceId, contact_id: contactId, whatsapp_account_id: whatsappAccount.id, status: "open", last_message_at: now }).select("id").single();
    if (!newConversation) return { error: "Conversation creation failed" };
    conversationId = newConversation.id;
  }

  const { data: existingMessage } = await supabase.from("messages").select("id").eq("whatsapp_message_id", whatsappMessageId).maybeSingle();
  if (existingMessage) return { saved: true, duplicate: true, conversation_id: conversationId };

  const { error: messageInsertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "customer",
    message_type: messageType,
    content,
    whatsapp_message_id: whatsappMessageId,
  });

  if (messageInsertError) return { error: "Message creation failed", details: messageInsertError.message };
  return { saved: true, conversation_id: conversationId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("hub.mode") === "subscribe" && searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
    return new NextResponse(searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Missing SERVICE_ROLE_KEY" }, { status: 500 });

  const body = await request.json();
  const entries = Array.isArray(body?.entry)? body.entry : [];
  const messageResults: any[] = [];
  const statusResults: any[] = [];

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (!value) continue;
      if (value.statuses?.length > 0) statusResults.push(...(await handleStatuses(supabase, value.statuses)));
      if (value.messages?.length > 0) {
        for (const msg of value.messages) {
          messageResults.push(await handleIncomingMessage(supabase, value, msg));
        }
      }
    }
  }
  return NextResponse.json({ received: true, messages: messageResults, statuses: statusResults });
}