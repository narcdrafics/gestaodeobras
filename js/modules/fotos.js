// ==================== FOTOS MODULE ====================

function renderFotos() {
  const obraFilter = document.getElementById('fotos-obra-filter');
  const selectedObra = obraFilter ? obraFilter.value : '';

  if (obraFilter && obraFilter.options.length === 1) {
    DB.obras.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.cod;
      opt.textContent = `${o.cod} - ${o.nome}`;
      obraFilter.appendChild(opt);
    });
  }

  let allPhotos = [];

  DB.tarefas.forEach(t => {
    if (t.photoUrl) {
      allPhotos.push({
        url: t.photoUrl,
        obra: t.obra,
        origem: 'Tarefa',
        desc: t.desc,
        data: t.criacao || ''
      });
    }
  });

  DB.medicao.forEach(m => {
    if (m.photoUrl) {
      allPhotos.push({
        url: m.photoUrl,
        obra: m.obra,
        origem: 'Medição',
        desc: m.servico,
        data: m.semana || ''
      });
    }
  });

  if (selectedObra) {
    allPhotos = allPhotos.filter(p => p.obra === selectedObra);
  }
  allPhotos.sort((a, b) => new Date(b.data) - new Date(a.data));

  const grid = document.getElementById('fotos-grid');
  if (!grid) return;

  safeSetInner(grid, allPhotos.length
    ? allPhotos.map(p => `
      <div class="photo-card" onclick="openLightbox('${sanitizeHTML(p.url)}')">
        <img src="${sanitizeHTML(p.url)}" class="photo-card-img" alt="${sanitizeHTML(p.desc)}">
        <div class="photo-card-info">
          <div class="photo-card-title">${sanitizeHTML(p.desc)}</div>
          <div class="photo-card-meta">
            <span>${sanitizeHTML(p.obra)} · ${sanitizeHTML(p.origem)}</span>
            <span>${fmtDate(p.data)}</span>
          </div>
        </div>
      </div>
    `).join('')
    : '<div style="color:var(--text3); padding: 40px; text-align: center; grid-column: 1/-1;">📸 Nenhuma foto encontrada para esta consulta.</div>');
}

window.renderFotos = renderFotos;
