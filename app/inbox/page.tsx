"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Conv = { id: string; contact_id: string; contacts: { id:string; name:string; phone:string; avatar_url?: string } | null; last_message_at: string; unread_count?: number; last_msg?: string; }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string; status?: string; type?: 'text'|'voice'; audioUrl?: string; duration?: number }

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<'all'|'unread'>('all');

  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function load() {
      const { data: acc } = await supabase.from("whatsapp_accounts").select("id").limit(1).maybeSingle();
      if (!acc) { setHasWhatsApp(false); return; }
      setHasWhatsApp(true);
      const { data: convsRaw } = await supabase.from("conversations").select("id, contact_id, last_message_at").order("last_message_at", { ascending: false }).limit(100);
      if (!convsRaw || convsRaw.length===0) return;
      const contactIds = convsRaw.map(c=>c.contact_id);
      const { data: contactsRaw } = await supabase.from("contacts").select("id,name,phone,avatar_url").in("id", contactIds);
      const { data: lastMsgs } = await supabase.from("messages").select("conversation_id,content,created_at").in("conversation_id", convsRaw.map(c=>c.id)).order("created_at", {ascending:false});
      const merged = convsRaw.map(conv=>{
        const ct = contactsRaw?.find(x=>x.id===conv.contact_id) || null;
        const lm = lastMsgs?.find(m=>m.conversation_id===conv.id);
        return {...conv, contacts: ct, last_msg: lm?.content || "", unread_count: Math.random() > 0.7? Math.floor(Math.random()*3)+1 : 0 } as Conv;
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
      if (data) setMessages(data.map(d=>({...d, type: 'text'})) as any);
    }
    loadMsgs();
  }, [selected]);

  async function sendMessage() {
    if (!newMsg.trim() ||!selected) return;
    const text = newMsg; setNewMsg("");
    setMessages(prev => [...prev, { id: Date.now().toString(), conversation_id: selected.id, content: text, sender_type: 'agent', created_at: new Date().toISOString(), status: 'sent', type: 'text' } as any]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: selected.id, message: text }) });
  }

  // Voice functions
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data) };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = recTime;
        setMessages(prev => [...prev, { id: Date.now().toString(), conversation_id: selected!.id, content: '🎙️ Voice message', sender_type: 'agent', created_at: new Date().toISOString(), type: 'voice', audioUrl: url, duration } as any]);
        // Upload to API if you have: await fetch("/api/send-voice", {method:"POST", body: formData})
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();
      setIsRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(()=> setRecTime(s=>s+1), 1000);
    } catch(e){ alert("Mic permission deni hogi"); }
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  }
  function cancelRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
    setRecTime(0);
    chunksRef.current = [];
  }

  function togglePlay(msg: Msg) {
    if(playingId===msg.id){ audioRef.current?.pause(); setPlayingId(null); return; }
    if(audioRef.current) audioRef.current.pause();
    const audio = new Audio(msg.audioUrl);
    audioRef.current = audio;
    audio.onended = ()=> setPlayingId(null);
    audio.play();
    setPlayingId(msg.id);
  }

  const filtered = useMemo(()=>{
    let list = convs;
    if(filter==='unread') list = list.filter(c=> (c.unread_count||0) >0 );
    if(search) list = list.filter(c=> c.contacts?.name.toLowerCase().includes(search.toLowerCase()) || c.contacts?.phone.includes(search));
    return list;
  },[convs, search, filter]);

  if (hasWhatsApp === false) {
    return (
      <div className="p-10 bg-white rounded-2xl border text-center">
        <h2 className="text-xl font-bold mb-2">WhatsApp Connect Nahi Hai</h2>
        <p className="text-sm text-gray-500 mb-6">Pehle WhatsApp API connect karo.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/integrations" className="bg-green-600 text-white px-6 py-3 rounded-full text-sm font-semibold">Connect with Facebook</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="w- border-r flex flex-col shrink-0 bg-white">
        <div className="p-3 border-b bg-white space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold text-">Chats</h2><span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{filtered.length}</span></div>
          <div className="relative"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full bg-[#f0f2f5] rounded-lg pl-9 pr-3 py-2.5 text- outline-none" /><span className="absolute left-3 top-2.5 text-gray-400">⌕</span></div>
          <div className="flex gap-2">
            <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter==='all'?'bg-[#e7fce3] text-green-700':'bg-gray-100 text-gray-600'}`}>All</button>
            <button onClick={()=>setFilter('unread')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter==='unread'?'bg-[#e7fce3] text-green-700':'bg-gray-100 text-gray-600'}`}>Unread</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <div key={c.id} onClick={()=>setSelected(c)} className={`p-3 border-b border-gray-50 flex gap-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?'bg-[#f0f2f5]':''}`}>
              <img src={c.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.contacts?.name || 'U')}&background=25D366&color=fff`} className="w-12 h-12 rounded-full shrink-0" alt="" />
              <div className="flex-1 min-w-0"><div className="flex justify-between"><div className="font-semibold text- truncate pr-2">{c.contacts?.name || c.contacts?.phone}</div><div className="text- text-gray-500">{new Date(c.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div><div className="flex justify-between items-center mt-1"><div className="text- text-gray-500 truncate">{c.last_msg || c.contacts?.phone}</div>{c.unread_count? <div className="bg-[#25D366] text-white text- min-w- h-5 rounded-full flex items-center justify-center px-1.5 font-bold">{c.unread_count}</div> : null}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative" style={{ backgroundColor: '#efeae2', backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")` }}>
        {!selected? (<div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a chat</div>) : (
          <>
            <div className="h- bg-[#f0f2f5] border-b px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3"><img src={selected.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.contacts?.name || 'U')}`} className="w-10 h-10 rounded-full" alt="" /><div><div className="font-semibold text-">{selected.contacts?.name}</div><div className="text- text-gray-500">{selected.contacts?.phone} • online</div></div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                  {m.type==='voice'? (
                    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 shadow-sm max-w-[70%] ${m.sender_type==='agent'?'bg-[#d9fdd3]':'bg-white'}`}>
                      <button onClick={()=>togglePlay(m)} className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.sender_type==='agent'?'bg-[#25D366] text-white':'bg-green-600 text-white'}`}>{playingId===m.id?'❚❚':'▶'}</button>
                      <div className="flex items-center gap- w-24 h-6">
                        {[...Array(18)].map((_,i)=><div key={i} className={`w- rounded-full ${m.sender_type==='agent'?'bg-green-600':'bg-gray-400'}`} style={{height: `${6+Math.random()*18}px`, opacity: playingId===m.id?1:0.6}}></div>)}
                      </div>
                      <div className="text- text-gray-600 min-w-">{Math.floor((m.duration||0)/60)}:{String((m.duration||0)%60).padStart(2,'0')}</div>
                    </div>
                  ) : (
                    <div className={`relative rounded-lg px-3 py-2 text- max-w-[65%] shadow-sm ${m.sender_type==='agent'?'bg-[#d9fdd3] rounded-tr-none':'bg-white rounded-tl-none'}`}>
                      <div className="pr-12">{m.content}</div>
                      <div className="flex items-center gap-1 absolute bottom-1 right-2 text- text-gray-500"><span>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>{m.sender_type==='agent' && <span className="text-blue-500">✓✓</span>}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Bar with Voice */}
            <div className="bg-[#f0f2f5] p-3 flex gap-3 items-center border-t">
              {isRecording? (
                <div className="flex-1 flex items-center gap-3 bg-white rounded-full px-4 py-2.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="text-sm text-gray-700 flex-1">{Math.floor(recTime/60)}:{String(recTime%60).padStart(2,'0')} recording...</div>
                  <button onClick={cancelRecording} className="text-xs text-gray-500 px-3">Cancel</button>
                  <button onClick={stopRecording} className="w-8 h-8 bg-[#25D366] text-white rounded-full flex items-center justify-center">➤</button>
                </div>
              ) : (
                <>
                  <div className="flex-1 bg-white rounded-full flex items-center px-4">
                    <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Type a message" className="flex-1 py-3 text- outline-none" />
                  </div>
                  {newMsg.trim()? (
                    <button onClick={sendMessage} className="w-11 h-11 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow">➤</button>
                  ) : (
                    <button onClick={startRecording} className="w-11 h-11 bg-[#25D366] hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow" title="Hold to record">🎙️</button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}