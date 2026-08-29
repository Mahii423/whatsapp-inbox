import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
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

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(
      "WhatsApp Webhook Received:",
      JSON.stringify(body, null, 2)
    );

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) {
      return NextResponse.json({ received: true });
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
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
    } else {
      content = `[${messageType}]`;
    }

    console.log("Phone Number ID:", phoneNumberId);
    console.log("Customer Phone:", customerPhone);
    console.log("Message:", content);

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

      return NextResponse.json(
        {
          error: "WhatsApp account lookup failed",
          details: accountError.message,
        },
        { status: 500 }
      );
    }

    if (!whatsappAccount) {
      console.error(
        "WhatsApp account not found for phone_number_id:",
        phoneNumberId
      );

      return NextResponse.json(
        {
          error: "WhatsApp account not configured",
          phone_number_id: phoneNumberId,
        },
        { status: 500 }
      );
    }

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

      return NextResponse.json(
        { error: "Contact lookup failed" },
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
        const { error: updateContactError } =
          await supabase
            .from("contacts")
            .update({ name: customerName })
            .eq("id", contactId);

        if (updateContactError) {
          console.error(
            "Contact update error:",
            updateContactError
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

        return NextResponse.json(
          { error: "Contact creation failed" },
          { status: 500 }
        );
      }

      contactId = newContact.id;
    }

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

      return NextResponse.json(
        { error: "Conversation lookup failed" },
        { status: 500 }
      );
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

        return NextResponse.json(
          { error: "Conversation creation failed" },
          { status: 500 }
        );
      }

      conversationId = newConversation.id;
    }

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

      return NextResponse.json(
        { error: "Message lookup failed" },
        { status: 500 }
      );
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

        return NextResponse.json(
          { error: "Message creation failed" },
          { status: 500 }
        );
      }
    }

    console.log(
      "WhatsApp message saved successfully."
    );

    return NextResponse.json({
      received: true,
      saved: true,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}