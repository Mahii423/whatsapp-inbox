import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function getServiceClient(): SupabaseClient | null {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    VERIFY_TOKEN &&
    token === VERIFY_TOKEN
  ) {
    return new NextResponse(challenge || "", {
      status: 200,
    });
  }

  return new NextResponse("Forbidden", {
    status: 403,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();

    if (!supabase) {
      console.error(
        "Webhook cannot save messages: SUPABASE_SERVICE_ROLE_KEY is missing"
      );

      return NextResponse.json(
        {
          error: "Server is missing SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    console.log("WhatsApp Webhook Received:", JSON.stringify(body, null, 2));

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const metadata = value.metadata;

    const phoneNumberId = metadata?.phone_number_id;
    const customerPhone = message?.from;
    const whatsappMessageId = message?.id;
    const messageType = message?.type;

    const customerName =
      contact?.profile?.name || customerPhone || "WhatsApp Customer";

    if (!phoneNumberId || !customerPhone || !whatsappMessageId || !messageType) {
      console.error("Missing required WhatsApp message data");

      return NextResponse.json(
        { error: "Missing required WhatsApp message data" },
        { status: 400 }
      );
    }

    let content = "";

    if (messageType === "text") {
      content = message?.text?.body || "";
    } else if (messageType === "image") {
      content = message?.image?.caption || "[image]";
    } else if (messageType === "video") {
      content = message?.video?.caption || "[video]";
    } else if (messageType === "audio") {
      content = "[audio]";
    } else if (messageType === "document") {
      content = message?.document?.filename || "[document]";
    } else if (messageType === "sticker") {
      content = "[sticker]";
    } else if (messageType === "location") {
      content = "[location]";
    } else if (messageType === "contacts") {
      content = "[contact]";
    } else {
      content = `[${messageType}]`;
    }

    let whatsappAccount = (
      await supabase
        .from("whatsapp_accounts")
        .select("id, workspace_id, phone_number_id, business_account_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle()
    ).data;

    if (!whatsappAccount) {
      const configuredPhoneNumberId =
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

      if (configuredPhoneNumberId && configuredPhoneNumberId === phoneNumberId) {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (workspace) {
          const { data: createdAccount, error: createAccountError } =
            await supabase
              .from("whatsapp_accounts")
              .insert({
                workspace_id: workspace.id,
                phone_number_id: phoneNumberId,
                business_account_id: value?.metadata?.display_phone_number || null,
              })
              .select("id, workspace_id, phone_number_id, business_account_id")
              .single();

          if (createAccountError) {
            console.error("WhatsApp account auto-create error:", createAccountError);
          } else {
            whatsappAccount = createdAccount;
          }
        }
      }
    }

    if (!whatsappAccount) {
      console.error("WhatsApp account not found:", phoneNumberId);

      return NextResponse.json(
        {
          error: "WhatsApp account not configured",
          phone_number_id: phoneNumberId,
        },
        { status: 500 }
      );
    }

    const workspaceId = whatsappAccount.workspace_id;

    const { data: existingContact, error: contactLookupError } = await supabase
      .from("contacts")
      .select("id, name, phone, email")
      .eq("workspace_id", workspaceId)
      .eq("phone", customerPhone)
      .maybeSingle();

    if (contactLookupError) {
      console.error("Contact lookup error:", contactLookupError);

      return NextResponse.json(
        { error: "Contact lookup failed", details: contactLookupError.message },
        { status: 500 }
      );
    }

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;

      if (
        customerName &&
        customerName !== customerPhone &&
        customerName !== existingContact.name
      ) {
        await supabase
          .from("contacts")
          .update({ name: customerName })
          .eq("id", contactId);
      }
    } else {
      const { data: newContact, error: contactInsertError } = await supabase
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          name: customerName,
          phone: customerPhone,
        })
        .select("id")
        .single();

      if (contactInsertError || !newContact) {
        console.error("Contact creation error:", contactInsertError);

        return NextResponse.json(
          {
            error: "Contact creation failed",
            details: contactInsertError?.message,
          },
          { status: 500 }
        );
      }

      contactId = newContact.id;
    }

    const { data: existingConversation, error: conversationLookupError } =
      await supabase
        .from("conversations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .eq("whatsapp_account_id", whatsappAccount.id)
        .maybeSingle();

    if (conversationLookupError) {
      console.error("Conversation lookup error:", conversationLookupError);

      return NextResponse.json(
        {
          error: "Conversation lookup failed",
          details: conversationLookupError.message,
        },
        { status: 500 }
      );
    }

    let conversationId: string;
    const now = new Date().toISOString();

    if (existingConversation) {
      conversationId = existingConversation.id;

      await supabase
        .from("conversations")
        .update({
          status: "open",
          last_message_at: now,
        })
        .eq("id", conversationId);
    } else {
      const { data: newConversation, error: conversationInsertError } =
        await supabase
          .from("conversations")
          .insert({
            workspace_id: workspaceId,
            contact_id: contactId,
            whatsapp_account_id: whatsappAccount.id,
            status: "open",
            last_message_at: now,
          })
          .select("id")
          .single();

      if (conversationInsertError || !newConversation) {
        console.error("Conversation creation error:", conversationInsertError);

        return NextResponse.json(
          {
            error: "Conversation creation failed",
            details: conversationInsertError?.message,
          },
          { status: 500 }
        );
      }

      conversationId = newConversation.id;
    }

    const { data: existingMessage, error: messageLookupError } = await supabase
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", whatsappMessageId)
      .maybeSingle();

    if (messageLookupError) {
      console.error("Message lookup error:", messageLookupError);

      return NextResponse.json(
        { error: "Message lookup failed", details: messageLookupError.message },
        { status: 500 }
      );
    }

    if (existingMessage) {
      return NextResponse.json({
        received: true,
        saved: true,
        duplicate: true,
        conversation_id: conversationId,
        contact_id: contactId,
      });
    }

    const { error: messageInsertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "customer",
      sender_id: null,
      message_type: messageType,
      content,
      whatsapp_message_id: whatsappMessageId,
    });

    if (messageInsertError) {
      console.error("Message insert error:", messageInsertError);

      return NextResponse.json(
        { error: "Message creation failed", details: messageInsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      saved: true,
      conversation_id: conversationId,
      contact_id: contactId,
      whatsapp_message_id: whatsappMessageId,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
