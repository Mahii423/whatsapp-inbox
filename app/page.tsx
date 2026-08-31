"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "../utils/supabase/client";

type Contact = { id: string; name: string | null; phone: string; email: string | null; avatar_url?: string | null; };
type Conversation = { id: string; status: string; last_message_at: string | null; contact_id?: string; whatsapp_account_id?: string; contacts: Contact | null; };
type Message = { id: string; content: string | null; sender_type: string; created_at: string | null; status: string | null; status_error: string | null; };
type Workspace = { id: string; name: string; };
type WhatsAppAccount = { id: string; workspace_id: string; phone_number_id: string; display_phone: string | null; };

function DeliveryTicks({ senderType, status, statusError }: { senderType: string; status?: string | null; statusError?: string | null; }) {
  if (senderType!== "agent") return null;
  if (status === "failed") return <span style={{ color: "#ea868f", marginLeft: "4px" }} title={statusError || "Failed"}>✕</span>;
  if (status === "read") return <span style={{ color: "#25D366", marginLeft: "4px", fontWeight: "bold" }}>✓✓</span>;
  if (status === "delivered") return <span style={{ color: "#8696a0", marginLeft: "4px" }}>✓✓</span>;
  return <span style={{ color: "#8696a0", marginLeft: "4px" }}>✓</span>;
}

