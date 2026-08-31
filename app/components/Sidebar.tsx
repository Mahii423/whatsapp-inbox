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
      <aside className="hidden md:flex w- bg-white border-r border-gray-100 h-screen flex-col fixed left-0 top-0 z-20">
        <div className="p-6 flex items-center gap-2">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white text-xl">💬</div>
          <div>
            <div className="font-bold text-xl leading-none flex items-center">
              <span className="text-gray-900">Mahi</span><span className="text-green-600">WA</span>
            </div>
            <div className="text- text-gray-500 tracking-widest mt-1">WHATSAPP API • MARKETING</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {menu.map((item) => {
            const isActive = pathname === item.href || (item.name === "Inbox" && pathname === "/inbox");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span className="text-base w-6 text-center">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="text-sm text-gray-500 mb-3">
            On the <span className="font-bold text-gray-900">Pro</span> plan
          </div>
          <button className="flex items-center gap-3 text-gray-500 hover:text-gray-800 text-sm font-medium">
            <span>↪</span> Log out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {menu.slice(0, 4).map((item) => (
          <Link key={item.name} href={item.href} className="flex flex-col items-center text- text-gray-500">
            <span className="text-xl">{item.icon}</span>{item.name}
          </Link>
        ))}
        <Link href="/crm" className="flex flex-col items-center text- text-gray-500">
          <span className="text-xl">•••</span> More
        </Link>
      </div>
    </>
  );
}