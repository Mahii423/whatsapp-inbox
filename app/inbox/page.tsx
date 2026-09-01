"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Conv = { id: string; contact_id: string; contacts: { id:string; name:string; phone:string; avatar_url?: string } | null; last_message_at: string; }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string }

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const { data: acc } = await supabase.from("whatsapp_accounts").select("id").limit(1).maybeSingle();
      if (!acc) { setHasWhatsApp(false); return; }
      setHasWhatsApp(true);
      const { data: convsRaw } = await supabase.from("conversations").select("id, contact_id, last_message_at").order("last_message_at", { ascending: false }).limit(50);
      if (!convsRaw || convsRaw.length===0) return;
      const contactIds = convsRaw.map(c=>c.contact_id);
      const { data: contactsRaw } = await supabase.from("contacts").select("id,name,phone,avatar_url").in("id", contactIds);
      const merged = convsRaw.map(conv=>{
        const ct = contactsRaw?.find(x=>x.id===conv.contact_id) || null;
        return {...conv, contacts: ct} as Conv;
      });
      setConvs(merged);
      if (merged.length>0) setSelected(merged[0]);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    async function loadMsgs() {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", selected!.id).order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    }
    loadMsgs();
  }, [selected]);

  async function sendMessage() {
    if (!newMsg.trim() ||!selected) return;
    const text = newMsg; setNewMsg("");
    setMessages(prev => [...prev, { id: Date.now().toString(), conversation_id: selected.id, content: text, sender_type: 'agent', created_at: new Date().toISOString() } as any]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: selected.id, message: text }) });
  }

  if (hasWhatsApp === false) {
    return (
      <div className="p-10 bg-white rounded-2xl border text-center">
        <h2 className="text-xl font-bold mb-2">WhatsApp Connect Nahi Hai</h2>
        <p className="text-sm text-gray-500 mb-6">Apna Inbox use karne ke liye pehle WhatsApp API connect karo.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/integrations" className="bg-green-600 text-white px-6 py-3 rounded-full text-sm font-semibold">Connect with Facebook</Link>
          <Link href="/settings/whatsapp" className="bg-gray-100 px-6 py-3 rounded-full text-sm">Manual</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full bg-white rounded-2xl border overflow-hidden" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="w- border-r flex flex-col shrink-0 bg-white">
        <div className="p-4 border-b font-bold text-sm">Inbox • {convs.length} chats</div>
        <div className="flex-1 overflow-y-auto">
          {convs.map(c => (
            <div key={c.id} onClick={()=>setSelected(c)} className={`p-4 border-b flex gap-3 cursor-pointer ${selected?.id===c.id?'bg-green-50':''}`}>
              <img src={c.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.contacts?.name || 'User')}`} className="w-9 h-9 rounded-full" alt="" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{c.contacts?.name || c.contacts?.phone}</div>
                <div className="text-xs text-gray-500 truncate">{c.contacts?.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {!selected? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a chat to start LIVE messaging</div>
        ) : (
          <>
            <div className="h-16 bg-white border-b px-5 flex items-center justify-between">
              <div><div className="font-semibold text-sm">{selected.contacts?.name}</div><div className="text-xs text-gray-500">{selected.contacts?.phone}</div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                  <div className={`${m.sender_type==='agent'?'bg-[#d9fdd3]':'bg-white'} rounded-lg px-3.5 py-2 text-sm max-w-[65%]`}>{m.content}</div>
                </div>
              ))}
            </div>
            <div className="bg-white p-3 flex gap-2 border-t">
              <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Type..." className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none" />
              <button onClick={sendMessage} className="w-11 h-11 bg-green-600 text-white rounded-full">➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}