export default function Home() {
  const supabase = createClient();
  const selectedIdRef = useRef<string | null>(null);
  const accountIdsRef = useRef<string[]>([]);
  const messagesRequestIdRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [whatsappAccount, setWhatsappAccount] = useState<WhatsAppAccount | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { selectedIdRef.current = selectedChat?.id?? null; }, [selectedChat]);
  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => { if(messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight; }, [messages]);

  useEffect(() => {
    if (accountIdsRef.current.length === 0) return;
    const channel = supabase.channel("inbox-realtime")
   .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { void loadConversations(accountIdsRef.current); })
   .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload: any) => {
        const newRow = payload.new as any;
        if(newRow?.conversation_id === selectedIdRef.current) {
          if(payload.eventType === "INSERT") {
            setMessages(c => {
              if(c.find(m => m.id === newRow.id)) return c; // duplicate fix
              return [...c, newRow].sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
            });
          }
        }
        void loadConversations(accountIdsRef.current);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [whatsappAccount?.id]);

  async function bootstrap() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { window.location.href = "/auth"; return; }

    const { data: whatsappAccounts, error } = await supabase
   .from("whatsapp_accounts")
   .select("id, workspace_id, phone_number_id, display_phone")
   .eq("user_id", user.id);

    if (error ||!whatsappAccounts || whatsappAccounts.length === 0) {
      setStatus("No WhatsApp connected. Go to /auth to connect your number.");
      setLoading(false);
      return;
    }

    setWhatsappAccount(whatsappAccounts[0]);
    accountIdsRef.current = whatsappAccounts.map(a => a.id);

    const { data: ws } = await supabase.from("workspaces").select("id, name").eq("id", whatsappAccounts[0].workspace_id).maybeSingle();
    if(ws) setWorkspace(ws);

    await loadConversations(accountIdsRef.current);
    setLoading(false);
  }

  async function loadConversations(accountIds: string[]) {
    if (accountIds.length === 0) return;
    const { data } = await supabase.from("conversations").select("id, status, last_message_at, contact_id, whatsapp_account_id, contacts(id, name, phone, email, avatar_url)").in("whatsapp_account_id", accountIds).order("last_message_at", { ascending: false });
    const convos = (data || []) as any;
    setConversations(convos);
    if(!selectedIdRef.current && convos[0]) {
      setSelectedChat(convos[0]);
      selectedIdRef.current = convos[0].id;
      void loadMessages(convos[0].id);
    }
  }

  async function loadMessages(conversationId: string) {
    const requestId = ++messagesRequestIdRef.current;
    const { data } = await supabase.from("messages").select("id, content, sender_type, created_at, status, status_error").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (requestId!== messagesRequestIdRef.current) return;
    const unique = (data as any || []).filter((msg: any, index: number, self: any[]) => index === self.findIndex(m => m.id === msg.id));
    setMessages(unique);
  }

  function selectConversation(chat: Conversation) {
    selectedIdRef.current = chat.id;
    setSelectedChat(chat);
    void loadMessages(chat.id);
  }

  async function sendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!message.trim() ||!selectedChat) return;
    const text = message.trim();
    setStatus("Sending...");
    try {
      const res = await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selectedChat.id, message: text }) });
      const data = await res.json();
      if (!res.ok) { setStatus(data?.error || "Failed"); return; }
      setMessage(""); setStatus("");
      await loadMessages(selectedChat.id);
    } catch { setStatus("Failed to send"); }
  }

  const customer = selectedChat?.contacts;

  // Duplicate free messages for render
  const displayMessages = messages.filter((msg, index, self) => index === self.findIndex(m => m.id === msg.id));

  return (
    <main style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", fontFamily: "Segoe UI, sans-serif", backgroundColor: "#111b21" }}>
      <aside style={{ width: "380px", borderRight: "1px solid #e9edef", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
        <div style={{ padding: "10px 16px", backgroundColor: "#f0f2f5", display: "flex", alignItems: "center", height: "60px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#00a884", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "16px" }}>M</div>
          <span style={{ fontWeight: "700", marginLeft: "12px", fontSize: "16px", color: "#111b21" }}>MahiWAinbox</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading? <div style={{ padding: "20px", textAlign: "center", color: "#667781" }}>Loading...</div> :
          conversations.map((chat) => {
            const isActive = selectedChat?.id === chat.id;
            return (
              <div key={chat.id} onClick={() => selectConversation(chat)} style={{ padding: "12px 16px", display: "flex", gap: "15px", cursor: "pointer", backgroundColor: isActive? "#f0f2f5" : "#fff", borderBottom: "1px solid #f5f6f6" }}>
                {chat.contacts?.avatar_url? <img src={chat.contacts.avatar_url} alt="" style={{ width: "49px", height: "49px", borderRadius: "50%" }} /> : <div style={{ width: "49px", height: "49px", borderRadius: "50%", backgroundColor: "#6b7c85", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{(chat.contacts?.name || "?")[0]}</div>}
                <div style={{ flex: 1, overflow: "hidden" }}><div style={{ fontWeight: "500" }}>{chat.contacts?.name || chat.contacts?.phone}</div><div style={{ fontSize: "13px", color: "#667781" }}>{chat.contacts?.phone}</div></div>
              </div>
            );
          })}
        </div>
      </aside>
      <section style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#efeae2" }}>
        {selectedChat? (
          <>
            <header style={{ padding: "10px 16px", backgroundColor: "#f0f2f5", height: "60px", display: "flex", alignItems: "center", gap: "12px" }}>
              {customer?.avatar_url? <img src={customer.avatar_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%" }} /> : <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#00a884", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{(customer?.name || "?")[0]}</div>}
              <h2 style={{ fontSize: "16px", margin: 0 }}>{customer?.name || customer?.phone}</h2>
            </header>
            <div ref={messagesContainerRef} style={{ flex: 1, padding: "20px 5%", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {displayMessages.map((msg, idx) => (
                <div key={`${msg.id}-${idx}`} style={{ display: "flex", justifyContent: msg.sender_type === "agent"? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "65%", padding: "6px 10px", borderRadius: msg.sender_type === "agent"? "8px 0 8px 8px" : "0 8px 8px 8px", backgroundColor: msg.sender_type === "agent"? "#d9fdd3" : "#fff", boxShadow: "0 1px 0.5px rgba(0,0,0,.13)" }}>
                    <span>{msg.content}</span>
                    <span style={{ fontSize: "11px", color: "#667781", float: "right", marginLeft: "8px", marginTop: "4px" }}>{msg.created_at? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""} <DeliveryTicks senderType={msg.sender_type} status={msg.status} /></span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px", backgroundColor: "#f0f2f5", display: "flex" }}>
              <form onSubmit={sendMessage} style={{ display: "flex", gap: "12px", width: "100%" }}>
                <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "none", outline: "none" }} />
                <button type="submit" style={{ backgroundColor: "#00a884", color: "#fff", border: "none", width: "42px", height: "42px", borderRadius: "50%", cursor: "pointer" }}>➤</button>
              </form>
            </div>
          </>
        ) : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#667781" }}>Select a chat</div>}
      </section>
    </main>
  );
}