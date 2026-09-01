"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "../../utils/supabase/client";
const supabase = createClient();

export default function InboxPage(){
  const [convs,setConvs]=useState<any[]>([]);
  const [sel,setSel]=useState<any>(null);
  const [msgs,setMsgs]=useState<any[]>([]);
  const [txt,setTxt]=useState("");
  const endRef=useRef<HTMLDivElement>(null);

  const loadConvs=async()=>{
    const {data} = await supabase.from("conversations").select("*, contacts(*)").order("last_message_at",{ascending:false}).limit(50);
    if(data) setConvs(data);
  };
  const loadMsgs=async(id:string)=>{
    const {data} = await supabase.from("messages").select("*").eq("conversation_id",id).order("created_at",{ascending:true}).limit(200);
    if(data) setMsgs(data);
  };

  useEffect(()=>{loadConvs();},[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  useEffect(()=>{if(sel) loadMsgs(sel.id);},[sel]);

  useEffect(()=>{
    if(!sel) return;
    const ch=supabase.channel(`c-${sel.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${sel.id}`},p=>{
      setMsgs(m=>[...m,p.new]);
    }).subscribe();
    return ()=>{supabase.removeChannel(ch);};
  },[sel]);

  // global listener for new convs
  useEffect(()=>{
    const ch=supabase.channel('all-conv').on('postgres_changes',{event:'*',schema:'public',table:'conversations'},()=>loadConvs()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(p)=>{
      loadConvs();
      if(sel && p.new.conversation_id===sel.id) setMsgs(m=>[...m,p.new]);
    }).subscribe();
    return ()=>{supabase.removeChannel(ch);};
  },[sel]);

  const send=async()=>{
    if(!txt.trim()||!sel) return;
    const t=txt; setTxt("");
    setMsgs(m=>[...m,{id:Date.now(),content:t,sender_type:"agent",created_at:new Date().toISOString()}]);
    await fetch("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:sel.id,message:t})});
  };

  return(
    <div className="flex h-[calc(100vh-48px)] w-full bg-white -m-6 overflow-hidden">
      <div className="w- border-r flex flex-col">
        <div className="h- bg-[#f0f2f5] px-4 flex items-center font-bold text-">Chats - LIVE ●</div>
        <div className="flex-1 overflow-auto">
          {convs.map((c:any)=>(
            <div key={c.id} onClick={()=>setSel(c)} className={`p-3 border-b cursor-pointer hover:bg-gray-100 flex gap-3 ${sel?.id===c.id?"bg-[#f0f2f5]":""}`}>
              <div className="w-10 h-10 bg-green-600 rounded-full text-white flex items-center justify-center font-bold">{(c.contacts?.name||c.contacts?.phone||"C")[0]}</div>
              <div className="flex-1 overflow-hidden"><div className="font-semibold truncate">{c.contacts?.name||c.contacts?.phone}</div><div className="text- text-gray-500 truncate">{c.last_message_text}</div></div>
              {c.unread_count>0&&<span className="bg-green-500 text-white text-xs rounded-full px-2 h-5 flex items-center">{c.unread_count}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {!sel?<div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">Select a chat</div>:(
          <>
            <div className="h- bg-[#f0f2f5] px-4 flex items-center gap-3"><div className="w-9 h-9 bg-green-600 rounded-full text-white flex items-center justify-center font-bold">{(sel.contacts?.name||"")[0]}</div><div><div className="font-bold">{sel.contacts?.name}</div><div className="text-xs text-gray-500">{sel.contacts?.phone}</div></div></div>
            <div className="flex-1 overflow-auto p-4 bg-[#efeae2]" style={{backgroundImage:"url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"}}>
              <div className="max-w- mx-auto flex flex-col gap-2">
                {msgs.map((m:any)=>(
                  <div key={m.id} className={`flex ${m.sender_type==="agent"?"justify-end":"justify-start"}`}>
                    <div className={`px-3 py-2 rounded-lg max-w-[70%] shadow ${m.sender_type==="agent"?"bg-[#d9fdd3]":"bg-white"}`}>
                      {m.audio_url||m.media_url||m.message_type==="audio"?<audio controls src={m.audio_url||m.media_url} className="w-"/>:<span className="text- whitespace-pre-wrap">{m.content}</span>}
                      <div className="text- text-gray-500 text-right mt-1">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                ))}
                <div ref={endRef}/>
              </div>
            </div>
            <div className="h- bg-[#f0f2f5] flex items-center gap-2 px-3"><input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message" className="flex-1 bg-white rounded-full px-4 py-2 outline-none"/><button onClick={send} className="bg-[#00a884] text-white w-10 h-10 rounded-full">➤</button></div>
          </>
        )}
      </div>
    </div>
  );
}