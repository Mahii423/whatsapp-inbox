"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Conv = { id: string; contact_id: string; contacts: { id:string; name:string; phone:string; avatar_url?: string } | null; last_message_at: string; unread_count?: number; last_msg?: string; labels?: string[] }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string; status?: string; type?: 'text'|'voice'; audioUrl?: string; duration?: number }

const LABELS = [
  { id: 'new', name: 'New customer', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'pending', name: 'Payment pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'paid', name: 'Paid', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'vip', name: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];
const QUICK_REPLIES = ["Hello! 👋 How can I help you today?", "Your order is confirmed ✅ Thank you!", "Payment link: https://mahiwa.shop/pay", "We are open 9am - 9pm!", "Thanks for contacting MahiWA 🙏"];

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<'all'|'unread'>('all');
  const [showQuick, setShowQuick] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages]);

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
      const merged = convsRaw.map((conv,i)=>{
        const ct = contactsRaw?.find(x=>x.id===conv.contact_id) || null;
        const lm = lastMsgs?.find(m=>m.conversation_id===conv.id);
        return {...conv, contacts: ct, last_msg: lm?.content || "", unread_count: Math.random() > 0.7? Math.floor(Math.random()*3)+1 : 0, labels: i%3===0? ['new']:[]} as Conv;
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

  async function sendMessage(textOverride?: string) {
    const text = textOverride || newMsg;
    if (!text.trim() ||!selected) return;
    setNewMsg(""); setShowQuick(false);
    setMessages(prev => [...prev, { id: Date.now().toString(), conversation_id: selected.id, content: text, sender_type: 'agent', created_at: new Date().toISOString(), status: 'sent', type: 'text' } as any]);
    await fetch("/api/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: selected.id, message: text }) });
  }

  function toggleLabel(labelId: string) {
    if(!selected) return;
    const updated = convs.map(c=>{
      if(c.id===selected.id){
        const has = c.labels?.includes(labelId);
        const newLabels = has? c.labels?.filter(l=>l!==labelId) : [...(c.labels||[]), labelId];
        return {...c, labels: newLabels};
      }
      return c;
    });
    setConvs(updated);
    const sel = updated.find(c=>c.id===selected.id);
    if(sel) setSelected(sel);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data) };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setMessages(prev => [...prev, { id: Date.now().toString(), conversation_id: selected!.id, content: '🎙️ Voice message', sender_type: 'agent', created_at: new Date().toISOString(), type: 'voice', audioUrl: url, duration: recTime } as any]);
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start(); setIsRecording(true); setRecTime(0);
      timerRef.current = setInterval(()=> setRecTime(s=>s+1), 1000);
    } catch(e){ alert("Mic permission deni hogi"); }
  }
  function stopRecording() { mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); }
  function cancelRecording() { mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); setRecTime(0); }
  function togglePlay(msg: Msg) {
    if(playingId===msg.id){ audioRef.current?.pause(); setPlayingId(null); return; }
    if(audioRef.current) audioRef.current.pause();
    const audio = new Audio(msg.audioUrl); audioRef.current = audio;
    audio.onended = ()=> setPlayingId(null); audio.play(); setPlayingId(msg.id);
  }

  const filtered = useMemo(()=>{
    let list = convs;
    if(filter==='unread') list = list.filter(c=> (c.unread_count||0) >0 );
    if(search) list = list.filter(c=> c.contacts?.name.toLowerCase().includes(search.toLowerCase()) || c.contacts?.phone.includes(search));
    return list;
  },[convs, search, filter]);

  if (hasWhatsApp === false) {
    return (<div className="p-10 bg-white rounded-2xl border text-center"><h2 className="text-xl font-bold mb-2">WhatsApp Connect Nahi Hai</h2><Link href="/integrations" className="bg-green-600 text-white px-6 py-3 rounded-full text-sm font-semibold">Connect with Facebook</Link></div>);
  }

  return (
    <>
      <style>{`
       .wa-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
       .wa-scroll::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
       .wa-scroll::-webkit-scrollbar-track { background: transparent; }
       .wa-scroll { scrollbar-width: thin; scrollbar-color: #c1c1c1 transparent; }
      `}</style>
      <div className="flex w-full bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 80px)' }}>
        {/* LEFT LIST */}
        <div className="w- border-r flex flex-col shrink-0 bg-white">
          <div className="p-3 border-b bg-white space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold text-">Chats</h2><span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{filtered.length}</span></div>
            <div className="relative"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full bg-[#f0f2f5] rounded-lg pl-9 pr-3 py-2.5 text- outline-none" /><span className="absolute left-3 top-2.5 text-gray-400">⌕</span></div>
            <div className="flex gap-2"><button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter==='all'?'bg-[#e7fce3] text-green-700':'bg-gray-100 text-gray-600'}`}>All</button><button onClick={()=>setFilter('unread')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter==='unread'?'bg-[#e7fce3] text-green-700':'bg-gray-100 text-gray-600'}`}>Unread</button></div>
          </div>
          <div className="flex-1 overflow-y-auto wa-scroll">
            {filtered.map(c => (
              <div key={c.id} onClick={()=>setSelected(c)} className={`p-3 border-b border-gray-50 flex gap-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?'bg-[#f0f2f5]':''}`}>
                <img src={c.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.contacts?.name || 'U')}&background=25D366&color=fff`} className="w-12 h-12 rounded-full shrink-0" alt="" />
                <div className="flex-1 min-w-0"><div className="flex justify-between"><div className="font-semibold text- truncate pr-2">{c.contacts?.name || c.contacts?.phone}</div><div className="text- text-gray-500 shrink-0">{new Date(c.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div><div className="text- text-gray-500 truncate mt-0.5">{c.last_msg || c.contacts?.phone}</div></div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT CHAT */}
        <div className="flex-1 flex flex-col relative" style={{ backgroundColor: '#efeae2', backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")` }}>
          {!selected? (<div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a chat</div>) : (
            <>
              <div className="h- bg-[#f0f2f5] border-b px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><img src={selected.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.contacts?.name || 'U')}`} className="w-10 h-10 rounded-full" alt="" /><div><div className="font-semibold text-">{selected.contacts?.name}</div><div className="text- text-gray-500">{selected.contacts?.phone} • online</div></div></div>
                <div className="relative"><button onClick={()=>setShowLabelPicker(!showLabelPicker)} className="text-xs bg-white border px-3 py-1.5 rounded-full">🏷️ Label</button>
                  {showLabelPicker && (<div className="absolute right-0 top-9 w-56 bg-white rounded-xl shadow-lg border p-2 z-10">{LABELS.map(l=>(<div key={l.id} onClick={()=>toggleLabel(l.id)} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"><span className={`text-xs px-2 py-1 rounded-full border ${l.color}`}>{l.name}</span><span className="text-xs">{selected.labels?.includes(l.id)?'✓':''}</span></div>))}</div>)}</div>
              </div>

              <div className="flex-1 overflow-y-auto wa-scroll p-4 md:p-6 space-y-1.5">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                    {m.type==='voice'? (
                      <div className={`flex items-center gap-3 rounded- px-3 py-2.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-[72%] ${m.sender_type==='agent'?'bg-[#d9fdd3]':'bg-white'}`}>
                        <button onClick={()=>togglePlay(m)} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#25D366] text-white">{playingId===m.id?'❚❚':'▶'}</button>
                        <div className="flex items-center gap- w-24 h-6">{[...Array(18)].map((_,i)=><div key={i} className="w- rounded-full bg-green-600" style={{height: `${6+Math.random()*18}px`}}></div>)}</div>
                        <div className="text- text-gray-500 min-w- text-right">{Math.floor((m.duration||0)/60)}:{String((m.duration||0)%60).padStart(2,'0')}<div className="text- flex items-center justify-end gap-1">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}<span className="text-[#53bdeb]">✓✓</span></div></div>
                      </div>
                    ) : (
                      <div className={`relative max-w-[65%] rounded- px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${m.sender_type==='agent'?'bg-[#d9fdd3] rounded-tr-none':'bg-white rounded-tl-none'}`}>
                        <div className="text-[14.2px] leading- text-[#111b21] whitespace-pre-wrap break-words pr-1">
                          {m.content}
                          <span className="inline-block w- h-0"></span>
                        </div>
                        <div className="absolute bottom- right- flex items-center gap-1 select-none">
                          <span className="text- text-[#667781] leading-none">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                          {m.sender_type==='agent' && <span className="text- text-[#53bdeb] leading-none ml-0.5">✓✓</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {showQuick && (<div className="bg-white border-t p-2 grid grid-cols-1 gap-1 max-h-40 overflow-y-auto wa-scroll">{QUICK_REPLIES.map((q,i)=>(<button key={i} onClick={()=>sendMessage(q)} className="text-left text- bg-gray-50 hover:bg-green-50 px-3 py-2 rounded-lg border">⚡ {q}</button>))}</div>)}

              <div className="bg-[#f0f2f5] p-3 flex gap-3 items-center border-t">
                <button onClick={()=>setShowQuick(!showQuick)} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${showQuick?'bg-green-600 text-white':'bg-white border text-gray-600'}`}>⚡</button>
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
                    {newMsg.trim()? (<button onClick={()=>sendMessage()} className="w-11 h-11 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow shrink-0">➤</button>) : (<button onClick={startRecording} className="w-11 h-11 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow shrink-0">🎙️</button>)}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}