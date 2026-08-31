"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Contact = { id: string; phone: string; name: string; last_message?: string }
type Message = { id: string; contact_id: string; message: string; from_me: boolean; created_at: string }

export default function InboxPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(50);
      if (data && data.length > 0) {
        setContacts(data as any);
        setSelected(data[0] as any);
      } else {
        const res2 = await supabase.from("whatsapp_contacts").select("*").limit(50);
        if (res2.data) {
          setContacts(res2.data as any);
          if (res2.data.length > 0) setSelected(res2.data[0] as any);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    async function loadMsgs() {
      if (!selected) return;
      const { data } = await supabase.from("messages").select("*").eq("contact_id", selected.id).order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    }
    loadMsgs();

    const selectedId = selected.id;
    const channel = supabase.channel(`msgs-${selectedId}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${selectedId}` },
      (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel) }
  }, [selected]);

  async function sendMessage() {
    if (!newMsg.trim() ||!selected) return;
    const msg = newMsg;
    setNewMsg("");
    await supabase.from("messages").insert({ contact_id: selected.id, message: msg, from_me: true });
    setMessages(prev => [...prev, { id: Date.now().toString(), contact_id: selected.id, message: msg, from_me: true, created_at: new Date().toISOString() } as any]);
    try {
      await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selected.phone, message: msg })
      });
    } catch(e) {}
  }

  if (loading) return <div className="p-10 text-center">Loading real chats from Supabase...</div>;

  return (
    <div className="flex bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="w- min-w- border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-sm">Inbox • {contacts.length} chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">💬</div>
              <div className="text-sm text-gray-500">No contacts yet</div>
              <div className="text-xs text-gray-400 mt-1">Webhook se ayenge</div>
            </div>
          ) : contacts.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} className={`p-4 border-b flex gap-3 cursor-pointer hover:bg-gray-50 ${selected?.id === c.id? 'bg-green-50 border-l-4 border-l-green-600' : 'border-l-4 border-l-transparent'}`}>
              <div className="w-9 h-9 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{(c.name || c.phone || 'U')[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text- truncate">{c.name || c.phone}</div>
                <div className="text- text-gray-500 truncate">{c.last_message || c.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2]">
        {!selected? <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a chat to start LIVE messaging</div> : (
          <>
            <div className="h- bg-white border-b px-5 flex items-center justify-between shrink-0">
              <div>
                <div className="font-semibold text-sm">{selected.name || selected.phone}</div>
                <div className="text-xs text-gray-500">{selected.phone}</div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">● Live</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0? <div className="text-center text-xs text-gray-400 mt-10">No messages yet. Say Hi!</div> : messages.map(m => (
                <div key={m.id} className={`flex ${m.from_me? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.from_me? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'} rounded-lg px-3.5 py-2 text- max-w-[65%] shadow-sm`}>{m.message}</div>
                </div>
              ))}
            </div>
            <div className="bg-white p-3 flex gap-2 border-t shrink-0">
              <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMessage()} placeholder="Type a real message..." className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none" />
              <button onClick={sendMessage} className="w-11 h-11 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center">➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}