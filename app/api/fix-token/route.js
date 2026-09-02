import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const newToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .update({ access_token: newToken })
    .not("id", "is", null)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updated: data.length, message: "Token updated in database!" });
}
