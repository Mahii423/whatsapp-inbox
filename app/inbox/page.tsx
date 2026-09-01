"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "../../utils/supabase/client";
const supabase = createClient();

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.contact_id);
      const { data: contacts } = await supabase.from("contacts").select("*").in("id", ids);
      const merged = data.map((c: any) => ({...c, contacts: contacts?.find((co: any) => co.id === c.contact_id) }));
      setConversations(merged);
    }
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (selected) loadMessages(selected.id); }, [selected]);

  const sendMessage = async () => {
    if (!newMessage.trim() ||!selected) return;
    const text = newMessage;
    setNewMessage("");
    setMessages(prev => [...prev, { id: Date.now(), content: text, sender_type: "agent", created_at: new Date().toISOString() }]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id, message: text }) });
  };

  const getInitial = (name: string) => name? name.charAt(0).toUpperCase() : "?";

  return (
    <div className="flex h-[calc(100vh-48px)] w-full overflow-hidden bg-white -m-6">
      {/* LEFT */}
      <div className="flex w- min-w- flex-col border-r bg-white">
        <div className="flex h- items-center bg-[#f0f2f5] px-4 font-bold text-">WhatsApp Inbox</div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c: any) => (
            <div key={c.id} onClick={() => setSelected(c)} className={`flex h- cursor-pointer items-center gap-3 px-3 hover:bg-[#f5f6f6] ${selected?.id === c.id? "bg-[#f0f2f5]" : ""}`}>
              <div className="flex h- w- items-center justify-center rounded-full bg-[#00a884] text-white font-bold text- shrink-0">
                {getInitial(c.contacts?.name || c.contacts?.phone)}
              </div>
              <div className="flex-1 border-t py-3 overflow-hidden">
                <div className="flex justify-between">
                  <span className="font-medium text- truncate">{c.contacts?.name || c.contacts?.phone || "Customer"}</span>
                  <span className="text- text-[#667781] shrink-0 ml-2">{c.last_message_at? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="truncate text- text-[#667781] w-">{c.last_message_text || "No message"}</span>
                  {c.unread_count > 0 && <span className="bg-[#25d366] text-white text- rounded-full px- py- min-w- text-center">{c.unread_count}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-1 flex-col bg-[#efeae2]">
        {!selected? (
          <div className="flex flex-1 items-center justify-center bg-[#f0f2f5] text-[#667781]">Select a conversation</div>
        ) : (
          <>
            <div className="flex h- items-center bg-[#f0f2f5] px-4 border-l">
              <div className="flex h- w- items-center justify-center rounded-full bg-[#00a884] text-white font-bold mr-3">{getInitial(selected.contacts?.name || "")}</div>
              <div><div className="font-semibold text-">{selected.contacts?.name || selected.contacts?.phone}</div><div className="text- text-[#667781]">Click to view contact info</div></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "#efeae2", backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`, backgroundRepeat: "repeat" }}>
              <div className="mx-auto flex max-w- flex-col gap-">
                {messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.sender_type === "agent"? "justify-end" : "justify-start"}`}>
                    <div className={`relative rounded- px- pt- pb- text-[14.2px] leading- shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-[65%] whitespace-pre-wrap break-words ${m.sender_type === "agent"? "bg-[#d9fdd3]" : "bg-white"}`}>
                      <span>{m.content}</span>
                      <span className="absolute bottom- right- text-[10.5px] text-[#667781] leading-none select-none">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            <div className="flex min-h- items-center gap-3 bg-[#f0f2f5] px-4 py-2">
              <button className="text- text-[#54656f]">😊</button>
              <button className="text- text-[#54656f]">📎</button>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Type a message" className="flex-1 rounded- bg-white px-4 py- text- outline-none" />
              <button onClick={sendMessage} className="flex h- w- items-center justify-center rounded-full bg-[#00a884] text-white">{newMessage.trim()? "➤" : "🎤"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}