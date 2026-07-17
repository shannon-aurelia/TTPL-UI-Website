import { NextResponse } from 'next/server';

const current = ['Shannon Aurelia W.', 'Alief Rizki F.', 'Raudana M.', 'Abdul Jafor M.', 'Dominick Dexter G.', 'Naila Faiza'].map((name, index) => ({ id: `2024-${index}`, name, roleType: 'assistant', portraitUrl: null, batch: '2024' }));
const e23 = [
  ['Adrian Idham Alfarizi', '/people/adrian-idham-alfarizi.jpg'],
  ['M. Fathoni', '/people/m-fathoni.jpg'],
  ['Faddlin Alwan Hanafi H.', '/people/faddlin-alwan-hanafi.jpg'],
  ['Alshandra Aurelya Walangadi', '/people/alshandra-aurelya.jpg'],
  ['Rafandra Gifarrel Maritza A.', '/people/rafandra-gifarrel.jpg'],
  ['Muhammad Gavin Jericho', '/people/muhammad-gavin-jericho.jpg']
].map(([name, portraitUrl], index) => ({ id: `2023-${index}`, name, roleType: 'assistant', portraitUrl, batch: 'Elektro 23' }));
const e22 = [
  ['Belva Alisha Alam', '/people/belva-alisha.jpg'],
  ['Daffa Arbika', '/people/daffa-arbika.jpg'],
  ['Mochamad Raihan Triadi', '/people/mochamad-raihan.jpg'],
  ['Fawwaz Niko Hadisatrio', '/people/fawwaz-niko.jpg'],
  ['Muhammad Hanif Mawla', '/people/muhammad-hanif.jpg']
].map(([name, portraitUrl], index) => ({ id: `2022-${index}`, name, roleType: 'alumni', portraitUrl, batch: 'Elektro 22' }));

export async function GET() {
  return NextResponse.json({ success: true, data: [...current, ...e23, ...e22] });
}
