function decodeBibValue(value) {
  return String(value || '')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\["'`^~=.uvHckr]\s*\{?([A-Za-z])\}?/g, '$1')
    .replace(/\\[A-Za-z]+\s*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBibFields(source) {
  const fields = {};
  let cursor = 0;

  while (cursor < source.length) {
    while (cursor < source.length && /[\s,]/.test(source[cursor])) cursor += 1;

    const nameStart = cursor;
    while (cursor < source.length && /[A-Za-z0-9_-]/.test(source[cursor])) cursor += 1;
    const name = source.slice(nameStart, cursor).toLowerCase();
    if (!name) break;

    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source[cursor] !== '=') {
      while (cursor < source.length && source[cursor] !== ',') cursor += 1;
      continue;
    }

    cursor += 1;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;

    let rawValue = '';
    if (source[cursor] === '{') {
      cursor += 1;
      const valueStart = cursor;
      let depth = 1;
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === '{') depth += 1;
        if (source[cursor] === '}') depth -= 1;
        cursor += 1;
      }
      rawValue = source.slice(valueStart, cursor - 1);
    } else if (source[cursor] === '"') {
      cursor += 1;
      const valueStart = cursor;
      let escaped = false;
      while (cursor < source.length) {
        const character = source[cursor];
        if (character === '"' && !escaped) break;
        escaped = character === '\\' && !escaped;
        if (character !== '\\') escaped = false;
        cursor += 1;
      }
      rawValue = source.slice(valueStart, cursor);
      cursor += 1;
    } else {
      const valueStart = cursor;
      while (cursor < source.length && source[cursor] !== ',') cursor += 1;
      rawValue = source.slice(valueStart, cursor);
    }

    fields[name] = decodeBibValue(rawValue);
  }

  return fields;
}

