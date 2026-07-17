import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ name: 'TTPL UI API', status: 'ready' });
}
