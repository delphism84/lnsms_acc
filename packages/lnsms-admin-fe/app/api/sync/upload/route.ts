import { NextResponse } from 'next/server';
import { uploadStoreToServer } from '@/src/lib/syncServerCore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const agentId = String(body?.agentId || '').trim();
    const storeId = String(body?.storeId || '').trim();
    const serverUrl = body?.serverUrl ? String(body.serverUrl) : undefined;
    if (!agentId || !storeId) {
      return NextResponse.json({ error: 'agentId and storeId required' }, { status: 400 });
    }
    const result = await uploadStoreToServer(agentId, storeId, serverUrl);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
