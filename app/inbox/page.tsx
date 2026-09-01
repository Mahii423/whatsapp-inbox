"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "../../utils/supabase/client";
const supabase = createClient();

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const loadConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
    if (data && data.length > 0) {
      const ids = data.map((c:any) => c.contact_id);
      const { data: contacts } = await supabase.from("contacts").select("*").in("id", ids);
      const merged = data.map((c:any) => ({...c, contacts: contacts?.find((co:any) => co.id === c.contact_id) }));
      setConversations(merged);
    } else {
      setConversations(data || []);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: any[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");
        formData.append("conversationId", selected.id);
        await fetch("/api/send-voice", { method: "POST", body: formData });
        loadMessages(selected.id);
      };
      recorder.start();
      setRecording(true);
    } catch (e) { alert("Mic permission chahiye"); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex h-[calc(100vh-48px)] w-full overflow-hidden bg-white -m-6">
      {/* LEFT */}
      <div className="flex w- min-w- flex-col border-r bg-white">
        <div className="flex h- items-center bg-[#f0f2f5] px-4 font-bold">WhatsApp Business - {conversations.length}</div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c:any) => (
            <div key={c.id} onClick={() => setSelected(c)} className={`flex h- cursor-pointer items-center gap-3 px-3 hover:bg-[#f5f6f6] ${selected?.id===c.id?"bg-[#f0f2f5]":""}`}>
              <img src={`https://i.pravatar.cc/150?u=${c.contacts?.phone}`} className="h- w- rounded-full" />
              <div className="flex-1 border-t py-3 overflow-hidden">
                <div className="flex justify-between"><span className="font-medium text- truncate">{c.contacts?.name || c.contacts?.phone}</span><span className="text- text-[#667781]">{c.last_message_at? new Date(c.last_message_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ""}</span></div>
                <div className="flex justify-between items-center"><span className="truncate text- text-[#667781] w-">{c.last_message_text || "No message"}</span>{c.unread_count>0 && <span className="bg-[#25d366] text-white text- rounded-full px-2 py-0.5">{c.unread_count}</span>}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-1 flex-col bg-[#efeae2]">
        {!selected? (
          <div className="flex flex-1 items-center justify-center bg-[#f0f2f5] text-[#667781]">Business Inbox - Select a chat to sell</div>
        ) : (
          <>
            <div className="flex h- items-center bg-[#f0f2f5] px-4 border-l"><img src={`https://i.pravatar.cc/150?u=${selected.contacts?.phone}`} className="h- w- rounded-full mr-3" /><div><div className="font-semibold">{selected.contacts?.name || selected.contacts?.phone}</div><div className="text-xs text-[#667781]">Online - Business Model</div></div></div>

            <div className="flex-1 overflow-y-auto p-5" style={{backgroundImage:`url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`}}>
              <div className="mx-auto flex max-w- flex-col gap-1">
                {messages.map((m:any) => (
                  <div key={m.id} className={`flex ${m.sender_type==="agent"?"justify-end":"justify-start"}`}>
                    <div className={`relative max-w-[65%] rounded-[7.5px] px-2.5 pt-1.5 pb-5 shadow text-[14.2px] ${m.sender_type==="agent"?"bg-[#d9fdd3]":"bg-white"}`}>{m.content}<span className="absolute bottom-1 right-2 text- text-[#667781]">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            {/* COMPOSER - MESSAGE + VOICE */}
            <div className="flex h- items-center gap-3 bg-[#f0f2f5] px-4">
              <button className="text-[#54656f] text-">😊</button>
              <button className="text-[#54656f] text-">📎</button>
              <div className="flex flex-1 items-center rounded- bg-white px-3 py-2">
                <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Type a message" className="w-full bg-transparent text- outline-none" />
              </div>
              {newMessage.trim()? (
                <button onClick={sendMessage} className="flex h- w- items-center justify-center rounded-full bg-[#25d366] text-white text-">➤</button>
              ) : (
                <button onClick={recording? stopRecording : startRecording} className={`flex h- w- items-center justify-center rounded-full text-white text- ${recording?"bg-red-500 animate-pulse":"bg-[#25d366]"}`}>{recording?"■":"🎤"}</button>
              )}
            </div>
            {recording && <div className="bg-red-50 text-red-600 text-center text-xs py-1">Recording... Click ■ to stop and send voice</div>}
          </>
        )}
      </div>
    </div>
  );
}