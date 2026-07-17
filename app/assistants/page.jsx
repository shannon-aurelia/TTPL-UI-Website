'use client';
import { useState, useEffect } from 'react';

export default function Assistants() {
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assistants')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAssistants(data.data);
        }
      })
      .catch((e) => console.error('Failed to load assistants', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="section">
        <h1 className="title">Assistants & alumni.</h1>
        <p className="muted">Loading crew directory...</p>
      </section>
    );
  }

  const currentBatch = assistants.filter(a => a.batch === '2024');
  const e23 = assistants.filter(a => a.batch === 'Elektro 23');
  const e22 = assistants.filter(a => a.batch === 'Elektro 22');

  return (
    <section className="section page-hero" id="top">
      <h1 className="title">Assistants & alumni.</h1>
      <p className="subtitle">
        Current batch 2024 names are shown first. Elektro 23 and Elektro 22 portraits are matched to the available TTPL Instagram announcement tiles.
      </p>

      <div className="liquid" style={{ padding: 34, marginTop: 34 }}>
        <div className="eyebrow">Current assistants • Batch 2024</div>
        <h2>New names, new chapter.</h2>
        <div className="grid" style={{ marginTop: 24 }}>
          {currentBatch.map(ast => (
            <div className="card" key={ast.id}>
              <h2>{ast.name}</h2>
              <p style={{ margin: '4px 0' }} className="muted">Official portrait pending.</p>
            </div>
          ))}
        </div>
      </div>

      {e23.length > 0 && (
        <Batch title="Elektro 2023 archive" data={e23} />
      )}

      {e22.length > 0 && (
        <Batch title="Elektro 2022 alumni archive" data={e22} />
      )}
    </section>
  );
}

function Batch({ title, data }) {
  return (
    <div style={{ marginTop: 50 }}>
      <div className="eyebrow">{title}</div>
      <div className="assistant-grid" style={{ marginTop: 24 }}>
        {data.map(ast => (
          <div className="assistant-card" key={ast.id}>
            <img src={ast.portraitUrl || '/assets/avatar-placeholder.png'} alt={ast.name} style={{ objectFit: 'cover' }} />
            <h3>{ast.name}</h3>
            <p>{ast.roleType === 'alumni' ? 'Alumni' : 'Assistant archive'}</p>
            {ast.instagram && <small style={{ opacity: 0.6 }}>{ast.instagram}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}
