"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function BroadcastPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("contacts").select("*").then(({ data }) => { if(data) setContacts(data) });
  }, []);

  const filtered = contacts.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));

  const send = async () => {
    if(!selected.length) return alert("Select contacts");
    setLoading(true);
    const res = await fetch("/api/broadcast",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:"blast", templateName:"hello_world", contactIds:selected})});
    const j = await res.json(); setLoading(false);
    if(j.success||res.ok) alert("Sent!"); else alert(j.error);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-8">
      <div className="max-w- mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text- font-bold tracking-tight">Broadcast</h1>
          <span className="bg-white border border-gray-200 px-4 py-1.5 rounded-full text-sm shadow-sm">Contacts: {contacts.length}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 flex gap-3 border-b border-gray-100">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10" />
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="checkbox" checked={selected.length===filtered.length && filtered.length>0} onChange={()=> selected.length===filtered.length? setSelected([]): setSelected(filtered.map(c=>c.id))} /> Select all</label>
            </div>
            <div className="divide-y divide-gray-100 max-h- overflow-auto">
              {filtered.map(c=>{
                const sel=selected.includes(c.id);
                return (
                  <div key={c.id} onClick={()=> sel? setSelected(selected.filter(id=>id!==c.id)): setSelected([...selected,c.id])} className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition ${sel? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={sel} readOnly className="rounded" />
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${sel?'bg-white text-black':'bg-gray-100'}`}>{(c.name||"U")[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text- truncate">{c.name}</div>
                      <div className={`text-xs truncate ${sel?'text-gray-300':'text-gray-500'}`}>{c.phone}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-fit sticky top-6">
            <h3 className="font-semibold mb-2">Template</h3>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 outline-none"><option>hello_world</option></select>
            <div className="bg-[#e9f9ef] border border-[#c7ebd3] rounded-xl p-3 text- mb-4">📦 Hello world message preview will be sent</div>
            <div className="text-sm text-gray-500 mb-3">{selected.length} recipients selected</div>
            <button onClick={send} disabled={loading} className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-full py-3 font-semibold shadow-sm disabled:opacity-50">{loading?"Sending...":`Send to ${selected.length} contacts`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}