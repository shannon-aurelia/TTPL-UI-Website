const current = ['Shannon Aurelia W.', 'Alief Rizki F.', 'Raudana M.', 'Abdul Jafor M.', 'Dominick Dexter G.', 'Naila Faiza'];
const archive = [
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

export const metadata = { title: 'People' };

export default function Assistants() {
  return <section className="section page-hero people-page" id="top">
    <div className="eyebrow">People of TTPL</div>
    <h1 className="title">Built by people who teach carefully.</h1>
    <p className="subtitle">Meet the current laboratory assistants and the Elektro 23 and Elektro 22 archive preserved from TTPL’s available announcement portraits.</p>

    <div className="people-current">
      <div className="people-current-image"><img src="/people/current-team-announcement.jpg" alt="TTPL current assistant announcement"/></div>
      <div className="people-current-copy"><div className="eyebrow">Current assistants · Batch 2024</div><h2>One desk. Six names.</h2><div className="people-current-list">{current.map((name, index) => <div key={name}><span>{String(index + 1).padStart(2, '0')}</span><b>{name}</b></div>)}</div></div>
    </div>

    <div className="people-archive-heading"><div className="eyebrow">Assistant archive</div><h2>Those who carried TTPL before us.</h2></div>
    <div className="assistant-grid people-archive">
      {archive.map(([name, batch, portrait]) => <article className="assistant-card" key={name}><img src={portrait} alt={name}/><div><span>{batch}</span><h3>{name}</h3></div></article>)}
    </div>
  </section>;
}
