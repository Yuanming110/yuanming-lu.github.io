async function loadPublications() {
  const container = document.getElementById('pub-root');
  if (!container) return;

  const search = document.getElementById('pub-search');
  const counts = document.getElementById('pub-counts');

  const resp = await fetch('data/publications.json', { cache: 'no-store' });
  const data = await resp.json();

  // Sort: year desc, then status priority
  const statusRank = (s) => {
    const t = (s || '').toLowerCase();
    if (t.includes('published')) return 3;
    if (t.includes('under review')) return 2;
    if (t.includes('in prep') || t.includes('in preparation')) return 1;
    return 0;
  };

  data.items.sort((a,b) => (b.year - a.year) || (statusRank(b.status) - statusRank(a.status)));

  const render = (query) => {
    const q = (query || '').trim().toLowerCase();
    const filtered = data.items.filter(p => {
      if (!q) return true;
      const blob = [
        p.authors, p.title, p.journal, p.status, p.keywords?.join(' ')
      ].filter(Boolean).join(' | ').toLowerCase();
      return blob.includes(q);
    });

    // counts
    const published = filtered.filter(p => (p.status || '').toLowerCase().includes('published')).length;
    const underReview = filtered.filter(p => (p.status || '').toLowerCase().includes('under review')).length;
    const inPrep = filtered.filter(p => (p.status || '').toLowerCase().includes('in prep')).length;

    if (counts) {
      counts.innerHTML = `
        <span class="badge">Total: ${filtered.length}</span>
        <span class="badge">Published: ${published}</span>
        <span class="badge">Under review: ${underReview}</span>
        <span class="badge">In prep: ${inPrep}</span>
      `;
    }

    // group
    const groups = [
      { id: 'published', label: 'Published' },
      { id: 'under_review', label: 'Under review' },
      { id: 'in_prep', label: 'In preparation' },
      { id: 'other', label: 'Other' }
    ];

    const bucket = (p) => {
      const t = (p.status || '').toLowerCase();
      if (t.includes('published')) return 'published';
      if (t.includes('under review')) return 'under_review';
      if (t.includes('in prep')) return 'in_prep';
      return 'other';
    };

    const byGroup = {};
    for (const g of groups) byGroup[g.id] = [];
    for (const p of filtered) byGroup[bucket(p)].push(p);

    const htmlForPub = (p) => {
      const links = [];
      if (p.doi) links.push(`<a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI</a>`);
      if (p.url) links.push(`<a href="${p.url}" target="_blank" rel="noopener">Link</a>`);
      if (p.preprint) links.push(`<a href="${p.preprint}" target="_blank" rel="noopener">Preprint</a>`);
      const status = p.status ? `<span class="badge">${p.status}</span>` : '';
      return `
        <div class="pub">
          <div class="title">${p.title}</div>
          <div class="meta">${p.authors}</div>
          <div class="meta"><em>${p.journal || ''}</em>${p.volume ? ` ${p.volume}` : ''}${p.pages ? `:${p.pages}` : ''}${p.year ? ` (${p.year})` : ''}</div>
          <div class="links">${status}${links.length ? ' · ' : ''}${links.join(' · ')}</div>
        </div>
      `;
    };

    container.innerHTML = groups.map(g => {
      const items = byGroup[g.id];
      if (!items.length) return '';
      return `
        <h2>${g.label}</h2>
        <div class="pub-list">${items.map(htmlForPub).join('')}</div>
      `;
    }).join('');
  };

  render('');

  if (search) {
    search.addEventListener('input', (e) => render(e.target.value));
  }
}

loadPublications();
