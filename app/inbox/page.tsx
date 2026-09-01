"use client"
import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, any>>({})

  // 1. Fetch conversations + contacts + last message
  const fetchConversations = async () => {
    const { data: convs, error } = await supabase
     .from("conversations")
     .select(`
        id,
        contact_id,
        last_message_at,
        unread_count,
        contacts ( name, phone )
      `)
     .order("last_message_at", { ascending: false })

    if (error) {
      console.error("CONVERSATIONS ERROR:", error)
      return
    }
    setConversations(convs || [])

    // fetch last message for each conversation for preview
    if (convs?.length) {
      const { data: msgs } = await supabase
       .from("messages")
       .select("conversation_id, content, message_type, audio_url, media_url, created_at")
       .in("conversation_id", convs.map((c: any) => c.id))
       .order("created_at", { ascending: false })

      const map: any = {}
      msgs?.forEach((m: any) => {
        if (!map[m.conversation_id]) map[m.conversation_id] = m
      })
      setLastMessages(map)
    }
  }

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
     .from("messages")
     .select("*")
     .eq("conversation_id", convId)
     .order("created_at", { ascending: true })
    setMessages(data || [])
  }

  useEffect(() => {
    fetchConversations()

    const channel = supabase
     .channel("inbox-realtime")
     .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations()
        if (selectedId) fetchMessages(selectedId)
      })
     .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        fetchConversations()
      })
     .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedId])

  const getPreview = (msg: any) => {
    if (!msg) return ""
    if (msg.audio_url || msg.message_type === "audio") return "Voice message"
    if (msg.media_url) return "📎 Media"
    return msg.content?.slice(0, 35) || ""
  }

  return (
    <div className="flex h-screen">
      {/* MIDDLE PANEL - Chat List */}
      <div className="w- border-r bg-white overflow-y-auto">
        {conversations.map((conv) => {
          const contactName = conv.contacts?.name || conv.contacts?.phone || "Unknown"
          const preview = getPreview(lastMessages[conv.id])
          return (
            <div
              key={conv.id}
              onClick={() => { setSelectedId(conv.id); fetchMessages(conv.id) }}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedId === conv.id? "bg-green-50" : ""}`}
            >
              <div className="flex justify-between">
                <p className="font-semibold">{contactName}</p>
                {conv.unread_count > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">{conv.unread_count}</span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{preview}</p>
              <p className="text-xs text-gray-400">{conv.contacts?.phone}</p>
            </div>
          )
        })}
      </div>

      {/* RIGHT PANEL - Messages */}
      <div className="flex-1 flex flex-col bg-gray-100">
        {!selectedId? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Select a chat</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[70%] p-2 rounded ${m.sender_type === "user"? "bg-green-100 ml-auto" : "bg-white"}`}>
                {(m.audio_url || m.media_url) && (m.message_type === "audio" || m.audio_url)? (
                  <audio controls src={m.audio_url || m.media_url} className="w-" preload="metadata" />
                ) : m.media_url? (
                  <a href={m.media_url} target="_blank" className="text-blue-500">View Media</a>
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}