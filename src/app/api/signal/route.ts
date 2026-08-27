import { NextResponse } from 'next/server';

const DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Direct REST API PATCH to Firebase RTDB
    const res = await fetch(`${DB_URL}/traffic/signalState.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Firebase REST update failed: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Failed to update signal state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${DB_URL}/traffic/signalState.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
