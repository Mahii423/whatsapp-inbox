"use client";
import { useState } from "react";

const chats = [
  { id: 1, name: "Aamir Mahi", phone: "+923066571350", last: "Bhai order kab ayega?", time: "6:30 PM", unread: 2, avatar: "AM" },
  { id: 2, name: "Test Customer", phone: "+92300 1234567", last: "Thank you!", time: "5:15 PM", unread: 0, avatar: "TC" },
  { id: 3, name: "Ali Khan", phone: "+92312 9876543", last: "Price kya hai?", time: "Yesterday", unread: 5, avatar: "AK" },
];

export default function InboxPage() {
  const [selected, setSelected] = useState(chats[0]);

  return (
    <div className="flex h-[calc(100vh-70px)] bg-white rounded-2xl border border-gray-200 overflow-hidden -m-1 md:m-0">
      {/* CONTACT LIST - Left */}
      <div className="w- border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-">Inbox</h2>
            <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{chats.length} chats</span>
          </div>
          <input placeholder="🔍 Search or filter..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-[#f8f9fb] focus:outline-none focus:border-green-500" />
          <div className="flex gap-2 mt-3">
            <button className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-full">All</button>
            <button className="text-xs bg-gray-100 px-3 py-1.5 rounded-full">Unread</button>
            <button className="text-xs bg-gray-100 px-3 py-1.5 rounded-full">Groups</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelected(chat)}
              className={`p-4 border-b border-gray-50 cursor-pointer flex gap-3 hover:bg-gray-50 ${selected.id === chat.id? 'bg-green-50!border-green-100' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {chat.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className="font-semibold text- truncate">{chat.name}</span>
                  <span className="text- text-gray-400">{chat.time}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text- text-gray-500 truncate">{chat.last}</span>
                  {chat.unread > 0 && (
                    <span className="bg-green-600 text-white text- w-5 h-5 rounded-full flex items-center justify-center">{chat.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA - Center */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5]">
        {/* Header */}
        <div className="h- bg-white border-b border-gray-200 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">{selected.avatar}</div>
            <div>
              <div className="font-semibold text-">{selected.name}</div>
              <div className="text-xs text-gray-500">{selected.phone} • Online</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">● Open</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-3">
          <div className="text-center text- text-gray-400 my-4">Today</div>
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm text-">Hello bhai, order chahiye tha</div>
          </div>
          <div className="flex justify-end">
            <div className="bg-[#d9fdd3] rounded-2xl rounded-br-md px-4 py-2.5 max-w-[70%] shadow-sm text-">G Walaikum Salam! Konsa product?</div>
          </div>
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm text-">{selected.last}</div>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center gap-3 bg-[#f0f2f5] rounded-full px-2 py-2">
            <button className="w-9 h-9 flex items-center justify-center text-gray-500">😊</button>
            <button className="w-9 h-9 flex items-center justify-center text-gray-500">📎</button>
            <input placeholder="Type a message..." className="flex-1 bg-transparent outline-none text- px-2" />
            <button className="bg-green-600 hover:bg-green-700 text-white w-10 h-10 rounded-full flex items-center justify-center">➤</button>
          </div>
        </div>
      </div>

      {/* CONTACT INFO - Right (like Interakt) */}
      <div className="w- border-l border-gray-200 bg-white p-4 hidden xl:block">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xl mx-auto">{selected.avatar}</div>
          <div className="font-bold mt-3">{selected.name}</div>
          <div className="text-sm text-gray-500">{selected.phone}</div>
        </div>
        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 p-3 rounded-xl">
            <div className="text-xs text-gray-400 uppercase font-semibold">About</div>
            <div className="text-sm mt-1">Potential customer from Facebook Ads</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl">
            <div className="text-xs text-gray-400 uppercase font-semibold">Tags</div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">New Lead</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">VIP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}