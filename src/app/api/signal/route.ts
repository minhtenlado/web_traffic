import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

if (!admin.apps.length) {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT", e);
    }
  } 
  
  if (!credential) {
    try {
      const keyPath = path.join(process.cwd(), 'trafic-42620-firebase-adminsdk-fbsvc-f91ac01927.json');
      if (fs.existsSync(keyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
      }
    } catch (e) {
      console.error("Failed to load local service account key", e);
    }
  }

  admin.initializeApp({
    credential: credential || admin.credential.applicationDefault(),
    databaseURL: "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const db = admin.database();
    await db.ref('traffic/signalState').update(body);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update signal state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
