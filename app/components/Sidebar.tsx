"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { name: "Overview", href: "/", icon: "⊞" },
  { name: "Inbox", href: "/inbox", icon: "✉" },
  { name: "Contacts", href: "/contacts", icon: "👤" },
  { name: "Broadcast", href: "/broadcast", icon: "📢" },
  { name: "Templates", href: "/templates", icon: "📄" },
  { name: "AI Assistant", href: "/ai", icon: "🤖" },
  { name: "Guide", href: "/guide", icon: "📖" },
  { name: "Integrations", href: "/integrations", icon: "🔗" },
  { name: "Chatbot Flows", href: "/flows", icon: "⚡" },
  { name: "Connect WhatsApp", href: "/connect", icon: "📱" },
  { name: "Subscription & Billing", href: "/billing", icon: "💳" },
  { name: "Team", href: "/team", icon: "👥" },
  { name: "API Access", href: "/api-access", icon: "</>" },
  { name: "Profile", href: "/profile", icon: "⚙" },
  { name: "CRM", href: "/crm", icon: "📊" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <>
      <aside className="hidden md:flex w- fixed left-0 top-0 h-screen bg-white border-r flex-col z-20">
        <div className="p-5 flex gap-2 items-center">
          <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-white">💬</div>
          <div>
            <div className="font-bold"><span>Mahi</span><span className="text-green-600">WA</span></div>
            <div className="text-xs text-gray-500">WHATSAPP API</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {menu.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className={active? "flex gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm" : "flex gap-2 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-lg text-sm"}>
                <span>{item.icon}</span>{item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t">
          <div className="text-sm text-gray-500 mb-2">On the <b className="text-black">Pro</b> plan</div>
          <button className="text-sm text-gray-500">↪ Log out</button>
        </div>
      </aside>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {menu.slice(0,4).map((item) => (
          <Link key={item.name} href={item.href} className="text-xs text-gray-500 flex flex-col items-center">
            <span className="text-xl">{item.icon}</span>{item.name}
          </Link>
        ))}
        <Link href="/crm" className="text-xs text-gray-500 flex flex-col items-center">
          <span>•••</span>More
        </Link>
      </div>
    </>
  );
}