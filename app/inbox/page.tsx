"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Contact = {
  id: string;
  name: string;
  phone: string;
  avatar_url?: string;
};

type Conversation = {
  id: string;
  contact_id: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_favorite?: boolean;
  is_group?: boolean;
  contacts: Contact;
};

type Message = {
  id: string;
  conversation_id: string;
  content: string;
  sender: "agent" | "user";
  created_at: string;
  status: "sent" | "delivered" | "read";
};

const FILTERS = ["All", "Unread", "Favorites", "Groups"] as const;

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId]
  );

  // 1. Fetch Conversations
  const fetchConversations = async () => {
    const { data, error } = await supabase
     .from("conversations")
     .select("*, contacts(*)")
     .order("last_message_at", { ascending: false });
    if (!error && data) setConversations(data as any);
  };

  useEffect(() => {
    fetchConversations();

    // 4. REALTIME: Last message and time live update
    const channel = supabase
     .channel("whatsapp-inbox-realtime")
     .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations()
      )
     .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          // Update messages if selected chat is same
          if (msg.conversation_id === selectedId) {
            setMessages((prev) => [...prev, msg]);
          }
          fetchConversations();
        }
      )
     .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Fetch Messages for selected chat
  useEffect(() => {
    if (!selectedId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
       .from("messages")
       .select("*")
       .eq("conversation_id", selectedId)
       .order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    };
    fetchMessages();
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter + Search Logic
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.contacts.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contacts.phone.includes(searchQuery);
      if (!matchesSearch) return false;
      if (activeFilter === "Unread") return c.unread_count > 0;
      if (activeFilter === "Favorites") return c.is_favorite;
      if (activeFilter === "Groups") return c.is_group;
      return true;
    });
  }, [conversations, searchQuery, activeFilter]);

  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unread_count > 0? 1 : 0), 0);

  const handleSend = async () => {
    if (!newMessage.trim() ||!selectedId ||!selectedConv) return;

    const tempMsg: Message = {
      id: Date.now().toString(),
      conversation_id: selectedId,
      content: newMessage,
      sender: "agent",
      created_at: new Date().toISOString(),
      status: "sent",
    };

    setMessages(prev => [...prev, tempMsg]);
    setNewMessage("");

    // Call your API route
    await fetch("/api/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: selectedId,
        phone: selectedConv.contacts.phone,
        message: tempMsg.content,
      }),
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21] font-[Segoe_UI,Helvetica_Lucida_Grande,Lucida_Sans_Unicode,sans-serif]">

      {/* LEFT PANEL */}
      <div className="flex w-[30%] min-w- max-w- flex-col border-r border-[#e9edef] bg-white">
        {/* 1. Left Header */}
        <div className="flex h- items-center justify-between bg-[#f0f2f5] px-4">
          <h1 className="text- font-bold text-[#111b21]">WhatsApp</h1>
          <div className="flex gap-5 text-[#54656f]">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12.072 0a12.072 12.072 0 0 0-12.072 12.072c0 5.115 3.22 9.485 7.745 11.177l-0.53-4.66a7.44 7.44 0 0 1-2.28-5.37c0-4.11 3.33-7.44 7.44-7.44s7.44 3.33 7.44 7.44a7.44 7.44 0 0 1-4.21 6.69l-0.53 4.66c4.525-1.692 7.745-6.062 7.745-11.177C24.144 5.403 18.74 0 12.072 0z"/></svg>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3">
          <div className="flex h- items-center gap-3 rounded- bg-[#f0f2f5] px-3">
            <svg viewBox="0 0 24 24" width="18" height="18" className="text-[#54656f]"><path fill="currentColor" d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.003 4.002 1.195-1.195-4.002-4.003zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/></svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full bg-transparent text- text-[#111b21] outline-none placeholder:text-[#667781]"
            />
          </div>
        </div>

        {/* 2. Filters Chips */}
        <div className="flex gap-2 overflow-x-auto bg-white px-3 pb-3 scrollbar-none">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex h- shrink-0 items-center justify-center rounded-full px-3 text- transition ${
                activeFilter === filter
                 ? "bg-[#e7fce3] text-[#008069]"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
              }`}
            >
              {filter} {filter === "Unread" && unreadTotal > 0? ` ${unreadTotal}` : ""}
            </button>
          ))}
          <button className="flex h- w- shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f]">+</button>
        </div>

        {/* 3. Chat List */}
        <div className="wa-scroll flex-1 overflow-y-auto bg-white">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`flex h- cursor-pointer items-center gap-3 px-3 hover:bg-[#f5f6f6] ${
                selectedId === conv.id? "bg-[#f0f2f5]" : ""
              }`}
            >
              <img
                src={conv.contacts.avatar_url || `https://i.pravatar.cc/150?u=${conv.contacts.phone}`}
                className="h- w- rounded-full object-cover"
                alt="avatar"
              />
              <div className="flex flex-1 flex-col justify-center border-t border-[#e9edef] py-3">
                <div className="flex justify-between">
                  <span className="text- leading- text-[#111b21]">{conv.contacts.name}</span>
                  <span className="text- leading- text-[#667781]">
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="text-[#53bdeb] text-">✓✓</span>
                    <span className="truncate text- leading- text-[#667781]">{conv.last_message}</span>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="flex h- min-w- items-center justify-center rounded-full bg-[#25d366] px- text- font-medium text-white">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT CHAT PANEL */}
      <div className="flex flex-1 flex-col">
        {selectedConv? (
          <>
            {/* 5. Top bar 59px */}
            <div className="flex h- items-center justify-between bg-[#f0f2f5] px-4">
              <div className="flex items-center gap-3">
                <img src={selectedConv.contacts.avatar_url || `https://i.pravatar.cc/150?u=${selectedConv.contacts.phone}`} className="h- w- rounded-full" alt="" />
                <div>
                  <div className="text- font-semibold text-[#111b21]">{selectedConv.contacts.name}</div>
                  <div className="text- text-[#667781]">{selectedConv.contacts.phone}</div>
                </div>
              </div>
              <button className="rounded- border border-[#e9edef] bg-white px-3 py-1.5 text- text-[#008069]">+ Add to list</button>
            </div>

            {/* Chat Background #efeae2 with doodle */}
            <div className="relative flex-1 overflow-y-auto bg-[#efeae2] p-5 wa-scroll"
                 style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`, backgroundRepeat: 'repeat' }}>

              <div className="mx-auto flex max-w- flex-col gap-1">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === "agent"? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-[65%] rounded-[7.5px] px- pb- pt- shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                        msg.sender === "agent"? "bg-[#d9fdd3]" : "bg-white"
                      }`}
                    >
                      {/* Bubble Text MUST 14.2px */}
                      <span className="bubble-text whitespace-pre-wrap break-words text-[14.2px] leading- text-[#111b21]">
                        {msg.content}
                        <span className="invisible ml-2 text-">00:00 ✓✓</span>
                      </span>
                      {/* Bubble Time MUST 11px float-right inside bubble, no overlap */}
                      <span className="bubble-time absolute bottom- right- float-right ml-2 flex items-end gap-1 text- leading- text-[#667781]">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.sender === "agent" && <span className="text-[#53bdeb]">✓✓</span>}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input bar #f0f2f5 */}
            <div className="flex h- items-center gap-3 bg-[#f0f2f5] px-4">
              <button className="text- text-[#54656f]">+</button>
              <button className="text-[#54656f]"><svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 20.4a8.4 8.4 0 1 1 0-16.8 8.4 8.4 0 0 1 0 16.8z"/></svg></button>

              <div className="flex flex-1 items-center rounded- bg-white px-3 py-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message"
                  className="w-full bg-transparent text- text-[#111b21] outline-none placeholder:text-[#667781]"
                />
              </div>

              <button className="text-[#54656f]"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M1.5 4.5A2.5 2.5 0 0 1 4 2h16a2.5 2.5 0 0 1 2.5 2.5v15A2.5 2.5 0 0 1 20 22H4a2.5 2.5 0 0 1-2.5-2.5v-15z"/></svg></button>

              <button onClick={handleSend} className="flex h- w- items-center justify-center rounded-full bg-[#25d366] text-white">
                {newMessage? (
                  <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11.999 14.942c2.349 0 4.252-1.903 4.252-4.252S14.348 6.438 11.999 6.438s-4.252 1.903-4.252 4.252 1.903 4.252 4.252 4.252z"/></svg>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#f0f2f5] text-[#667781]">Select a chat to start messaging</div>
        )}
      </div>

      <style jsx global>{`
       .wa-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
       .wa-scroll::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
       .wa-scroll::-webkit-scrollbar-track { background: transparent; }
       .scrollbar-none::-webkit-scrollbar { display: none; }
       .bubble-text { font-family: Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, sans-serif; }
       .bubble-time { font-family: Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, sans-serif; }
      `}</style>
    </div>
  );
}