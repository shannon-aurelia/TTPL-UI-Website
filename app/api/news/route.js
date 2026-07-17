import { NextResponse } from 'next/server';

const data = [
  { id: '1', title: 'The seal is broken.', content: 'Six new names begin a new TTPL chapter as the batch 2024 active assistants.', tag: 'Announcement', createdAt: Date.now() - 432000000 },
  { id: '2', title: 'RL and IDP semester timeline.', content: 'RL begins with the September pre-test and IDP continues through November and December.', tag: 'Practicum', createdAt: Date.now() - 345600000 },
  { id: '3', title: 'TTPL YouTube hub.', content: 'Official practicum videos remain connected to the TTPL FTUI YouTube channel.', tag: 'Resource', createdAt: Date.now() - 259200000 },
  { id: '4', title: 'Digital practicum platform.', content: 'Personalized schedules, report submissions, and assistant review tools are being prepared for real deployment.', tag: 'Platform', createdAt: Date.now() }
];

export async function GET() {
  return NextResponse.json({ success: true, data });
}
