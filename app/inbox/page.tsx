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

  const send = async () => {
    if (!newMessage.trim() ||!selected) return;
    const txt = newMessage; setNewMessage("");
    setMessages(p => [...p, { id: Date.now(), content: txt, sender_type: "agent", created_at: new Date().toISOString() }]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id, message: txt }) });
  };

  const initial = (s: string) => s? s[0].toUpperCase() : "C";

  return (
    <div className="flex h-[calc(100vh-48px)] w-full overflow-hidden bg-white -m-6">
      {/* LEFT */}
      <div className="w- min-w- border-r bg-white flex flex-col">
        <div className="h- bg-[#f0f2f5] px-4 flex items-center font-bold">Chats</div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c:any)=>(
            <div key={c.id} onClick={()=>setSelected(c)} className={`h- flex items-center gap-3 px-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?"bg-[#f0f2f5]":""}`}>
              <div className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text- shrink-0">{initial(c.contacts?.name||c.contacts?.phone)}</div>
              <div className="flex-1 border-t border-[#f0f2f5] py-3 overflow-hidden">
                <div className="flex justify-between"><span className="font-[500] text- truncate">{c.contacts?.name||c.contacts?.phone}</span><span className="text- text-[#667781]">{c.last_message_at? new Date(c.last_message_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):""}</span></div>
                <div className="text- text-[#667781] truncate pr-2">{c.last_message_text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT - NORMAL WHATSAPP */}
      <div className="flex flex-1 flex-col">
        {!selected? <div className="flex-1 bg-[#f0f2f5] flex items-center justify-center text-[#667781]">Select chat</div> : (
          <>
            <div className="h- bg-[#f0f2f5] px-4 flex items-center gap-3 border-l">
              <div className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold">{initial(selected.contacts?.name||"")}</div>
              <div className="font-semibold">{selected.contacts?.name||selected.contacts?.phone}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2]" style={{backgroundImage:`url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`}}>
              <div className="max-w- mx-auto flex flex-col gap-1">
                {messages.map((m:any)=>(
                  <div key={m.id} className={`flex ${m.sender_type==="agent"? "justify-end":"justify-start"}`}>
                    <div className={`rounded-[7.5px] shadow-sm px-2.5 py-1.5 max-w-[65%] text-[14.2px] leading- ${m.sender_type==="agent"? "bg-[#d9fdd3] rounded-tr-none":"bg-white rounded-tl-none"}`}>
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                      <span className="inline-block float-right ml- mt- text- text-[#667781] leading- select-none">
                        {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </span>
                      <div className="clear-both"></div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            <div className="h- bg-[#f0f2f5] flex items-center gap-2 px-4">
              <span className="text-">😊</span>
              <span className="text-">📎</span>
              <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message" className="flex-1 bg-white rounded- px-4 py- outline-none text-" />
              <button onClick={send} className="w- h- rounded-full bg-[#00a884] text-white flex items-center justify-center text-">➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}