"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // agar ye error de to neeche wala import use karo

// agar upar wala error de to isko use karo: import { supabase } from "@/utils/supabase/client"

type Contact = { id: string; phone: string; name: string; last_message?: string }
type Message = { id: string; contact_id: string; message: string; from_me: boolean; created_at: string }

export default function InboxPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Load contacts
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: contactsData } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (contactsData) {
        setContacts(contactsData as any);
        if (contactsData.length > 0) setSelected(contactsData[0] as any);
      }
      setLoading(false);
    }
    load();

    // Realtime - new contacts
    const channel = supabase.channel('contacts-live').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, payload => {
      load();
    }).subscribe();
    return () => { supabase.removeChannel(channel) }
  }, []);

  // Load messages when contact selected
  useEffect(() => {
    if (!selected) return;
    async function loadMsgs() {
      const { data } = await supabase.from("messages").select("*").eq("contact_id", selected.id).order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    }
    loadMsgs();

    const channel = supabase.channel(`msgs-${selected.id}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${selected.id}` },
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

    // 1. Save to DB
    await supabase.from("messages").insert({ contact_id: selected.id, message: msg, from_me: true });

    // 2. Send via WhatsApp API (aapka API route)
    await fetch("/api/send-message", {
      method: "POST",
      body: JSON.stringify({ phone: selected.phone, message: msg })
    });
  }

  if (loading) return <div className="p-10">Loading real chats...</div>;

  return (
    <div className="flex bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 100px)' }}>
      {/* LEFT - Real Contacts */}
      <div className="w- min-w- border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold">Inbox • {contacts.length} real chats</h2>
          <input placeholder="Search..." className="w-full mt-3 px-3 py-2.5 border rounded-xl text-sm bg-gray-50" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0? (
            <div className="p-10 text-center text-gray-400 text-sm">No contacts yet. Webhook se ayenge.</div>
          ) : contacts.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} className={`p-4 border-b flex gap-3 cursor-pointer hover:bg-gray-50 ${selected?.id === c.id? 'bg-green-50' : ''}`}>
              <div className="w-9 h-9 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">{c.name?.[0] || c.phone[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{c.name || c.phone}</div>
                <div className="text-xs text-gray-500 truncate">{c.last_message || c.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE - Real Messages */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {!selected? <div className="flex-1 flex items-center justify-center text-gray-400">Select a chat</div> : (
          <>
            <div className="h- bg-white border-b px-5 flex items-center justify-between">
              <div className="font-semibold">{selected.name || selected.phone}</div>
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">Live</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.from_me? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.from_me? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'} rounded-lg px-3.5 py-2 text-sm max-w-[70%] shadow-sm`}>{m.message}</div>
                </div>
              ))}
            </div>
            <div className="bg-white p-3 flex gap-2 border-t">
              <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none" />
              <button onClick={sendMessage} className="w-11 h-11 bg-green-600 text-white rounded-full">➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}