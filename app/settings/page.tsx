"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("MahiWAinbox");
  const [displayPhone, setDisplayPhone] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/auth"; return; }
      setUserId(data.user.id);
      const { data: accs } = await supabase.from("whatsapp_accounts").select("*").eq("user_id", data.user.id);
      setAccounts(accs || []);
    })();
  }, []);

  async function connectWhatsApp(e: any) {
    e.preventDefault();
    if (!userId) return;
    setStatus("Connecting...");

    try {
      // 1. Create workspace for this user
      const { data: ws, error: wsError } = await supabase
       .from("workspaces")
       .insert({ name: workspaceName, owner_id: userId })
       .select("id")
       .single();

      if (wsError) throw wsError;

      // 2. Create whatsapp account
      const { error: accError } = await supabase
       .from("whatsapp_accounts")
       .insert({
          workspace_id: ws.id,
          user_id: userId,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: accessToken,
          display_phone: displayPhone,
          status: "active"
        });

      if (accError) throw accError;

      setStatus("✅ Connected! Go to Inbox");
      setTimeout(() => window.location.href = "/", 1500);
    } catch (err: any) {
      setStatus("❌ Error: " + err.message);
    }
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f0f2f5", padding: "40px", fontFamily: "Segoe UI" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "#00a884", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "20px" }}>M</div>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px" }}>MahiWAinbox Settings</h1>
            <p style={{ margin: 0, color: "#667781" }}>Connect your WhatsApp Business</p>
          </div>
        </div>

        {accounts.length > 0 && (
          <div style={{ backgroundColor: "#e7f8f2", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
            <strong>✅ Connected Number:</strong> {accounts[0].display_phone} <br />
            <small>ID: {accounts[0].phone_number_id}</small>
          </div>
        )}

        <form onSubmit={connectWhatsApp} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <label>Company / Workspace Name
            <input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="MahiWAinbox" style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ccc" }} required />
          </label>

          <label>Display Phone Number (e.g. +92...)
            <input value={displayPhone} onChange={e => setDisplayPhone(e.target.value)} placeholder="+92300xxxxxxx" style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ccc" }} required />
          </label>

          <label>Phone Number ID (from Meta)
            <input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="1331830386671336" style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ccc" }} required />
          </label>

          <label>WABA ID
            <input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="From Meta Dashboard" style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ccc" }} required />
          </label>

          <label>Access Token (Permanent)
            <input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="EAAJ..." type="password" style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ccc" }} required />
          </label>

          <button type="submit" style={{ backgroundColor: "#00a884", color: "#fff", padding: "12px", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" }}>
            Connect WhatsApp
          </button>

          {status && <div style={{ padding: "10px", backgroundColor: "#f0f2f5", borderRadius: "6px", fontSize: "14px" }}>{status}</div>}
        </form>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <a href="/" style={{ color: "#00a884", textDecoration: "none", fontWeight: "bold" }}>← Back to Inbox</a>
        </div>
      </div>
    </main>
  );
}