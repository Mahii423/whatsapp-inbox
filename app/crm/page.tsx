"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../utils/supabase/client";

export default function CRMPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const supabase = createClient();

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("contacts").select("*").eq("user_id", user?.id).order("created_at", {ascending: false});
    if(data) setContacts(data);
  };

  const addContact = async (e: any) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("contacts").insert({ user_id: user?.id, name, phone, status: 'lead' });
    setName(""); setPhone(""); fetchContacts();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">MahiWA CRM - Bitrix Style</h1>

      <form onSubmit={addContact} className="flex gap-2 mb-6 bg-white p-4 rounded-xl shadow">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="p-2 border rounded flex-1" required/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="WhatsApp Number" className="p-2 border rounded flex-1" required/>
        <button className="bg-green-600 text-white px-6 rounded font-bold">+ Add Lead</button>
      </form>

      <div className="grid grid-cols-4 gap-4">
        {['new','contacted','qualified','won'].map(stage => (
          <div key={stage} className="bg-gray-50 p-3 rounded-xl min-h-">
            <h3 className="font-bold uppercase text-sm mb-3 text-gray-600">{stage}</h3>
            {contacts.filter(c=>c.status===stage || (stage==='new' && c.status==='lead')).map(c=>(
              <div key={c.id} className="bg-white p-3 rounded-lg shadow mb-2">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-gray-500">{c.phone}</p>
                <button onClick={async()=>{await supabase.from("contacts").update({status: stage==='new'?'contacted':stage==='contacted'?'qualified':'won'}).eq('id',c.id); fetchContacts();}} className="text-xs text-green-600 mt-2">Move →</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}