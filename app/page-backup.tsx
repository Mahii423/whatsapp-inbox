"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  contact_id?: string;
  contacts: Contact | null;
};

type Message = {
  id: string;
  content: string | null;
  sender_type: string;
  created_at: string | null;
};

type Workspace = {
  id: string;
  name: string;
};

export default function Home() {
  const supabase = createClient();

  const selectedIdRef = useRef<string | null>(null);
  const workspaceIdsRef = useRef<string[]>([]);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    selectedIdRef.current = selectedChat?.id ?? null;
  }, [selectedChat]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!workspace) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          void loadConversations(workspaceIdsRef.current);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          const conversationId =
            selectedIdRef.current;

          if (conversationId) {
            void loadMessages(conversationId);
          }

          void loadConversations(
            workspaceIdsRef.current
          );
        }
      )
      .subscribe((status) => { console.log("Realtime status:", status); });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspace?.id]);

  async function bootstrap() {
    setLoading(true);
    setStatus("");

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    const user = userData.user;

    if (userError || !user) {
      setStatus(
        "Please sign in to see your inbox."
      );
      setLoading(false);
      return;
    }

    const {
      data: ownedWorkspace,
      error: workspaceError,
    } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (workspaceError || !ownedWorkspace) {
      console.error(
        "Workspace error:",
        workspaceError
      );

      setStatus(
        workspaceError?.message ||
          "Workspace not found."
      );

      setLoading(false);
      return;
    }

    setWorkspace(ownedWorkspace);

    const {
      data: whatsappAccounts,
      error: whatsappError,
    } = await supabase
      .from("whatsapp_accounts")
      .select(
        "id, workspace_id, phone_number_id"
      )
      .eq(
        "workspace_id",
        ownedWorkspace.id
      );

    if (whatsappError) {
      console.error(
        "WhatsApp account error:",
        whatsappError
      );
    }

    setWhatsappConnected(
      (whatsappAccounts || []).length > 0
    );

    const ids = [ownedWorkspace.id];

    workspaceIdsRef.current = ids;

    await loadConversations(ids);

    setLoading(false);
  }

  function contactFromChat(
    chat: Conversation
  ) {
    return chat.contacts || null;
  }

  async function loadConversations(
    workspaceIds: string[]
  ) {
    if (workspaceIds.length === 0) {
      setConversations([]);
      setSelectedChat(null);
      setMessages([]);
      return;
    }

    const {
      data: conversationRows,
      error,
    } = await supabase
      .from("conversations")
      .select(
        "id, status, last_message_at, contact_id"
      )
      .in(
        "workspace_id",
        workspaceIds
      )
      .order("last_message_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Conversation error:",
        error
      );

      setStatus(error.message);
      return;
    }

    const rows =
      (conversationRows || []) as Conversation[];

    const contactIds = rows
      .map((row) => row.contact_id)
      .filter(
        (id): id is string =>
          Boolean(id)
      );

    let contactsById: Record<
      string,
      Contact
    > = {};

    if (contactIds.length > 0) {
      const {
        data: contactRows,
        error: contactError,
      } = await supabase
        .from("contacts")
        .select(
          "id, name, phone, email"
        )
        .in(
          "id",
          contactIds
        );

      if (contactError) {
        console.error(
          "Contact error:",
          contactError
        );
      } else {
        contactsById =
          Object.fromEntries(
            (contactRows || []).map(
              (contact) => [
                contact.id,
                contact,
              ]
            )
          );
      }
    }

    const conversationsWithContacts =
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        last_message_at:
          row.last_message_at,
        contact_id:
          row.contact_id,
        contacts: row.contact_id
          ? contactsById[
              row.contact_id
            ] || null
          : null,
      }));

    setConversations(
      conversationsWithContacts
    );

    const selectedId =
      selectedIdRef.current;

    const stillSelected =
      conversationsWithContacts.find(
        (row) =>
          row.id === selectedId
      );

    const nextChat =
      stillSelected ||
      conversationsWithContacts[0] ||
      null;

    if (!nextChat) {
      setSelectedChat(null);
      setMessages([]);
      return;
    }

    selectedIdRef.current =
      nextChat.id;

    setSelectedChat(nextChat);

    await loadMessages(
      nextChat.id
    );
  }

  async function loadMessages(
    conversationId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .select(
        "id, content, sender_type, created_at"
      )
      .eq(
        "conversation_id",
        conversationId
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Message error:",
        error
      );

      setStatus(error.message);
      return;
    }

    setMessages(data || []);
  }

  function getContact(
    chat: Conversation
  ) {
    return contactFromChat(chat);
  }

  function selectConversation(
    chat: Conversation
  ) {
    selectedIdRef.current =
      chat.id;

    setSelectedChat(chat);

    void loadMessages(chat.id);
  }

  async function connectWhatsApp(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !workspace ||
      !phoneNumberId.trim()
    ) {
      return;
    }

    const { error } =
      await supabase
        .from("whatsapp_accounts")
        .insert({
          workspace_id:
            workspace.id,
          phone_number_id:
            phoneNumberId.trim(),
        });

    if (error) {
      setStatus(error.message);
      return;
    }

    setWhatsappConnected(true);

    setStatus(
      "WhatsApp number connect ho gaya. Ab webhook messages yahan aayenge."
    );
  }

  async function sendMessage() {
    if (
      !message.trim() ||
      !selectedChat
    ) {
      return;
    }

    const text = message.trim();

    setStatus("Sending...");

    try {
      const response = await fetch(
        "/api/send-message",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            conversationId:
              selectedChat.id,
            message: text,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "WhatsApp send error:",
          data
        );

        setStatus(
          data?.error ||
            "Message send nahi hua."
        );

        return;
      }

      setMessage("");

      setStatus(
        "Message sent successfully."
      );

      await loadMessages(
        selectedChat.id
      );
    } catch (error) {
      console.error(
        "Send request error:",
        error
      );

      setStatus(
        "Message send nahi hua."
      );
    }
  }

  const customer = selectedChat
    ? getContact(selectedChat)
    : null;

  return (
    <main className="inbox">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            W
          </div>

          <div>
            <h1>
              WhatsApp Inbox
            </h1>

            <span>
              Customer Support
            </span>
          </div>
        </div>

        {!whatsappConnected && (
          <form
            className="connect-box"
            onSubmit={
              connectWhatsApp
            }
          >
            <p>
              WhatsApp Cloud API
              Phone Number ID
              connect karein
            </p>

            <input
              value={
                phoneNumberId
              }
              onChange={(e) =>
                setPhoneNumberId(
                  e.target.value
                )
              }
              placeholder="Phone number ID"
            />

            <button type="submit">
              Connect
            </button>
          </form>
        )}

        {status && (
          <p className="inbox-status">
            {status}
          </p>
        )}

        <div className="search">
          <input
            placeholder="Search conversations..."
          />
        </div>

        <div className="tabs">
          <button className="active">
            All
          </button>

          <button>
            Unread
          </button>

          <button>
            Assigned
          </button>
        </div>

        <div className="chat-list">
          {loading && (
            <p
              style={{
                padding: "20px",
              }}
            >
              Loading conversations...
            </p>
          )}

          {!loading &&
            conversations.length ===
              0 && (
              <p
                style={{
                  padding: "20px",
                }}
              >
                No conversations yet.
                WhatsApp se message
                bhejo, phir yahan
                dikhega.
              </p>
            )}

          {conversations.map(
            (chat) => {
              const contact =
                getContact(chat);

              const name =
                contact?.name ||
                contact?.phone ||
                "Unknown Customer";

              const chatClassName =
                selectedChat?.id ===
                chat.id
                  ? "chat-item selected"
                  : "chat-item";

              return (
                <button
                  key={chat.id}
                  className={chatClassName}
                  onClick={() =>
                    selectConversation(
                      chat
                    )
                  }
                >
                  <div className="avatar">
                    {name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="chat-info">
                    <div className="chat-top">
                      <strong>
                        {name}
                      </strong>
                    </div>

                    <div className="chat-bottom">
                      <span>
                        {chat.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </aside>

      <section className="conversation">
        {selectedChat ? (
          <>
            <header className="conversation-header">
              <div className="avatar large">
                {(
                  customer?.name ||
                  customer?.phone ||
                  "?"
                )
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
                <button>
                  ☎
                </button>

                <button>
                  ⋮
                </button>
              </div>
            </header>

            <div className="messages">
              <div className="date">
                Conversation
              </div>

              {messages.length ===
                0 && (
                <p
                  style={{
                    textAlign:
                      "center",
                  }}
                >
                  No messages yet.
                </p>
              )}

              {messages.map(
                (msg) => {
                  const messageClassName =
                    msg.sender_type ===
                    "agent"
                      ? "message sent"
                      : "message received";

                  return (
                    <div
                      key={msg.id}
                      className={
                        messageClassName
                      }
                    >
                      <p>
                        {msg.content}
                      </p>

                      <small>
                        {msg.created_at
                          ? new Date(
                              msg.created_at
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute:
                                  "2-digit",
                              }
                            )
                          : ""}
                      </small>
                    </div>
                  );
                }
              )}
            </div>

            <div className="message-box">
              <button
                className="icon-btn"
                type="button"
              >
                ＋
              </button>

              <input
                value={message}
                onChange={(e) =>
                  setMessage(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Type a message..."
              />

              <button
                className="send-btn"
                type="button"
                onClick={() =>
                  void sendMessage()
                }
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
              justifyContent:
                "center",
            }}
          >
            <h2>
              No conversation selected
            </h2>
          </div>
        )}
      </section>

      <aside className="details">
        {selectedChat && (
          <>
            <div className="details-avatar">
              {(
                customer?.name ||
                customer?.phone ||
                "?"
              )
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
              <h3>
                Customer Details
              </h3>

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
              <h3>
                Conversation
              </h3>

              <p>
                <b>Status:</b>{" "}
                {selectedChat.status}
              </p>

              <p>
                <b>Assigned to:</b>{" "}
                Admin
              </p>

              <p>
                <b>Source:</b>{" "}
                WhatsApp
              </p>
            </div>
          </>
        )}
      </aside>
    </main>
  );
}


