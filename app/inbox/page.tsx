"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
const supabase = createClient();

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const loadConversations = async () => {
    const { data, error } = await supabase
     .from("conversations")
     .select("*")
     .order("last_message_at", { ascending: false });

    console.log("CONVS:", data, "ERR:", error);

    if (data && data.length > 0) {
      // contacts alag se lao
      const contactIds = data.map((c:any) => c.contact_id);
      const { data: contacts } = await supabase.from("contacts").select("*").in("id", contactIds);
      const merged = data.map((c:any) => ({
       ...c,
        contacts: contacts?.find((co:any) => co.id === c.contact_id)
      }));
      setConversations(merged);
    } else {
      setConversations(data || []);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!selected) return;
    supabase.from("messages").select("*").eq("conversation_id", selected.id).order("created_at", { ascending: true }).then(({ data }) => { if (data) setMessages(data); });
  }, [selected]);

  return (
    <div className="flex h-screen bg-white">
      <div className="w- border-r">
        <div className="p-4 font-bold bg-[#f0f2f5]">Inbox - {conversations.length} chats</div>
        <div className="overflow-y-auto">
          {conversations.map((c:any) => (
            <div key={c.id} onClick={() => setSelected(c)} className={`p-3 border-b cursor-pointer hover:bg-gray-100 ${selected?.id===c.id?"bg-gray-100":""}`}>
              <div className="font-bold text-">{c.contacts?.name || c.contacts?.phone || c.contact_id.slice(0,8)}</div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span className="truncate w-">{c.last_message_text || "No message"}</span>
                {c.unread_count>0 && <span className="bg-green-500 text-white text-xs px-2 rounded-full">{c.unread_count}</span>}
              </div>
            </div>
          ))}
          {conversations.length===0 && <div className="p-8 text-center text-gray-400">No conversations - Check console F12</div>}
        </div>
      </div>
      <div className="flex-1 bg-[#efeae2] p-4">
        {!selected? <div className="h-full flex items-center justify-center text-gray-400">Select a conversation - Business Model Ready</div> : (
          <div>
            <div className="font-bold mb-4 bg-[#f0f2f5] p-3 -m-4 mb-4">{selected.contacts?.name} - {selected.contacts?.phone}</div>
            <div className="space-y-2">
              {messages.map((m:any) => (
                <div key={m.id} className={`p-2 rounded-lg max-w-[60%] text-sm ${m.sender_type==='customer'?'bg-white':'bg-[#d9fdd3] ml-auto'}`}>{m.content}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}