function parseBibTeX(source) {
  const entries = [];
  let cursor = 0;

  while (cursor < source.length) {
    const entryStart = source.indexOf('@', cursor);
    if (entryStart < 0) break;

    const header = source.slice(entryStart).match(/^@([A-Za-z]+)\s*([({])/);
    if (!header) {
      cursor = entryStart + 1;
      continue;
    }

    const type = header[1].toLowerCase();
    const openCharacter = header[2];
    const closeCharacter = openCharacter === '{' ? '}' : ')';
    const bodyStart = entryStart + header[0].length;
    let depth = 1;
    let bodyEnd = bodyStart;

    while (bodyEnd < source.length && depth > 0) {
      if (source[bodyEnd] === openCharacter) depth += 1;
      if (source[bodyEnd] === closeCharacter) depth -= 1;
      bodyEnd += 1;
    }

    if (depth !== 0) throw new Error('The BibTeX export contains an incomplete entry.');

    const body = source.slice(bodyStart, bodyEnd - 1);
    const firstComma = body.indexOf(',');
    if (firstComma >= 0 && !['comment', 'preamble', 'string'].includes(type)) {
      entries.push({
        type,
        key: body.slice(0, firstComma).trim(),
        fields: parseBibFields(body.slice(firstComma + 1))
      });
    }

    cursor = bodyEnd;
  }

  return entries;
}

function formatBibAuthors(value) {
  return String(value || '')
    .split(/\s+and\s+/i)
    .map(author => {
      const comma = author.indexOf(',');
      if (comma < 0) return author.trim();
      const family = author.slice(0, comma).trim();
      const given = author.slice(comma + 1).trim();
      return `${given} ${family}`.trim();
    })
    .filter(Boolean)
    .join(', ');
}

function bibEntryToPublication(entry) {
  const fields = entry.fields;
  return {
    authors: formatBibAuthors(fields.author),
    year: Number.parseInt(fields.year, 10) || 0,
    title: fields.title || 'Untitled publication',
    journal: fields.journal || fields.booktitle || fields.publisher || '',
    volume: fields.volume || '',
    issue: fields.number || '',
    pages: fields.pages || '',
    status: 'Published',
    doi: String(fields.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
    url: fields.url || '',
    preprint: '',
    keywords: fields.keywords ? fields.keywords.split(/[,;]/).map(keyword => keyword.trim()) : []
  };
}

function normalizedTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function publicationKey(publication) {
  const doi = String(publication.doi || '').toLowerCase().trim();
  return doi ? `doi:${doi}` : `title:${normalizedTitle(publication.title)}`;
}

function mergePublications(published, manual) {
  const seen = new Set();
  const merged = [];

  for (const publication of [...published, ...manual]) {
    const key = publicationKey(publication);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(publication);
  }

  return merged;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function safeHttpUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function doiUrl(doi) {
  const normalized = String(doi || '').trim();
  return /^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(normalized)
    ? `https://doi.org/${normalized}`
    : '';
}

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.text();
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function loadPublications() {
  const container = document.getElementById('pub-root');
  if (!container) return;

  const search = document.getElementById('pub-search');
  const counts = document.getElementById('pub-counts');
  const message = document.getElementById('pub-message');
  const errors = [];
  let published = [];
  let manual = [];
  let latestUpdate = '';

  const [bibResult, manualResult] = await Promise.allSettled([
    fetchText('data/google-scholar.bib'),
    fetchJson('data/under-review.json')
  ]);

  if (bibResult.status === 'fulfilled') {
    published = parseBibTeX(bibResult.value).map(bibEntryToPublication);
    const exported = bibResult.value.match(/^%\s*Last updated:\s*(\d{4}-\d{2}-\d{2})/mi);
    if (exported) latestUpdate = exported[1];
  } else {
    errors.push('published articles');
  }

  if (manualResult.status === 'fulfilled' && Array.isArray(manualResult.value.items)) {
    manual = manualResult.value.items;
    if (manualResult.value.updated > latestUpdate) latestUpdate = manualResult.value.updated;
  } else {
    errors.push('manuscripts under review');
  }

  const items = mergePublications(published, manual);
  const statusRank = status => {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('published')) return 3;
    if (normalized.includes('under review')) return 2;
    if (normalized.includes('in prep') || normalized.includes('in preparation')) return 1;
    return 0;
  };

  items.sort((a, b) => (
    (Number(b.year) - Number(a.year))
    || (statusRank(b.status) - statusRank(a.status))
    || String(a.title).localeCompare(String(b.title))
  ));

  if (message) {
    if (errors.length) {
      message.textContent = `Some records could not be loaded: ${errors.join(' and ')}.`;
      message.classList.add('error');
    } else {
      const updateText = latestUpdate ? ` Last updated ${latestUpdate}.` : '';
      message.textContent = `Published records: Google Scholar BibTeX. Under-review records: manually maintained.${updateText}`;
    }
  }

  const groups = [
    { id: 'published', label: 'Published' },
    { id: 'under_review', label: 'Under review' },
    { id: 'in_prep', label: 'In preparation' },
    { id: 'other', label: 'Other' }
  ];

  const bucket = publication => {
    const status = String(publication.status || '').toLowerCase();
    if (status.includes('published')) return 'published';
    if (status.includes('under review')) return 'under_review';
    if (status.includes('in prep')) return 'in_prep';
    return 'other';
  };

  const htmlForPublication = publication => {
    const links = [];
    const resolvedDoi = doiUrl(publication.doi);
    const resolvedUrl = safeHttpUrl(publication.url);
    const resolvedPreprint = safeHttpUrl(publication.preprint);

    if (resolvedDoi) links.push(`<a href="${escapeHtml(resolvedDoi)}" target="_blank" rel="noopener">DOI</a>`);
    if (resolvedUrl && resolvedUrl !== resolvedDoi) links.push(`<a href="${escapeHtml(resolvedUrl)}" target="_blank" rel="noopener">Link</a>`);
    if (resolvedPreprint) links.push(`<a href="${escapeHtml(resolvedPreprint)}" target="_blank" rel="noopener">Preprint</a>`);

    const status = publication.status
      ? `<span class="badge">${escapeHtml(publication.status)}</span>`
      : '';
    const journal = publication.journal ? `<em>${escapeHtml(publication.journal)}</em>` : '';
    const volume = publication.volume ? ` ${escapeHtml(publication.volume)}` : '';
    const pages = publication.pages ? `:${escapeHtml(publication.pages)}` : '';
    const year = publication.year ? ` (${escapeHtml(publication.year)})` : '';

    return `
      <article class="pub">
        <div class="title">${escapeHtml(publication.title)}</div>
        <div class="meta">${escapeHtml(publication.authors)}</div>
        <div class="meta">${journal}${volume}${pages}${year}</div>
        <div class="links">${status}${links.length ? ' · ' : ''}${links.join(' · ')}</div>
      </article>
    `;
  };

  const render = query => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const filtered = items.filter(publication => {
      if (!normalizedQuery) return true;
      const searchable = [
        publication.authors,
        publication.title,
        publication.journal,
        publication.status,
        publication.keywords?.join(' ')
      ].filter(Boolean).join(' | ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });

    const publishedCount = filtered.filter(publication => bucket(publication) === 'published').length;
    const underReviewCount = filtered.filter(publication => bucket(publication) === 'under_review').length;
    const inPrepCount = filtered.filter(publication => bucket(publication) === 'in_prep').length;

    if (counts) {
      counts.innerHTML = `
        <span class="badge">Total: ${filtered.length}</span>
        <span class="badge">Published: ${publishedCount}</span>
        <span class="badge">Under review: ${underReviewCount}</span>
        <span class="badge">In prep: ${inPrepCount}</span>
      `;
    }

    const byGroup = Object.fromEntries(groups.map(group => [group.id, []]));
    for (const publication of filtered) byGroup[bucket(publication)].push(publication);

    container.innerHTML = groups.map(group => {
      const groupItems = byGroup[group.id];
      if (!groupItems.length) return '';
      return `
        <h2>${group.label}</h2>
        <div class="pub-list">${groupItems.map(htmlForPublication).join('')}</div>
      `;
    }).join('') || '<p class="lead">No publications match your search.</p>';
  };

  render('');
  if (search) search.addEventListener('input', event => render(event.target.value));
}

if (typeof document !== 'undefined') loadPublications();
