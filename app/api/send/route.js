import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { to, message } = await request.json();
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return NextResponse.json({ error: 'Token or Phone ID missing in Vercel' }, { status: 500 });
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
