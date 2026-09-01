"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Conv = { id: string; contact_id: string; contacts: any; last_message_at: string; last_msg?: string }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string; type?: 'text'|'voice'; audioUrl?: string; duration?: number }

const QUICK_REPLIES = ["Hello! 👋 How can I help you?", "Order confirmed ✅", "Payment link: https://mahiwa.shop/pay", "Open 9am-9pm", "Thanks 🙏"];

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[messages]);

  useEffect(() => {
    (async()=>{
      const { data: convsRaw } = await supabase.from("conversations").select("id, contact_id, last_message_at").order("last_message_at", { ascending: false }).limit(50);
      if(!convsRaw?.length) return;
      const contactIds = convsRaw.map(c=>c.contact_id);
      const { data: contactsRaw } = await supabase.from("contacts").select("id,name,phone,avatar_url").in("id", contactIds);
      const { data: lastMsgs } = await supabase.from("messages").select("conversation_id,content").in("conversation_id", convsRaw.map(c=>c.id)).order("created_at",{ascending:false});
      const merged = convsRaw.map(c=>({...c, contacts: contactsRaw?.find(x=>x.id===c.contact_id)||null, last_msg: lastMsgs?.find(m=>m.conversation_id===c.id)?.content || "" }));
      setConvs(merged as any); if(merged.length>0) setSelected(merged[0] as any);
    })();
  },[]);

  useEffect(() => {
    if(!selected?.id) return;
    (async()=>{
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", selected.id).order("created_at",{ascending:true});
      if(data) setMessages(data.map(d=>({...d, type:'text'})) as any);
    })();
  },[selected]);

  async function sendMessage(t?:string){
    const text = t||newMsg; if(!text.trim()||!selected) return;
    setNewMsg(""); setShowQuick(false);
    setMessages(p=>[...p,{id:Date.now().toString(), conversation_id:selected.id, content:text, sender_type:'agent', created_at:new Date().toISOString(), type:'text'} as any]);
    fetch("/api/send-message",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({conversation_id:selected.id, message:text})});
  }

  async function startRecording(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const mr = new MediaRecorder(stream); mediaRecorderRef.current=mr; chunksRef.current=[];
      mr.ondataavailable=e=>{if(e.data.size>0) chunksRef.current.push(e.data)};
      mr.onstop=()=>{const blob=new Blob(chunksRef.current,{type:'audio/webm'}); const url=URL.createObjectURL(blob); setMessages(p=>[...p,{id:Date.now().toString(), conversation_id:selected!.id, content:'Voice', sender_type:'agent', created_at:new Date().toISOString(), type:'voice', audioUrl:url, duration:recTime} as any]); stream.getTracks().forEach(t=>t.stop())};
      mr.start(); setIsRecording(true); setRecTime(0); timerRef.current=setInterval(()=>setRecTime(s=>s+1),1000);
    }catch{ alert("Mic allow karo"); }
  }
  const stopRecording=()=>{ mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); };
  const togglePlay=(m:Msg)=>{ if(playingId===m.id){audioRef.current?.pause(); setPlayingId(null); return;} audioRef.current?.pause(); const a=new Audio(m.audioUrl); audioRef.current=a; a.onended=()=>setPlayingId(null); a.play(); setPlayingId(m.id); };

  const filtered = useMemo(()=> convs.filter(c=>!search || c.contacts?.name?.toLowerCase().includes(search.toLowerCase()) || c.contacts?.phone?.includes(search)), [convs,search]);

  return (
    <div className="flex w-full bg-white rounded-2xl border overflow-hidden shadow-sm" style={{height:'calc(100vh - 80px)'}}>
      <style>{`
       .chat-scroll { overflow-y: auto; }
       .chat-scroll::-webkit-scrollbar { width: 6px; }
       .chat-scroll::-webkit-scrollbar-thumb { background: #bfbfbf; border-radius: 3px; }
       .chat-scroll::-webkit-scrollbar-track { background: transparent; }
       .chat-scroll { scrollbar-width: thin; scrollbar-color: #bfbfbf transparent; }
      `}</style>

      {/* LEFT */}
      <div className="w- border-r flex flex-col bg-white shrink-0">
        <div className="p-3 border-b space-y-3">
          <h2 className="font-bold text-">Chats</h2>
          <div className="relative"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full bg-[#f0f2f5] rounded-lg pl-9 pr-3 py-2.5 text- outline-none"/><span className="absolute left-3 top-2.5">⌕</span></div>
        </div>
        <div className="flex-1 chat-scroll">
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>setSelected(c)} className={`p-3 border-b flex gap-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?'bg-[#f0f2f5]':''}`}>
              <img src={c.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${c.contacts?.name||'U'}&background=25D366&color=fff`} className="w-12 h-12 rounded-full" alt=""/>
              <div className="flex-1 min-w-0"><div className="flex justify-between"><span className="font-semibold text- truncate">{c.contacts?.name||c.contacts?.phone}</span><span className="text- text-gray-500 shrink-0 ml-2">{new Date(c.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div><div className="text- text-gray-500 truncate">{c.last_msg}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT - FIXED BUBBLE */}
      <div className="flex-1 flex flex-col" style={{backgroundColor:'#efeae2', backgroundImage:`url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`}}>
        {!selected? <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a chat</div> : (
          <>
            <div className="h- bg-[#f0f2f5] border-b px-4 flex items-center gap-3 shrink-0">
              <img src={selected.contacts?.avatar_url || `https://ui-avatars.com/api/?name=${selected.contacts?.name||'U'}`} className="w-10 h-10 rounded-full" alt=""/>
              <div><div className="font-semibold text-">{selected.contacts?.name}</div><div className="text-xs text-gray-500">{selected.contacts?.phone}</div></div>
            </div>

            <div className="flex-1 chat-scroll p-5 space-y-2">
              {messages.map(m=>(
                <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                  <div className={`rounded-lg px-3 pt-2 pb-1 shadow-sm max-w-[65%] ${m.sender_type==='agent'?'bg-[#d9fdd3]':'bg-white'}`}>
                    {/* MESSAGE TEXT */}
                    <div className="text-[14.2px] leading-[19.5px] text-[#111b21] whitespace-pre-wrap break-words">
                      {m.type==='voice'? (
                        <div className="flex items-center gap-3 py-1">
                          <button onClick={()=>togglePlay(m)} className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center">{playingId===m.id?'❚❚':'▶'}</button>
                          <div className="flex gap-">{[...Array(20)].map((_,i)=><div key={i} className="w- bg-green-700 rounded-full" style={{height:`${5+Math.random()*16}px`}}></div>)}</div>
                          <span className="text-xs text-gray-600">{Math.floor((m.duration||0)/60)}:{String((m.duration||0)%60).padStart(2,'0')}</span>
                        </div>
                      ) : m.content}
                    </div>
                    {/* TIME - NO OVERLAP, SEPARATE ROW, RIGHT ALIGNED */}
                    <div className="flex justify-end items-center gap-1 mt-1 ml-6">
                      <span className="text- text-[#667781]">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                      {m.sender_type==='agent' && <span className="text- text-[#53bdeb]">✓✓</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>

            {showQuick && <div className="bg-white border-t p-2 space-y-1 max-h-32 chat-scroll">{QUICK_REPLIES.map((q,i)=><button key={i} onClick={()=>sendMessage(q)} className="w-full text-left text- bg-gray-50 hover:bg-green-50 px-3 py-2 rounded-lg border">⚡ {q}</button>)}</div>}

            <div className="bg-[#f0f2f5] p-3 flex gap-2 items-center border-t">
              <button onClick={()=>setShowQuick(!showQuick)} className={`w-9 h-9 rounded-full flex items-center justify-center ${showQuick?'bg-green-600 text-white':'bg-white border'}`}>⚡</button>
              {isRecording? (
                <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-3"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div><span className="text-sm flex-1">{recTime}s</span><button onClick={()=>{mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current);}} className="w-8 h-8 bg-green-600 text-white rounded-full">➤</button></div>
              ):(
                <>
                  <div className="flex-1 bg-white rounded-full px-4"><input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Type a message" className="w-full py-3 text- outline-none"/></div>
                  {newMsg.trim()? <button onClick={()=>sendMessage()} className="w-11 h-11 bg-[#25D366] text-white rounded-full">➤</button> : <button onClick={startRecording} className="w-11 h-11 bg-[#25D366] text-white rounded-full">🎙️</button>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}