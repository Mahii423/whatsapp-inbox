"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "../../utils/supabase/client";
const supabase = createClient();

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [filter, setFilter] = useState<"all"|"unread">("all");
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.contact_id);
      const { data: contacts } = await supabase.from("contacts").select("*").in("id", ids);
      setConversations(data.map((c: any) => ({...c, contacts: contacts?.find((co: any) => co.id === c.contact_id)})));
    }
  };
  const loadMessages = async (id: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (selected) loadMessages(selected.id); }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase.channel(`chat-${selected.id}`).on('postgres_changes',{ event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected.id}` },(payload)=>{
      setMessages(prev=> prev.find(m=>m.id===payload.new.id)? prev : [...prev, payload.new]);
      loadConversations();
    }).subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(()=>{
    const ch = supabase.channel('all-conv').on('postgres_changes',{event:'*',schema:'public',table:'conversations'},()=>loadConversations()).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[]);

  const send = async () => {
    if (!newMessage.trim() ||!selected) return;
    const txt = newMessage; setNewMessage("");
    setMessages(p => [...p, { id: Date.now(), content: txt, sender_type: "agent", created_at: new Date().toISOString() }]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id, message: txt }) });
  };

  const initial = (s: string) => s? s[0].toUpperCase() : "C";
  const filtered = filter==="all"? conversations : conversations.filter((c:any)=> (c.unread_count||0)>0);
  const unreadCount = conversations.filter((c:any)=> (c.unread_count||0)>0).length;

  return (
    <>
    <style>{`
   .wa-scroll::-webkit-scrollbar{width:6px;}
   .wa-scroll::-webkit-scrollbar-thumb{background:#c1c1c1; border-radius:10px;}
   .wa-scroll::-webkit-scrollbar-track{background:transparent;}
    `}</style>
    <div className="flex h-[calc(100vh-48px)] w-full overflow-hidden bg-white -m-6 relative">
      <div className="w- min-w- border-r bg-white flex flex-col">
        <div className="h- bg-[#f0f2f5] px-3 flex items-center justify-between">
          <span className="font-bold text-">Chats</span>
          <div className="flex gap-1">
            <button onClick={()=>setFilter("all")} className={`px-3 py-1.5 rounded-full text- font-medium ${filter==="all"? "bg-[#e7fce3] text-[#008069]":"bg-[#f0f2f5] text-[#54656f]"}`}>All</button>
            <button onClick={()=>setFilter("unread")} className={`px-3 py-1.5 rounded-full text- font-medium flex items-center gap-1 ${filter==="unread"? "bg-[#e7fce3] text-[#008069]":"bg-[#f0f2f5] text-[#54656f]"}`}>Unread {unreadCount>0 && <span className="bg-[#25d366] text-white px-1.5 rounded-full text-">{unreadCount}</span>}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto wa-scroll">
          {filtered.map((c:any)=>(
            <div key={c.id} onClick={()=>{setSelected(c); setShowInfo(false);}} className={`h- flex items-center gap-3 px-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?"bg-[#f0f2f5]":""}`}>
              <div className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text- shrink-0">{initial(c.contacts?.name||c.contacts?.phone)}</div>
              <div className="flex-1 border-t border-[#f0f2f5] py-3 overflow-hidden">
                <div className="flex justify-between"><span className={`truncate text- ${c.unread_count>0?"font-bold":""}`}>{c.contacts?.name||c.contacts?.phone}</span><span className={`text- ${c.unread_count>0?"text-[#25d366] font-bold":"text-[#667781]"}`}>{c.last_message_at? new Date(c.last_message_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):""}</span></div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`truncate text- w- ${c.unread_count>0?"font-bold text-black":"text-[#667781]"}`}>{c.last_message_text}</span>
                  {c.unread_count>0 && <span className="bg-[#25d366] text-white text- rounded-full min-w- h- flex items-center justify-center px-1.5 font-bold">{c.unread_count}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {!selected? <div className="flex-1 bg-[#f0f2f5] flex items-center justify-center text-[#667781]">Select chat - LIVE ●</div> : (
          <>
            <div onClick={()=>setShowInfo(!showInfo)} className="h- bg-[#f0f2f5] px-4 flex items-center gap-3 border-l cursor-pointer">
              <div className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold">{initial(selected.contacts?.name||"")}</div>
              <div><div className="font-semibold text-">{selected.contacts?.name||"Unknown"}</div><div className="text- text-[#667781]">{selected.contacts?.phone} • Click to view</div></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2] wa-scroll" style={{backgroundImage:`url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`}}>
              <div className="max-w- mx-auto flex flex-col gap-1">
                {messages.map((m:any)=>(
                  <div key={m.id} className={`flex ${m.sender_type==="agent"? "justify-end":"justify-start"}`}>
                    <div className={`rounded-[7.5px] shadow-sm px-2.5 py-1.5 max-w-[65%] text-[14.2px] ${m.sender_type==="agent"? "bg-[#d9fdd3] rounded-tr-none":"bg-white rounded-tl-none"}`}>
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                      <span className="inline-block float-right ml- mt- text- text-[#667781]">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <div className="clear-both"></div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            {/* VOICE + EMOJI + ATTACH WAPAS */}
            <div className="h- bg-[#f0f2f5] flex items-center gap-3 px-4">
              <button className="text- hover:bg-[#e9edef] w-8 h-8 rounded-full flex items-center justify-center">😊</button>
              <button className="text- hover:bg-[#e9edef] w-8 h-8 rounded-full flex items-center justify-center">📎</button>
              <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message" className="flex-1 bg-white rounded- px-4 py- outline-none text-" />
              {newMessage.trim()? (
                <button onClick={send} className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center">➤</button>
              ) : (
                <button className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center text-">🎤</button>
              )}
            </div>
          </>
        )}
      </div>

      {showInfo && selected && (
        <div className="w- min-w- border-l bg-white flex flex-col shadow-xl">
          <div className="h- bg-[#f0f2f5] px-4 flex items-center justify-between"><span className="font-bold">Contact Info</span><button onClick={()=>setShowInfo(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center">✕</button></div>
          <div className="p-6 flex flex-col items-center">
            <div className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text- mb-4">{initial(selected.contacts?.name||selected.contacts?.phone)}</div>
            <div className="font-bold text-">{selected.contacts?.name||"Unknown"}</div>
            <div className="text-[#667781] text- mt-1">{selected.contacts?.phone}</div>
            <div className="w-full mt-8 space-y-3">
              <div className="bg-[#f0f2f5] rounded-lg p-3"><div className="text- text-[#667781] uppercase">Phone</div><div className="font-medium mt-1">{selected.contacts?.phone}</div></div>
              <div className="bg-[#f0f2f5] rounded-lg p-3"><div className="text- text-[#667781] uppercase">Name</div><div className="font-medium mt-1">{selected.contacts?.name||"Not set"}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}