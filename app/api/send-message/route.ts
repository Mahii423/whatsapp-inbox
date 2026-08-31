import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const conversationId = body.conversationId;
    const text = String(body.message || "").trim();

    if (!conversationId || !text) {
      return NextResponse.json(
        { error: "conversationId and message are required" },
        { status: 400 }
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: workspaceError?.message || "Workspace not found" },
        { status: 404 }
      );
    }

    const { data: conversation, error: conversationError } =
      await supabase
        .from("conversations")
        .select("id, workspace_id, contact_id, whatsapp_account_id")
        .eq("id", conversationId)
        .eq("workspace_id", workspace.id)
        .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message || "Conversation not found" },
        { status: 404 }
      );
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, phone, workspace_id")
      .eq("id", conversation.contact_id)
      .eq("workspace_id", workspace.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: contactError?.message || "Contact not found" },
        { status: 404 }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("id, phone_number_id, access_token, workspace_id")
      .eq("id", conversation.whatsapp_account_id)
      .eq("workspace_id", workspace.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: accountError?.message || "WhatsApp account not found" },
        { status: 404 }
      );
    }

    const accessToken =
      String(account.access_token || "").trim() ||
      process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "This workspace has no WhatsApp access token. Reconnect the WhatsApp account.",
        },
        { status: 400 }
      );
    }

    const phone = String(contact.phone || "").replace(/\D/g, "");

    if (!phone) {
      return NextResponse.json(
        { error: "Customer phone number is missing" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", result);

      return NextResponse.json(
        {
          error:
            result?.error?.message || "WhatsApp API request failed",
          details: result,
        },
        { status: response.status }
      );
    }

    const whatsappMessageId = result?.messages?.[0]?.id || null;
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "agent",
        sender_id: userData.user.id,
        message_type: "text",
        content: text,
        whatsapp_message_id: whatsappMessageId,
        status: "sent",
      });

    if (insertError) {
      console.error("Database message error:", insertError);

      return NextResponse.json(
        {
          error: insertError.message,
          whatsappSent: true,
        },
        { status: 500 }
      );
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversation.id)
      .eq("workspace_id", workspace.id);

    return NextResponse.json({
      success: true,
      whatsappMessageId,
      status: "sent",
    });
  } catch (error) {
    console.error("Send message route error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
