import HomeClient from './HomeClient';

const current = ['Shannon Aurelia W.', 'Alief Rizki F.', 'Raudana M.', 'Abdul Jafor M.', 'Dominick Dexter G.', 'Naila Faiza'];
const alumni = [
  ['Adrian Idham Alfarizi', 'Elektro 23', '/people/adrian-idham-alfarizi.jpg'],
  ['M. Fathoni', 'Elektro 23', '/people/m-fathoni.jpg'],
  ['Faddlin Alwan Hanafi H.', 'Elektro 23', '/people/faddlin-alwan-hanafi.jpg'],
  ['Alshandra Aurelya Walangadi', 'Elektro 23', '/people/alshandra-aurelya.jpg'],
  ['Rafandra Gifarrel Maritza A.', 'Elektro 23', '/people/rafandra-gifarrel.jpg'],
  ['Muhammad Gavin Jericho', 'Elektro 23', '/people/muhammad-gavin-jericho.jpg'],
  ['Belva Alisha Alam', 'Elektro 22', '/people/belva-alisha.jpg'],
  ['Daffa Arbika', 'Elektro 22', '/people/daffa-arbika.jpg'],
  ['Mochamad Raihan Triadi', 'Elektro 22', '/people/mochamad-raihan.jpg'],
  ['Fawwaz Niko Hadisatrio', 'Elektro 22', '/people/fawwaz-niko.jpg'],
  ['Muhammad Hanif Mawla', 'Elektro 22', '/people/muhammad-hanif.jpg']
];

export default function Home() {
  return <HomeClient current={current} alumni={alumni} />;
}
