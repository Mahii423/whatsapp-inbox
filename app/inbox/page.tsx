"use client";

export default function InboxPage() {
  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-2xl overflow-hidden border m-4">
      {/* Left - Contact List */}
      <div className="w- border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Inbox</h2>
          <input
            placeholder="Search contacts..."
            className="w-full mt-3 px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-500"
          />
        </div>
        <div className="p-2 space-y-1 flex-1 overflow-y-auto">
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl cursor-pointer">
            <div className="font-medium text-sm">+92300 1234567</div>
            <div className="text-xs text-gray-500 truncate">Hello bhai, order chahiye...</div>
          </div>
          <div className="p-3 hover:bg-gray-50 rounded-xl cursor-pointer">
            <div className="font-medium text-sm">Test User</div>
            <div className="text-xs text-gray-500 truncate">Thank you!</div>
          </div>
        </div>
      </div>

      {/* Right - Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <div className="font-semibold">+92300 1234567</div>
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">Open</div>
        </div>
        <div className="flex-1 bg-[#f8f9fb] p-6 flex items-center justify-center text-gray-400">
          Select a chat to start messaging
        </div>
        <div className="p-4 border-t flex gap-2 bg-white">
          <input placeholder="Type a message..." className="flex-1 px-4 py-3 border rounded-full text-sm focus:outline-none focus:border-green-500" />
          <button className="bg-green-600 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-green-700">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}