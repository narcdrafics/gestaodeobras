// ==================== ADMINISTRAÇÃO MODULE ====================

function renderAdmin() {
  if (DB.config) {
    const cfg = DB.config;
    safeSetValue('cfg-empresa', cfg.nomeEmpresa || '');
    safeSetValue('cfg-esquema', cfg.esquemaCores || 'emerald');
    safeSetValue('cfg-tema', cfg.tema || 'dark');
    safeSetValue('cfg-slug', cfg.slug || '');
    safeSetValue('cfg-logo-url', cfg.logoUrl || '');

    if (cfg.logoUrl) {
      safeSetStyle('cfg-logo-preview', 'display', 'block');
      const previewImg = document.querySelector('#cfg-logo-preview img');
      if (previewImg) previewImg.src = cfg.logoUrl;
    }
  }

  safeSetInner('usuarios-tbody', (DB.usuarios && DB.usuarios.length)
    ? DB.usuarios.map((u, i) => `<tr>
        <td><b>${sanitizeHTML(u.email || u.username)}</b></td>
        <td>${sanitizeHTML(u.name)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-red' : u.role === 'engenheiro' ? 'badge-blue' : u.role === 'pendente' ? 'badge-orange' : 'badge-green'}">${sanitizeHTML(u.role.toUpperCase())}</span></td>
        <td>
           <button class="btn btn-secondary btn-sm" onclick="editUsuario(${i})" style="margin-right:8px">✏️</button>
           <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4">Erro ao carregar usuários.</td></tr>');

  if (typeof renderBillingSection === 'function') renderBillingSection();
}

window.renderAdmin = renderAdmin;

// Alias para compatibilidade legada
window.renderBilling = function() {
  if (typeof renderBillingSection === 'function') renderBillingSection();
};

// ==================== SUPER ADMIN (MASTER) ====================

async function renderSuperAdmin() {
  const tbody = document.getElementById('master-tenants-tbody');
  const tbodyUsers = document.getElementById('master-users-tbody');
  const totalTenantsEl = document.getElementById('master-total-tenants');
  const totalUsersEl = document.getElementById('master-total-users');

  try {
    const [tenantsSnap, profilesSnap, invitesSnap] = await Promise.all([
      firebase.database().ref('tenants').once('value'),
      firebase.database().ref('profiles').once('value'),
      firebase.database().ref('invites').once('value')
    ]);

    const tenants = tenantsSnap.val() || {};
    const profiles = profilesSnap.val() || {};
    const invites = invitesSnap.val() || {};
    window.globalInvitesDataCache = invites;
    window.globalTenantsDataCache = tenants;

    const tenantIds = Object.keys(tenants);
    const profileList = Object.values(profiles);

    if (totalTenantsEl) totalTenantsEl.textContent = tenantIds.length;
    if (totalUsersEl) totalUsersEl.textContent = profileList.length;

    safeSetInner(tbody, tenantIds.map(tid => {
      const t = tenants[tid];
      const config = t.config || {};
      const adminProfile = profileList.find(p => p.tenantId === tid && p.role === 'admin');
      let displayEmail = adminProfile ? sanitizeHTML(adminProfile.email) : 'N/A';

      if (!adminProfile) {
        const pendingKey = Object.keys(invites).find(k => invites[k].tenantId === tid && invites[k].role === 'admin');
        if (pendingKey) displayEmail = sanitizeHTML(pendingKey.replace(/,/g, '.')) + ' <span style="font-size:10px; color:var(--orange)">(Convite)</span>';
      }

      return `<tr>
            <td>
                <div style="font-weight:600">${sanitizeHTML(config.nomeEmpresa || 'Sem Nome')}</div>
                <div style="font-size:10px; opacity:0.6">${sanitizeHTML(tid)}</div>
            </td>
            <td>${displayEmail}</td>
            <td>${config.limiteObras || 2}</td>
            <td>${config.limiteTrabalhadores || 10}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openMasterTenantModal('${tid}')">⚙️ Ajustar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTenant('${tid}')" style="margin-left: 5px;">Excluir</button>
            </td>
        </tr>`;
    }).join(''));

    if (tbodyUsers) {
      profileList.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));

      safeSetInner(tbodyUsers, profileList.map(p => {
        let nomeEmp = 'Sem Vínculo / Mestre';
        let extraInfo = '';

        if (p.tenantId !== 'MASTER_SYSTEM') {
          const t = tenants[p.tenantId] || {};
          const config = t.config || {};
          nomeEmp = config.nomeEmpresa || 'Empresa Excluída/Não Encontrada';
          const slugTxt = config.slug ? `(<b>${sanitizeHTML(config.slug)}</b>)` : '';
          extraInfo = `<div style="font-size:10px; opacity:0.6">ID: ${sanitizeHTML(p.tenantId)} ${slugTxt}</div>`;
        }

        return `<tr>
                <td><div style="font-weight:600">${sanitizeHTML(p.name || 'Sem Nome')}</div></td>
                <td>${sanitizeHTML(p.email || 'N/A')}</td>
                <td><span class="badge badge-gray">${sanitizeHTML(p.role || '').toUpperCase()}</span></td>
                <td>
                    <div style="font-weight:600">${sanitizeHTML(nomeEmp)}</div>
                    ${extraInfo}
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteGlobalUser('${sanitizeHTML(p.uid)}', '${sanitizeHTML(p.email)}', '${sanitizeHTML(p.tenantId)}')">Excluir</button>
                </td>
            </tr>`;
      }).join(''));
    }

    renderWebhookLogs();
    renderMasterUsers();

  } catch (err) {
    console.error('Erro Super Admin:', err);
    tbody.innerHTML = '<tr><td colspan="5">Erro de permissão ou conexão.</td></tr>';
  }
}

window.renderSuperAdmin = renderSuperAdmin;

async function renderWebhookLogs() {
  const tbody = document.getElementById('webhook-logs-tbody');
  if (!tbody) return;

  try {
    const snap = await firebase.database().ref('webhook_debug').limitToLast(15).once('value');
    const logs = snap.val() || {};
    const items = Object.values(logs).sort((a,b) => b.timestamp - a.timestamp);

    if (items.length === 0) {
      safeSetInner('webhook-logs-tbody', '<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.6;">Nenhum evento registrado ainda.</td></tr>');
      return;
    }

    safeSetInner('webhook-logs-tbody', items.map(log => {
      const p = log.payload || {};
      const status = (p.order_status || p.status || 'N/A').toUpperCase();
      const email = p.email || (p.Customer && p.Customer.email) || 'N/A';
      const tenantId = p.external_id || p.external_reference || 'N/A';
      const result = log.result || 'Pendente/Processado';
      const dateStr = new Date(log.timestamp).toLocaleString('pt-BR');

      return `<tr style="font-size:12px;">
        <td>${sanitizeHTML(dateStr)}</td>
        <td><span class="badge ${status === 'APPROVED' || status === 'PAID' ? 'badge-green' : 'badge-gray'}">${sanitizeHTML(status)}</span></td>
        <td>${sanitizeHTML(email)}</td>
        <td><code>${sanitizeHTML(tenantId)}</code></td>
        <td style="color:${result.includes('Success') ? 'var(--green)' : 'var(--text3)'}">${sanitizeHTML(result)}</td>
      </tr>`;
    }).join(''));

  } catch (e) {
    console.error('Erro ao listar logs:', e);
    tbody.innerHTML = '<tr><td colspan="5">Falha ao carregar logs.</td></tr>';
  }
}

async function renderMasterUsers() {
  const tbody = document.getElementById('master-admins-tbody');
  if (!tbody) return;

  try {
    const snap = await firebase.database().ref('users').once('value');
    const allUsers = snap.val() || {};
    const masters = Object.entries(allUsers)
      .filter(([email, data]) => data.role === 'super_admin')
      .map(([email, data]) => ({ email: email.replace(/,/g, '.'), ...data }));

    safeSetInner(tbody, masters.map(m => `
      <tr>
        <td>
           <b>${sanitizeHTML(m.nome || 'Sem Nome')}</b><br>
           <small style="opacity:0.6">${sanitizeHTML(m.email)}</small>
        </td>
        <td><span class="badge badge-gray">${sanitizeHTML(m.origem || 'N/A')}</span></td>
        <td>
           <button class="btn btn-danger btn-sm" onclick="deleteMasterUser('${sanitizeHTML(m.email)}')">Excluir️</button>
        </td>
      </tr>
    `).join(''));

  } catch (e) {
    console.error('Erro ao renderizar mestres:', e);
    safeSetInner(tbody, '<tr><td colspan="3">Sem permissão para listar mestres.</td></tr>');
  }
}

async function addMasterUser() {
  const emailInput = document.getElementById('new-master-email');
  const email = emailInput?.value.trim().toLowerCase();
  if (!email) return toast('Informe o e-mail do novo Super Admin.', 'error');
  
  if (!confirm(`Deseja realmente dar acesso TOTAL e GLOBAL para ${email}?`)) return;

  try {
    const sanitized = email.replace(/\./g, ',');
    await firebase.database().ref(`users/${sanitized}`).update({
      role: 'super_admin',
      tenantId: 'MASTER_SYSTEM',
      nome: 'Administrador Mestre',
      origem: 'painel_master'
    });
    toast(`Sucesso! ${email} agora é Super Admin.`);
    emailInput.value = '';
    renderMasterUsers();
  } catch (e) {
    console.error('Erro ao adicionar mestre:', e);
    toast('Erro ao autorizar novo mestre.', 'error');
  }
}

async function deleteMasterUser(email) {
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (email === sessionUser.email) return toast('Você não pode remover seu próprio acesso master!', 'error');

  if (!confirm(`Deseja REMOVER o acesso global de ${email}?`)) return;

  try {
    const sanitized = email.replace(/\./g, ',');
    await firebase.database().ref(`users/${sanitized}/role`).set('admin');
    toast(`Acesso master removido de ${email}.`);
    renderMasterUsers();
  } catch (e) {
    console.error('Erro ao remover mestre:', e);
    toast('Erro ao remover acesso master.', 'error');
  }
}

function openMasterTenantModal(tid) {
  const contentOrig = document.getElementById('modal-master-tenant').innerHTML;
  const container = document.getElementById('modal-content');
  safeSetInner(container, contentOrig);

  const tData = (window.globalTenantsDataCache && window.globalTenantsDataCache[tid]) || {};
  const config = tData.config || {};

  container.querySelector('#mt-tenant-id').value = tid || '';
  container.querySelector('#mt-old-slug').value = config.slug || '';
  container.querySelector('#mt-nome').value = config.nomeEmpresa || '';
  container.querySelector('#mt-slug').value = config.slug || '';
  container.querySelector('#mt-email').value = '';
  container.querySelector('#mt-limite-obras').value = config.limiteObras || 0;
  container.querySelector('#mt-limite-usr').value = config.limiteTrabalhadores || config.limiteUsuarios || 0;
  
  if(container.querySelector('#mt-plano')) container.querySelector('#mt-plano').value = tData.plano || 'free_trial';
  if(container.querySelector('#mt-status')) container.querySelector('#mt-status').value = tData.status || 'ativo';

  document.getElementById('modal-container').classList.add('open');
}

async function saveMasterTenant() {
  const modal = document.getElementById('modal-content');
  const tid = modal.querySelector('#mt-tenant-id').value;
  const oldSlug = modal.querySelector('#mt-old-slug').value;
  const nome = modal.querySelector('#mt-nome').value.trim();
  let slugVal = modal.querySelector('#mt-slug').value.trim().toLowerCase();
  const emailOwner = modal.querySelector('#mt-email').value.trim().toLowerCase();
  const lobras = parseInt(modal.querySelector('#mt-limite-obras').value);
  const lusr = parseInt(modal.querySelector('#mt-limite-usr').value);
  const plano = modal.querySelector('#mt-plano')?.value || 'free_trial';
  const status = modal.querySelector('#mt-status')?.value || 'ativo';

  if (isNaN(lobras) || isNaN(lusr)) return toast('Preencha os limites com números válidos.', 'error');
  if (!nome) return toast('Preencha o nome da empresa.', 'error');
  if (!slugVal) return toast('Preencha o subdomínio (slug).', 'error');

  slugVal = slugVal.replace(/[^a-z0-9]/g, '');
  if (!slugVal) return toast('Subdomínio inválido.', 'error');

  try {
    if (slugVal !== oldSlug) {
      const existingSlug = await firebase.database().ref('tenants_public').orderByChild('slug').equalTo(slugVal).once('value');
      if (existingSlug.exists()) {
        return toast(`O subdomínio "${slugVal}" já está em uso!`, 'error');
      }
    }

    const updates = {};
    updates[`tenants/${tid}/config/nomeEmpresa`] = nome;
    updates[`tenants/${tid}/config/slug`] = slugVal;
    updates[`tenants/${tid}/config/limiteObras`] = lobras;
    updates[`tenants/${tid}/config/limiteTrabalhadores`] = lusr;
    updates[`tenants/${tid}/plano`] = plano;
    updates[`tenants/${tid}/status`] = status;
    
    if (plano === 'premium') {
      updates[`tenants/${tid}/planoVencimento`] = Date.now() + (31 * 24 * 60 * 60 * 1000);
    }

    updates[`tenants_public/${tid}/nomeEmpresa`] = nome;
    updates[`tenants_public/${tid}/slug`] = slugVal;

    if (emailOwner) {
      const sanitizedEmail = emailOwner.replace(/\./g, ',');
      updates[`invites/${sanitizedEmail}`] = {
        email: emailOwner,
        tenantId: tid,
        role: 'admin',
        nomeEmpresa: nome
      };
    }

    await firebase.database().ref().update(updates);
    toast('Empresa salva com sucesso!');
    closeModal();
    renderSuperAdmin();
  } catch (err) {
    console.error(err);
    toast('Erro ao atualizar empresa.', 'error');
  }
}

async function deleteTenant(tid) {
  if (!confirm(`TEM CERTEZA? Isso deletará todos os dados da empresa ${tid}, PERFIS de usuários e CONVITES permanentemente!`)) return;

  try {
    const profilesSnap = await firebase.database().ref('profiles').orderByChild('tenantId').equalTo(tid).once('value');
    const profiles = profilesSnap.val() || {};
    const invitesSnap = await firebase.database().ref('invites').orderByChild('tenantId').equalTo(tid).once('value');
    const invites = invitesSnap.val() || {};

    const updates = {};
    updates[`tenants/${tid}`] = null;
    Object.keys(profiles).forEach(uid => updates[`profiles/${uid}`] = null);
    Object.keys(invites).forEach(emailKey => updates[`invites/${emailKey}`] = null);
    updates[`tenants_public/${tid}`] = null;

    await firebase.database().ref().update(updates);

    toast('Empresa e acessos removidos com sucesso!');
    renderSuperAdmin();
  } catch (err) {
    console.error('Erro ao deletar tenant:', err);
    toast('Erro ao remover empresa e dependências.', 'error');
  }
}

async function deleteGlobalUser(uid, email, tid) {
  if (!confirm(`Deseja realmente EXCLUIR TOTALMENTE o acesso de ${email || uid}?`)) return;
  
  try {
    const updates = {};
    if (uid) updates[`profiles/${uid}`] = null;
    if (email) {
      const sanitized = email.trim().toLowerCase().replace(/\./g, ',');
      updates[`users/${sanitized}`] = null;
    }
    
    await firebase.database().ref().update(updates);
    toast('Usuário e Credenciais removidos com sucesso!');
    renderSuperAdmin();
  } catch (e) {
    toast('Erro ao remover usuário completo.', 'error');
    console.error(e);
  }
}

function saveConfig() {
  const emp = document.getElementById('cfg-empresa').value;
  const esquemaCores = document.getElementById('cfg-esquema').value;
  const tema = document.getElementById('cfg-tema').value;
  const slug = document.getElementById('cfg-slug').value.trim().toLowerCase();
  const logoUrl = document.getElementById('cfg-logo-url').value;

  if (!DB.config) DB.config = {};
  DB.config.nomeEmpresa = emp;
  DB.config.esquemaCores = esquemaCores;
  DB.config.tema = tema;
  DB.config.slug = slug;
  DB.config.logoUrl = logoUrl;

  if (typeof loadTheme === 'function') loadTheme();
  persistDB();
  toast('Identidade Visual salva e aplicada!');
}

async function editUsuario(idx) {
  await openModal('modal-usuario');
  const u = DB.usuarios[idx];
  document.getElementById('usr-edit-idx').value = idx;
  document.getElementById('usr-email').value = u.email || u.username || '';
  document.getElementById('usr-name').value = u.name;
  document.getElementById('usr-role').value = u.role || 'pendente';

  document.getElementById('usr-email').disabled = true;
}

async function saveUsuario() {
  const email = document.getElementById('usr-email').value.trim().toLowerCase();
  const name = document.getElementById('usr-name').value.trim();
  const role = document.getElementById('usr-role').value;
  const editIdx = parseInt(document.getElementById('usr-edit-idx').value);

  if (!email || !name) {
    toast('Preencha os campos obrigatórios (E-mail e Nome).', 'error');
    return;
  }

  const userSession = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  const tenantId = userSession.tenantId;

  if (!tenantId) {
    toast('Erro: Sessão sem Identificador de Empresa (Tenant).', 'error');
    return;
  }

  const userData = { email, name, role, tenantId };

  if (editIdx >= 0) {
    DB.usuarios[editIdx] = { email, name, role };
    toast('Permissões de Usuário atualizadas!');
  } else {
    const limiteAcessos = DB.config.limiteUsuarios || 2;
    if (DB.usuarios && DB.usuarios.length >= limiteAcessos && limiteAcessos < 99) {
      toast(`Seu plano atingiu o limite de ${limiteAcessos} acessos. Faça downgrade ou o Upgrade Ilimitado!`, 'error');
      return;
    }

    if (DB.usuarios.find(u => u.email === email)) {
      toast('Este e-mail já está cadastrado nesta empresa.', 'error');
      return;
    }
    DB.usuarios.push({ email, name, role });
    toast('Novo funcionário autorizado!');
  }

  const sanitizedEmail = email.replace(/\./g, ',');
  try {
    await firebase.database().ref(`invites/${sanitizedEmail}`).set(userData);
    closeModal('modal-usuario');
    renderAdmin();
    await persistDB();
  } catch (err) {
    console.error('Erro ao gerar convite global:', err);
    toast('Erro ao sincronizar convite global.', 'error');
  }
}

window.saveUsuario = saveUsuario;

function deleteUsuario(idx) {
  if (DB.usuarios[idx].role === 'admin' && DB.usuarios.filter(u => u.role === 'admin').length <= 1) {
    return toast('Não é possível remover o único administrador!', 'error');
  }
  if (confirm('Remover usuário?')) {
    DB.usuarios.splice(idx, 1);
    persistDB();
    renderAdmin();
    toast('Usuário removido!');
  }
}

async function injectSuperAdminTenantBanner(modalContent) {
  try {
    const tenantsSnap = await firebase.database().ref('tenants').once('value');
    const tenants = tenantsSnap.val() || {};
    const options = Object.entries(tenants)
      .map(([id, t]) => {
        const nome = (t.config && t.config.nomeEmpresa) || id;
        const selected = (window.superAdminActiveTenant && window.superAdminActiveTenant.id === id) ? 'selected' : '';
        return `<option value="${id}" ${selected}>${sanitizeHTML(nome)}</option>`;
      }).join('');

    const banner = document.createElement('div');
    banner.id = 'sa-tenant-banner';
    banner.style.cssText = 'background:var(--bg2);border:1px solid var(--accent);border-radius:8px;padding:12px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;';
    safeSetInner(banner, `
      <span style="font-weight:600;">🏢 Empresa Ativa:</span>
      <select id="sa-tenant-select" style="flex:1;min-width:200px;padding:6px;border-radius:4px;background:var(--bg3);color:var(--text1);border:1px solid var(--border);">
        <option value="">— Selecione uma empresa —</option>
        ${options}
      </select>
      <button onclick="applySuperAdminTenant()" class="btn btn-primary btn-sm">Carregar Dados</button>
    `);
    modalContent.insertBefore(banner, modalContent.firstChild);
  } catch (e) {
    console.error('Erro ao injetar banner SuperAdmin:', e);
  }
}

async function applySuperAdminTenant() {
  const sel = document.getElementById('sa-tenant-select');
  if (!sel || !sel.value) return toast('Selecione uma empresa!', 'error');
  const id = sel.value;
  const nome = sel.options[sel.selectedIndex].text;
  
  if (typeof loadTenantAsSuperAdmin === 'function') {
    await loadTenantAsSuperAdmin(id, nome);
    toast(`Dados de "${nome}" carregados.`, 'success');
  }
}

// Exportações globais
window.addMasterUser = addMasterUser;
window.deleteMasterUser = deleteMasterUser;
window.openMasterTenantModal = openMasterTenantModal;
window.saveMasterTenant = saveMasterTenant;
window.deleteTenant = deleteTenant;
window.deleteGlobalUser = deleteGlobalUser;
window.saveConfig = saveConfig;
window.editUsuario = editUsuario;
window.deleteUsuario = deleteUsuario;
window.injectSuperAdminTenantBanner = injectSuperAdminTenantBanner;
window.applySuperAdminTenant = applySuperAdminTenant;
