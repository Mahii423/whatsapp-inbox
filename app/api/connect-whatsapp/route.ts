import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const displayPhone = String(body.displayPhone || "").trim();

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "Phone Number ID and Access Token are required" },
        { status: 400 }
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: workspaceError?.message || "Workspace not found" },
        { status: 404 }
      );
    }

    const graphResponse = await fetch(
      `https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const graphResult = await graphResponse.json();

    if (!graphResponse.ok) {
      return NextResponse.json(
        {
          error:
            graphResult?.error?.message ||
            "Could not verify this WhatsApp Cloud API account. Check the Phone Number ID and Access Token.",
        },
        { status: 400 }
      );
    }

    const resolvedDisplayPhone =
      displayPhone || graphResult?.display_phone_number || null;

    const { data: existing } = await supabase
      .from("whatsapp_accounts")
      .select("id, phone_number_id, display_phone")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("whatsapp_accounts")
        .update({
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          display_phone: resolvedDisplayPhone,
        })
        .eq("id", existing.id)
        .eq("workspace_id", workspace.id)
        .select("id, phone_number_id, display_phone, workspace_id")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          {
            error:
              updateError?.message ||
              "Could not update the WhatsApp account for this workspace.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, account: updated });
    }

    const { data: created, error: insertError } = await supabase
      .from("whatsapp_accounts")
      .insert({
        workspace_id: workspace.id,
        phone_number_id: phoneNumberId,
        access_token: accessToken,
        display_phone: resolvedDisplayPhone,
      })
      .select("id, phone_number_id, display_phone, workspace_id")
      .single();

    if (insertError || !created) {
      const duplicate =
        insertError?.code === "23505" ||
        insertError?.message?.toLowerCase().includes("duplicate");

      return NextResponse.json(
        {
          error: duplicate
            ? "This WhatsApp Phone Number ID is already connected to another workspace."
            : insertError?.message || "Could not connect WhatsApp account.",
        },
        { status: duplicate ? 409 : 400 }
      );
    }

    return NextResponse.json({ success: true, account: created });
  } catch (error) {
    console.error("Connect WhatsApp error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
