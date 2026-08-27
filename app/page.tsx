"use client";

import { useState } from "react";

const chats = [
  { name: "Muhammad Ali", message: "Assalam o Alaikum", time: "10:42 AM", unread: 2 },
  { name: "Ahmed Khan", message: "Order ka kya bana?", time: "10:18 AM", unread: 0 },
  { name: "Sarah", message: "Thank you!", time: "9:55 AM", unread: 0 },
  { name: "Usman", message: "Can you help me?", time: "9:21 AM", unread: 5 },
];

export default function Home() {
  const [selectedChat, setSelectedChat] = useState(chats[0]);
  const [message, setMessage] = useState("");

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessage("");
  };

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
          {chats.map((chat) => (
            <button
              className={`chat-item ${
                selectedChat.name === chat.name ? "selected" : ""
              }`}
              key={chat.name}
              onClick={() => setSelectedChat(chat)}
            >
              <div className="avatar">{chat.name.charAt(0)}</div>

              <div className="chat-info">
                <div className="chat-top">
                  <strong>{chat.name}</strong>
                  <small>{chat.time}</small>
                </div>

                <div className="chat-bottom">
                  <span>{chat.message}</span>
                  {chat.unread > 0 && (
                    <b className="unread">{chat.unread}</b>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="conversation">
        <header className="conversation-header">
          <div className="avatar large">
            {selectedChat.name.charAt(0)}
          </div>

          <div>
            <h2>{selectedChat.name}</h2>
            <span className="online">● Online</span>
          </div>

          <div className="header-actions">
            <button>☎</button>
            <button>⋮</button>
          </div>
        </header>

        <div className="messages">
          <div className="date">Today</div>

          <div className="message received">
            <p>{selectedChat.message}</p>
            <small>10:42 AM</small>
          </div>

          <div className="message sent">
            <p>Wa Alaikum Assalam! How can I help you?</p>
            <small>10:43 AM ✓✓</small>
          </div>
        </div>

        <div className="message-box">
          <button className="icon-btn">＋</button>

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type a message..."
          />

          <button className="send-btn" onClick={sendMessage}>
            ➤
          </button>
        </div>
      </section>

      <aside className="details">
        <div className="details-avatar">
          {selectedChat.name.charAt(0)}
        </div>

        <h2>{selectedChat.name}</h2>
        <span className="online">● Online</span>

        <div className="detail-card">
          <h3>Customer Details</h3>
          <p><b>Phone</b><br />+92 300 1234567</p>
          <p><b>Email</b><br />customer@example.com</p>
        </div>

        <div className="detail-card">
          <h3>Conversation</h3>
          <p><b>Status:</b> Open</p>
          <p><b>Assigned to:</b> Admin</p>
          <p><b>Source:</b> WhatsApp</p>
        </div>
      </aside>
    </main>
  );
}