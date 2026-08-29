import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase server environment variables");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("WhatsApp webhook verification:", {
    mode,
    tokenReceived: !!token,
    challengeReceived: !!challenge,
  });

  if (
    mode === "subscribe" &&
    token &&
    VERIFY_TOKEN &&
    token === VERIFY_TOKEN
  ) {
    return new NextResponse(challenge);
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("========== WHATSAPP WEBHOOK ==========");
    console.log(JSON.stringify(body, null, 2));
    console.log("======================================");

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      console.log("Webhook received without value");
      return NextResponse.json({ received: true });
    }

    if (!value.messages || value.messages.length === 0) {
      console.log("Webhook event has no incoming messages");
      return NextResponse.json({ received: true });
    }

    for (const message of value.messages) {
      const contact = value.contacts?.find(
        (item: any) => item.wa_id === message.from
      );

      const metadata = value.metadata;

      const phoneNumberId = metadata?.phone_number_id;
      const customerPhone = message.from;

      const customerName =
        contact?.profile?.name || customerPhone;

      const whatsappMessageId = message.id;
      const messageType = message.type;

      let content = "";

      if (messageType === "text") {
        content = message.text?.body || "";
      } else if (messageType === "image") {
        content = message.image?.caption || "[image]";
      } else if (messageType === "video") {
        content = message.video?.caption || "[video]";
      } else if (messageType === "audio") {
        content = "[audio]";
      } else if (messageType === "document") {
        content = message.document?.caption || "[document]";
      } else if (messageType === "sticker") {
        content = "[sticker]";
      } else {
        content = `[${messageType}]`;
      }

      console.log("Incoming WhatsApp message:", {
        phoneNumberId,
        customerPhone,
        customerName,
        whatsappMessageId,
        messageType,
        content,
      });

      if (!phoneNumberId) {
        console.error("Missing phone_number_id");
        continue;
      }

      if (!customerPhone) {
        console.error("Missing customer phone number");
        continue;
      }

      if (!whatsappMessageId) {
        console.error("Missing WhatsApp message ID");
        continue;
      }

      // Find WhatsApp account
      const { data: whatsappAccount, error: accountError } =
        await supabase
          .from("whatsapp_accounts")
          .select(
            "id, workspace_id, phone_number_id, business_account_id"
          )
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();

      if (accountError) {
        console.error(
          "WhatsApp account lookup error:",
          accountError
        );
        continue;
      }

      if (!whatsappAccount) {
        console.error(
          "WhatsApp account not found for phone_number_id:",
          phoneNumberId
        );
        continue;
      }

      console.log("WhatsApp account found:", whatsappAccount.id);

      const workspaceId = whatsappAccount.workspace_id;

      // Find existing contact
      const { data: existingContact, error: contactLookupError } =
        await supabase
          .from("contacts")
          .select("id, name, phone, email")
          .eq("workspace_id", workspaceId)
          .eq("phone", customerPhone)
          .maybeSingle();

      if (contactLookupError) {
        console.error(
          "Contact lookup error:",
          contactLookupError
        );
        continue;
      }

      let contactId: string;

      if (existingContact) {
        contactId = existingContact.id;

        if (
          customerName &&
          customerName !== customerPhone &&
          customerName !== existingContact.name
        ) {
          const { error: updateError } = await supabase
            .from("contacts")
            .update({ name: customerName })
            .eq("id", contactId);

          if (updateError) {
            console.error(
              "Contact update error:",
              updateError
            );
          }
        }
      } else {
        const { data: newContact, error: contactInsertError } =
          await supabase
            .from("contacts")
            .insert({
              workspace_id: workspaceId,
              name: customerName,
              phone: customerPhone,
            })
            .select("id")
            .single();

        if (contactInsertError) {
          console.error(
            "Contact insert error:",
            contactInsertError
          );
          continue;
        }

        contactId = newContact.id;
      }

      console.log("Contact ready:", contactId);

      // Find existing conversation
      const {
        data: existingConversation,
        error: conversationLookupError,
      } = await supabase
        .from("conversations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .eq("whatsapp_account_id", whatsappAccount.id)
        .maybeSingle();

      if (conversationLookupError) {
        console.error(
          "Conversation lookup error:",
          conversationLookupError
        );
        continue;
      }

      let conversationId: string;

      if (existingConversation) {
        conversationId = existingConversation.id;

        const { error: conversationUpdateError } =
          await supabase
            .from("conversations")
            .update({
              status: "open",
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

        if (conversationUpdateError) {
          console.error(
            "Conversation update error:",
            conversationUpdateError
          );
          continue;
        }
      } else {
        const {
          data: newConversation,
          error: conversationInsertError,
        } = await supabase
          .from("conversations")
          .insert({
            workspace_id: workspaceId,
            contact_id: contactId,
            whatsapp_account_id: whatsappAccount.id,
            status: "open",
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (conversationInsertError) {
          console.error(
            "Conversation insert error:",
            conversationInsertError
          );
          continue;
        }

        conversationId = newConversation.id;
      }

      console.log("Conversation ready:", conversationId);

      // Prevent duplicate messages
      const {
        data: existingMessage,
        error: messageLookupError,
      } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", whatsappMessageId)
        .maybeSingle();

      if (messageLookupError) {
        console.error(
          "Message lookup error:",
          messageLookupError
        );
        continue;
      }

      if (!existingMessage) {
        const { error: messageInsertError } =
          await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              sender_type: "customer",
              sender_id: contactId,
              message_type: messageType,
              content,
              whatsapp_message_id: whatsappMessageId,
            });

        if (messageInsertError) {
          console.error(
            "Message insert error:",
            messageInsertError
          );
          continue;
        }

        console.log(
          "MESSAGE SAVED SUCCESSFULLY:",
          whatsappMessageId
        );
      } else {
        console.log(
          "Duplicate message ignored:",
          whatsappMessageId
        );
      }
    }

    return NextResponse.json({
      received: true,
      saved: true,
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return NextResponse.json(
      {
        received: false,
        error: "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}