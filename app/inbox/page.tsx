"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Conv = { id: string; contact_id: string; contacts: { id:string; name:string; phone:string; avatar_url?: string } | null; last_message_at: string; last_msg?: string }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string; type?: 'text'|'voice'; audioUrl?: string; duration?: number }

const QUICK = ["Hello! 👋 How can I help?", "Order confirmed ✅", "Payment link: https://mahiwa.shop/pay", "We are open 9am-9pm", "Thanks for contacting MahiWA 🙏"];

export default function InboxPage(){
  const [convs,setConvs]=useState<Conv[]>([]);
  const [selected,setSelected]=useState<Conv|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [newMsg,setNewMsg]=useState("");
  const [search,setSearch]=useState("");
  const [showQuick,setShowQuick]=useState(false);
  const [isRecording,setIsRecording]=useState(false);
  const [recTime,setRecTime]=useState(0);
  const mediaRecorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const timerRef=useRef<any>(null);
  const [playingId,setPlayingId]=useState<string|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const endRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  useEffect(()=>{
    (async()=>{
      const {data: convsRaw} = await supabase.from("conversations").select("id,contact_id,last_message_at").order("last_message_at",{ascending:false}).limit(100);
      if(!convsRaw?.length) return;
      const contactIds = convsRaw.map(c=>c.contact_id);
      const {data: contactsRaw} = await supabase.from("contacts").select("id,name,phone,avatar_url").in("id",contactIds);
      const {data: lastMsgs} = await supabase.from("messages").select("conversation_id,content").in("conversation_id", convsRaw.map(c=>c.id)).order("created_at",{ascending:false});
      const merged = convsRaw.map(c=>({...c, contacts: contactsRaw?.find(x=>x.id===c.contact_id)||null, last_msg: lastMsgs?.find(m=>m.conversation_id===c.id)?.content||"" }));
      setConvs(merged as any);
      if(merged.length>0) setSelected(merged[0] as any);
    })();
  },[]);

  useEffect(()=>{
    if(!selected?.id) return;
    (async()=>{
      const {data} = await supabase.from("messages").select("*").eq("conversation_id",selected.id).order("created_at",{ascending:true});
      if(data) setMessages(data.map(d=>({...d,type:'text'})) as any);
    })();
  },[selected]);

  async function send(t?:string){
    const text=t||newMsg; if(!text.trim()||!selected) return;
    setNewMsg(""); setShowQuick(false);
    setMessages(p=>[...p,{id:Date.now().toString(), conversation_id:selected.id, content:text, sender_type:'agent', created_at:new Date().toISOString(), type:'text'} as any]);
    fetch("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversation_id:selected.id,message:text})});
  }

  async function startRec(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream); mediaRecorderRef.current=mr; chunksRef.current=[];
      mr.ondataavailable=e=>{if(e.data.size>0) chunksRef.current.push(e.data)};
      mr.onstop=()=>{const blob=new Blob(chunksRef.current,{type:'audio/webm'}); const url=URL.createObjectURL(blob); setMessages(p=>[...p,{id:Date.now().toString(),conversation_id:selected!.id,content:'Voice',sender_type:'agent',created_at:new Date().toISOString(),type:'voice',audioUrl:url,duration:recTime} as any]); stream.getTracks().forEach(t=>t.stop())};
      mr.start(); setIsRecording(true); setRecTime(0); timerRef.current=setInterval(()=>setRecTime(s=>s+1),1000);
    }catch{ alert("Mic allow karo"); }
  }
  const stopRec=()=>{ mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); };
  const togglePlay=(m:Msg)=>{ if(playingId===m.id){audioRef.current?.pause(); setPlayingId(null); return;} audioRef.current?.pause(); const a=new Audio(m.audioUrl); audioRef.current=a; a.onended=()=>setPlayingId(null); a.play(); setPlayingId(m.id); };

  const filtered=useMemo(()=>convs.filter(c=>!search||c.contacts?.name?.toLowerCase().includes(search.toLowerCase())||c.contacts?.phone?.includes(search)),[convs,search]);

  return(
    <div className="flex w-full bg-white rounded-2xl border overflow-hidden shadow-sm" style={{height:'calc(100vh - 80px)'}}>
      <style>{`
       .wa-scroll{ overflow-y:auto; overflow-x:hidden; }
       .wa-scroll::-webkit-scrollbar{ width:5px; }
       .wa-scroll::-webkit-scrollbar-thumb{ background:#d1d7db; border-radius:10px; }
       .wa-scroll::-webkit-scrollbar-track{ background:transparent; }
       .bubble-text{ font-size:14.2px; line-height:19px; color:#111b21; }
       .bubble-time{ font-size:11px; line-height:12px; color:#667781; }
      `}</style>

      {/* LEFT */}
      <div className="w- border-r flex flex-col bg-white shrink-0">
        <div className="p-3 border-b space-y-3"><h2 className="font-bold text-">Chats</h2><div className="relative"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full bg-[#f0f2f5] rounded-lg pl-9 pr-3 py-2.5 text- outline-none"/><span className="absolute left-3 top-2.5 text-gray-500">⌕</span></div></div>
        <div className="flex-1 wa-scroll">
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>setSelected(c)} className={`p-3 border-b border-[#f0f2f5] flex gap-3 cursor-pointer hover:bg-[#f5f6f6] ${selected?.id===c.id?'bg-[#f0f2f5]':''}`}>
              <img src={c.contacts?.avatar_url||`https://ui-avatars.com/api/?name=${encodeURIComponent(c.contacts?.name||'U')}&background=25D366&color=fff`} className="w-12 h-12 rounded-full shrink-0" alt=""/>
              <div className="flex-1 min-w-0"><div className="flex justify-between"><span className="font-semibold text- truncate">{c.contacts?.name||c.contacts?.phone}</span><span className="text- text-[#667781] ml-2 shrink-0">{new Date(c.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div><div className="text- text-[#667781] truncate">{c.last_msg||c.contacts?.phone}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex-1 flex flex-col" style={{backgroundColor:'#efeae2', backgroundImage:`url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`}}>
        {!selected? <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a chat</div> : (
          <>
            <div className="h- bg-[#f0f2f5] border-b px-4 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#dfdede] flex items-center justify-center font-bold text-sm">{selected.contacts?.name?.substring(0,2).toUpperCase()||'OB'}</div>
              <div><div className="font-semibold text- leading-5">{selected.contacts?.name}</div><div className="text- text-[#667781] leading-4">{selected.contacts?.phone}</div></div>
            </div>

            <div className="flex-1 wa-scroll p-4 space-y-">
              {messages.map(m=>(
                <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[65%] rounded-[7.5px] px-2 py-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${m.sender_type==='agent'?'bg-[#d9fdd3]':'bg-white'}`}>
                    {m.type==='voice'?(
                      <div className="flex items-center gap-3 py-1 px-1">
                        <button onClick={()=>togglePlay(m)} className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">{playingId===m.id?'❚❚':'▶'}</button>
                        <div className="flex items-center gap- w- h-5">{[...Array(20)].map((_,i)=><div key={i} className="w- bg-[#008a6c] rounded-full" style={{height:`${6+Math.random()*14}px`}}></div>)}</div>
                        <span className="bubble-time">{Math.floor((m.duration||0)/60)}:{String((m.duration||0)%60).padStart(2,'0')}</span>
                      </div>
                    ):(
                      <div className="flex flex-wrap items-end gap-x-2">
                        <span className="bubble-text whitespace-pre-wrap break-words">{m.content}</span>
                        <span className="bubble-time ml-auto flex items-center gap-1 pt- whitespace-nowrap">
                          {new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                          {m.sender_type==='agent'&&<span className="text-[#53bdeb] text-">✓✓</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>

            {showQuick&&<div className="bg-white border-t p-2 space-y-1 max-h-32 wa-scroll">{QUICK.map((q,i)=><button key={i} onClick={()=>send(q)} className="w-full text-left text- bg-[#f0f2f5] hover:bg-[#e7fce3] px-3 py-2 rounded-lg">⚡ {q}</button>)}</div>}

            <div className="bg-[#f0f2f5] p- flex gap-2 items-center">
              <button onClick={()=>setShowQuick(!showQuick)} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${showQuick?'bg-[#008a6c] text-white':'bg-white text-[#54656f]'}`}>⚡</button>
              {isRecording?(
                <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-3"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div><span className="text- flex-1">{recTime}s recording</span><button onClick={stopRec} className="w-8 h-8 bg-[#00a884] text-white rounded-full flex items-center justify-center">➤</button></div>
              ):(
                <>
                  <div className="flex-1 bg-white rounded-full px-4 flex items-center"><input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Type a message" className="w-full py- text-[14.2px] outline-none placeholder-[#667781]"/><button className="ml-2 text-[#54656f]">😊</button></div>
                  {newMsg.trim()? <button onClick={()=>send()} className="w- h- bg-[#00a884] hover:bg-[#008a6c] text-white rounded-full flex items-center justify-center shrink-0">➤</button> : <button onClick={startRec} className="w- h- bg-[#00a884] text-white rounded-full flex items-center justify-center shrink-0">🎙️</button>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}