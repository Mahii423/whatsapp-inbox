"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Contact = { id:string; name:string; phone:string; avatar_url?: string };
type Conv = { id:string; contact_id:string; contacts:Contact|null; last_message_at:string; last_msg?:string; unread?:number }
type Msg = { id:string; conversation_id:string; content:string; sender_type:string; created_at:string; status?:string }

export default function InboxPage(){
  const [convs,setConvs]=useState<Conv[]>([]);
  const [selected,setSelected]=useState<Conv|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [newMsg,setNewMsg]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<'all'|'unread'|'favorites'|'groups'>('all');
  const endRef=useRef<HTMLDivElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  // Load conversations with live last message
  useEffect(()=>{
    (async()=>{
      const {data: convsRaw} = await supabase.from("conversations").select("id,contact_id,last_message_at").order("last_message_at",{ascending:false}).limit(100);
      if(!convsRaw?.length) return;
      const contactIds = convsRaw.map(c=>c.contact_id);
      const {data: contactsRaw} = await supabase.from("contacts").select("id,name,phone,avatar_url").in("id",contactIds);
      const {data: lastMsgs} = await supabase.from("messages").select("conversation_id,content,created_at,sender_type").in("conversation_id", convsRaw.map(c=>c.id)).order("created_at",{ascending:false});

      const merged:Conv[] = convsRaw.map((c:any)=>{
        const contact = contactsRaw?.find(x=>x.id===c.contact_id)||{id:c.contact_id, name:c.contact_id, phone:c.contact_id};
        const last = lastMsgs?.filter((m:any)=>m.conversation_id===c.id)[0];
        // for demo unread
        const unread = Math.random()>0.6? Math.floor(Math.random()*3)+1 : 0;
        return { id:c.id, contact_id:c.contact_id, contacts:contact as any, last_message_at: last?.created_at || c.last_message_at, last_msg: last?.content || contact.phone, unread: unread };
      });
      setConvs(merged);
      if(merged.length>0) setSelected(merged[0]);
    })();
  },[]);

  // Load messages
  useEffect(()=>{
    if(!selected?.id) return;
    (async()=>{
      const {data} = await supabase.from("messages").select("*").eq("conversation_id",selected.id).order("created_at",{ascending:true});
      if(data) setMessages(data as any);
    })();
  },[selected]);

  // Realtime - last message update jaisa original WhatsApp
  useEffect(()=>{
    const channel = supabase.channel('inbox-live')
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(payload:any)=>{
        const m = payload.new as Msg;
        // update conv list
        setConvs(prev=> prev.map(c=>{
          if(c.id===m.conversation_id){
            return {...c, last_msg:m.content, last_message_at:m.created_at, unread: c.id!==selected?.id? (c.unread||0)+1 : 0 };
          }
          return c;
        }).sort((a,b)=> new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
        // update current chat
        if(selected?.id===m.conversation_id){
          setMessages(prev=>[...prev,m]);
        }
      }).subscribe();
    return ()=>{ supabase.removeChannel(channel); }
  },[selected]);

  async function send(){
    if(!newMsg.trim()||!selected) return;
    const text=newMsg; setNewMsg("");
    const temp:Msg = {id:Date.now().toString(), conversation_id:selected.id, content:text, sender_type:'agent', created_at:new Date().toISOString(), status:'sent'};
    setMessages(p=>[...p,temp]);
    setConvs(prev=> prev.map(c=> c.id===selected.id? {...c, last_msg:text, last_message_at:new Date().toISOString()} : c).sort((a,b)=> new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
    await fetch("/api/send-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversation_id:selected.id,message:text})});
  }

  const filtered = useMemo(()=>{
    let list = [...convs];
    if(search) list = list.filter(c=> c.contacts?.name.toLowerCase().includes(search.toLowerCase()) || c.contacts?.phone.includes(search));
    if(filter==='unread') list = list.filter(c=> (c.unread||0)>0);
    return list;
  },[convs,search,filter]);

  const unreadCount = convs.reduce((a,c)=>a+(c.unread||0),0);

  return(
    <div className="flex w-full bg-white rounded-2xl border overflow-hidden shadow-sm" style={{height:'calc(100vh - 75px)'}}>
      <style>{`
       .wa-scroll{ overflow-y:auto; overflow-x:hidden; }
       .wa-scroll::-webkit-scrollbar{ width:6px; }
       .wa-scroll::-webkit-scrollbar-thumb{ background:#c1c1c1; border-radius:10px; }
       .wa-scroll::-webkit-scrollbar-track{ background:transparent; }
       .wa-scroll{ scrollbar-width:thin; scrollbar-color:#c1c1c1 transparent; }
      `}</style>

      {/* LEFT - EXACT WA WEB */}
      <div className="w- flex flex-col bg-white border-r shrink-0">
        {/* Header */}
        <div className="h- px-4 flex items-center justify-between bg-[#f0f2f5]">
          <h1 className="font-bold text-">WhatsApp</h1>
          <div className="flex gap-2 text-[#54656f] text-xl">
            <button className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center">⧉</button>
            <button className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center">⋮</button>
          </div>
        </div>

        <div className="p-3 bg-white space-y-3">
          <div className="relative">
            <span className="absolute left-3 top- text-[#54656f] text-">⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat" className="w-full bg-[#f0f2f5] rounded- pl-10 pr-3 py- text- outline-none placeholder-[#667781]"/>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={()=>setFilter('all')} className={`px-3 py- rounded-full text- font-medium whitespace-nowrap ${filter==='all'?'bg-[#e7fce3] text-[#008a6c]':'bg-[#f0f2f5] text-[#54656f]'}`}>All</button>
            <button onClick={()=>setFilter('unread')} className={`px-3 py- rounded-full text- font-medium whitespace-nowrap ${filter==='unread'?'bg-[#e7fce3] text-[#008a6c]':'bg-[#f0f2f5] text-[#54656f]'}`}>Unread {unreadCount>0?unreadCount:''}</button>
            <button className="px-3 py- rounded-full text- font-medium whitespace-nowrap bg-[#f0f2f5] text-[#54656f]">Favorites</button>
            <button className="px-3 py- rounded-full text- font-medium whitespace-nowrap bg-[#f0f2f5] text-[#54656f]">Groups</button>
            <button className="w-7 h-7 rounded-full bg-[#f0f2f5] text-[#54656f] flex items-center justify-center shrink-0">+</button>
          </div>
        </div>

        {/* Chat List - with live last message like original */}
        <div ref={scrollRef} className="flex-1 wa-scroll">
          {filtered.map(c=>{
            const isActive = selected?.id===c.id;
            const time = new Date(c.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const dateLabel = new Date(c.last_message_at).toDateString()===new Date().toDateString()? time : new Date(c.last_message_at).toLocaleDateString();
            return(
              <div key={c.id} onClick={()=>{setSelected(c); setConvs(prev=>prev.map(x=>x.id===c.id?{...x,unread:0}:x))}} className={`h- px-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] border-t border-[#f0f2f5] ${isActive?'bg-[#f0f2f5]':''}`}>
                <img src={c.contacts?.avatar_url||`https://ui-avatars.com/api/?name=${encodeURIComponent(c.contacts?.name||'U')}&background=${isActive?'#dfe5e7':'#dfe5e7'}&color=#54656f`} className="w- h- rounded-full shrink-0" alt=""/>
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex justify-between items-center">
                    <span className="font-[400] text- leading-5 truncate text-[#111b21]">{c.contacts?.name||c.contacts?.phone}</span>
                    <span className="text- text-[#667781] shrink-0 ml-2">{dateLabel}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[#53bdeb] text-">✓✓</span>
                      <span className="text- text-[#667781] truncate">{c.last_msg}</span>
                    </div>
                    {c.unread? <span className="bg-[#25d366] text-white text- min-w- h-5 rounded-full flex items-center justify-center px-1.5 font-bold ml-2">{c.unread}</span> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT - Chat */}
      <div className="flex-1 flex flex-col" style={{backgroundColor:'#efeae2', backgroundImage:`url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`, backgroundSize:'contain'}}>
        {!selected? <div className="flex-1 flex items-center justify-center text-[#667781]">Select a chat</div> : (
          <>
            {/* Top Bar - exact WA */}
            <div className="h- bg-[#f0f2f5] border-l px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center font-bold text-[#54656f]">{selected.contacts?.name?.[0]?.toUpperCase()||'O'}</div>
                <div><div className="font-semibold text- text-[#111b21]">{selected.contacts?.name||selected.contacts?.phone}</div><div className="text- text-[#667781]">{selected.contacts?.phone}</div></div>
              </div>
              <div className="flex items-center gap-1">
                <button className="border bg-white rounded-full px-3 py-1 text-">◧ Add to list ⌄</button>
                <button className="w-10 h-10 flex items-center justify-center text-[#54656f]">⌕</button>
                <button className="w-8 h-8 flex items-center justify-center text-[#54656f]">⋮</button>
              </div>
            </div>

            {/* Messages - Original WA bubble style */}
            <div className="flex-1 wa-scroll p-5 space-y-1">
              {messages.map(m=>(
                <div key={m.id} className={`flex ${m.sender_type==='agent'?'justify-end':'justify-start'}`}>
                  <div className={`relative max-w-[65%] rounded-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-2 pt- pb- ${m.sender_type==='agent'?'bg-[#d9fdd3] rounded-tr-none':'bg-white rounded-tl-none'}`}>
                    <span className="text-[14.2px] leading- text-[#111b21] whitespace-pre-wrap break-words">{m.content}</span>
                    <span className="inline-block float-right ml-3 mt- -mb-1 select-none">
                      <span className="text- leading- text-[#667781]">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                      {m.sender_type==='agent'&&<span className="text- text-[#53bdeb] ml-1">✓✓</span>}
                    </span>
                    <div className="clear-both"></div>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>

            {/* Input - Original WA Web */}
            <div className="bg-[#f0f2f5] px-4 py- flex items-center gap-3 shrink-0 border-l">
              <button className="text- text-[#54656f] w-7 h-7 flex items-center justify-center">+</button>
              <button className="text- text-[#54656f] w-7 h-7 flex items-center justify-center">☺</button>
              <div className="flex-1 bg-white rounded- px-4 py- flex items-center"><input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Type a message" className="flex-1 text- outline-none placeholder-[#667781]"/><button className="ml-2 text-[#54656f]">🙂</button></div>
              <button className="text-[#54656f] text-">◷</button>
              <button className="text-[#54656f] text-">📎</button>
              {newMsg.trim()? <button onClick={send} className="w-10 h-10 bg-[#25d366] rounded-full flex items-center justify-center text-white text-">➤</button> : <button className="w-10 h-10 flex items-center justify-center text-[#54656f] text-">🎙️</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}