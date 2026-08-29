"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
};

type Conversation = {
  id: string;
  status: string;
  last_message_at: string | null;
  contacts: Contact | Contact[] | null;
};

type Message = {
  id: string;
  content: string | null;
  sender_type: string;
  created_at: string;
};

export default function Home() {
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", user.id)
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace error:", workspaceError);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        status,
        last_message_at,
        contacts (
          id,
          name,
          phone,
          email
        )
      `)
      .eq("workspace_id", workspace.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Conversation error:", error);
      setLoading(false);
      return;
    }

    setConversations(data || []);

    if (data && data.length > 0) {
      setSelectedChat(data[0]);
      loadMessages(data[0].id);
    }

    setLoading(false);
  }

  async function loadMessages(conversationId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Message error:", error);
      return;
    }

    setMessages(data || []);
  }

  function getContact(chat: Conversation) {
    if (Array.isArray(chat.contacts)) {
      return chat.contacts[0] || null;
    }

    return chat.contacts;
  }

  function selectConversation(chat: Conversation) {
    setSelectedChat(chat);
    loadMessages(chat.id);
  }

  async function sendMessage() {
    if (!message.trim() || !selectedChat) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedChat.id,
      sender_type: "agent",
      sender_id: user?.id,
      message_type: "text",
      content: message.trim(),
    });

    if (error) {
      console.error("Send message error:", error);
      return;
    }

    setMessage("");
    loadMessages(selectedChat.id);
  }

  const customer = selectedChat
    ? getContact(selectedChat)
    : null;

  return (
    <main className="inbox">

      <aside className="sidebar">

        <div className="brand">
          <div className="logo">W</div>

          <div>
            <h1>WhatsApp Inbox</h1>
            <span>Customer Support</span>
          </div>
        </div>

        <div className="search">
          <input placeholder="Search conversations..." />
        </div>

        <div className="tabs">
          <button className="active">All</button>
          <button>Unread</button>
          <button>Assigned</button>
        </div>

        <div className="chat-list">

          {loading && (
            <p style={{ padding: "20px" }}>
              Loading conversations...
            </p>
          )}

          {!loading && conversations.length === 0 && (
            <p style={{ padding: "20px" }}>
              No conversations yet.
            </p>
          )}

          {conversations.map((chat) => {

            const contact = getContact(chat);

            const name =
              contact?.name ||
              contact?.phone ||
              "Unknown Customer";

            return (
              <button
                key={chat.id}
                className={`chat-item ${
                  selectedChat?.id === chat.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => selectConversation(chat)}
              >

                <div className="avatar">
                  {name.charAt(0).toUpperCase()}
                </div>

                <div className="chat-info">

                  <div className="chat-top">
                    <strong>{name}</strong>
                  </div>

                  <div className="chat-bottom">
                    <span>
                      {chat.status}
                    </span>
                  </div>

                </div>

              </button>
            );
          })}

        </div>

      </aside>


      <section className="conversation">

        {selectedChat ? (

          <>

            <header className="conversation-header">

              <div className="avatar large">
                {(customer?.name ||
                  customer?.phone ||
                  "?")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <h2>
                  {customer?.name ||
                    customer?.phone ||
                    "Unknown Customer"}
                </h2>

                <span className="online">
                  ● Connected
                </span>

              </div>

              <div className="header-actions">
                <button>☎</button>
                <button>⋮</button>
              </div>

            </header>


            <div className="messages">

              <div className="date">
                Conversation
              </div>

              {messages.length === 0 && (
                <p style={{ textAlign: "center" }}>
                  No messages yet.
                </p>
              )}

              {messages.map((msg) => (

                <div
                  key={msg.id}
                  className={`message ${
                    msg.sender_type === "agent"
                      ? "sent"
                      : "received"
                  }`}
                >

                  <p>{msg.content}</p>

                  <small>
                    {new Date(
                      msg.created_at
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>

                </div>

              ))}

            </div>


            <div className="message-box">

              <button className="icon-btn">
                ＋
              </button>

              <input
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
              />

              <button
                className="send-btn"
                onClick={sendMessage}
              >
                ➤
              </button>

            </div>

          </>

        ) : (

          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <h2>No conversation selected</h2>
          </div>

        )}

      </section>


      <aside className="details">

        {selectedChat && (

          <>

            <div className="details-avatar">
              {(customer?.name ||
                customer?.phone ||
                "?")
                .charAt(0)
                .toUpperCase()}
            </div>

            <h2>
              {customer?.name ||
                customer?.phone ||
                "Unknown Customer"}
            </h2>

            <span className="online">
              ● Connected
            </span>


            <div className="detail-card">

              <h3>Customer Details</h3>

              <p>
                <b>Phone</b>
                <br />
                {customer?.phone ||
                  "Not available"}
              </p>

              <p>
                <b>Email</b>
                <br />
                {customer?.email ||
                  "Not available"}
              </p>

            </div>


            <div className="detail-card">

              <h3>Conversation</h3>

              <p>
                <b>Status:</b>{" "}
                {selectedChat.status}
              </p>

              <p>
                <b>Assigned to:</b> Admin
              </p>

              <p>
                <b>Source:</b> WhatsApp
              </p>

            </div>

          </>

        )}

      </aside>

    </main>
  );
}