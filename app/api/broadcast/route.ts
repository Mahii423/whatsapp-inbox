// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { contactIds, templateName } = await req.json();

    const { data: ws } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
    const { data: contacts } = await supabase.from("contacts").select("id, phone, name").in("id", contactIds).eq("workspace_id", ws.id);

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID; // 1331830386671336

    let sent=0, failed=0, errors=[];

    for (const c of contacts || []) {
      let cleanPhone = c.phone.replace(/\D/g,"");
      if (cleanPhone.startsWith("0")) cleanPhone = "92" + cleanPhone.substring(1);
      
      const finalTemplate = templateName || "offer_update"; // real wala

      const payload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
          name: finalTemplate,
          language: { code: "en_US" },
          components: [
            { type: "body", parameters: [{ type: "text", text: c.name || "Customer" }] }
          ]
        }
      };

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`To ${cleanPhone}:`, data);
      if (res.ok) sent++; else { failed++; errors.push(data); }
    }
    return NextResponse.json({ success: true, sent, failed, errors });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}