import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  failedStatusError,
  nextDeliveryStatus,
  normalizeWhatsAppStatus,
} from "../../../lib/whatsapp/delivery-status";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

function cleanEnv(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function getServiceClient(): SupabaseClient | null {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url ||!key) return null;
  return createClient(url, key);
}

function messageContent(message: any): string {
  const t = message?.type || "text";
  if (t === "text") return message?.text?.body || "";
  if (t === "image") return message?.image?.caption || "📷 Image";
  if (t === "video") return message?.video?.caption || "🎥 Video";
  if (t === "audio") return "🎤 Voice message";
  if (t === "document") return `📄 ${message?.document?.filename || "Document"}`;
  return `[${t}]`;
}

async function handleStatuses(supabase: SupabaseClient, statuses: any[]) {
  for (const item of statuses) {
    const whatsappMessageId = item?.id;
    const incoming = normalizeWhatsAppStatus(item?.status);
    if (!whatsappMessageId ||!incoming) continue;
    const { data: existing } = await supabase.from("messages").select("id, status").eq("whatsapp_message_id", whatsappMessageId).maybeSingle();
    if (!existing) continue;
    const nextStatus = nextDeliveryStatus((existing as any).status, incoming);
    await supabase.from("messages").update({ status: nextStatus, status_error: nextStatus === "failed"? failedStatusError(item) : null }).eq("id", (existing as any).id);
  }
}

async function handleIncomingMessage(supabase: SupabaseClient, value: any, message: any) {
  const phoneNumberId = value?.metadata?.phone_number_id;
  const customerPhone = message?.from;
  const whatsappMessageId = message?.id;
  const contact = value?.contacts?.[0];
  const customerName = contact?.profile?.name || customerPhone || "WhatsApp Customer";
  if (!phoneNumberId ||!customerPhone ||!whatsappMessageId) return { error: "Missing data" };

  const { data: whatsappAccount } = await supabase.from("whatsapp_accounts").select("id, workspace_id").eq("phone_number_id", phoneNumberId).maybeSingle();
  if (!whatsappAccount) return { error: "Account not configured" };

  const workspaceId = (whatsappAccount as any).workspace_id;
  const { data: workspace } = await supabase.from("workspaces").select("owner_id").eq("id", workspaceId).single();
  const content = messageContent(message);
  const now = new Date().toISOString();

  const { data: existingContact } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("phone", customerPhone).maybeSingle();
  let contactId: string | undefined = (existingContact as any)?.id;

  if (!contactId) {
    const { data: newContact } = await supabase.from("contacts").insert({ user_id: (workspace as any)?.owner_id, workspace_id: workspaceId, name: customerName, phone: customerPhone, status: "new", source: "whatsapp" }).select("id").single();
    contactId = (newContact as any)?.id;
  }

  if (!contactId) return { error: "Contact ID missing" };

  const { data: existingConv } = await supabase.from("conversations").select("id, unread_count").eq("workspace_id", workspaceId).eq("contact_id", contactId).eq("whatsapp_account_id", (whatsappAccount as any).id).maybeSingle();
  let conversationId: string | undefined = (existingConv as any)?.id;

  if (conversationId) {
    const currentUnread = Number((existingConv as any)?.unread_count || 0);
    await supabase.from("conversations").update({ status: "open", last_message: content, last_message_text: content, last_message_at: now, unread_count: currentUnread + 1 }).eq("id", conversationId);
  } else {
    const { data: newConv } = await supabase.from("conversations").insert({ workspace_id: workspaceId, contact_id: contactId, whatsapp_account_id: (whatsappAccount as any).id, status: "open", last_message: content, last_message_text: content, last_message_at: now, unread_count: 1 }).select("id").single();
    conversationId = (newConv as any)?.id;
  }

  if (!conversationId) return { error: "Conversation ID missing" };

  const { data: dup } = await supabase.from("messages").select("id").eq("whatsapp_message_id", whatsappMessageId).maybeSingle();
  if (dup) return { duplicate: true };

  await supabase.from("messages").insert({ conversation_id: conversationId, sender_type: "customer", message_type: message?.type || "text", content: content, whatsapp_message_id: whatsappMessageId, status: "delivered" });
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
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (!value) continue;
      if (value.statuses?.length > 0) { await handleStatuses(supabase, value.statuses); }
      if (value.messages?.length > 0) {
        for (const msg of value.messages) {
          const res = await handleIncomingMessage(supabase, value, msg);
          messageResults.push(res);
        }
      }
    }
  }
  return NextResponse.json({ received: true, messages: messageResults });
}