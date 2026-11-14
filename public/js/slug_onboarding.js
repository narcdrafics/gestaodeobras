/**
 * Obra Real - Onboarding do slug
 *
 * Chamado pelo auth_core.js quando um usuário novo (sem perfil) acabou de autenticar.
 * Mostra uma tela para escolher o endereço da empresa (<slug>.obrareal.com), confere em
 * tempo real se está livre e, ao confirmar, cria a conta (tenant) via ObraSlug.createTenantAccount.
 * É essa escrita que faz a empresa aparecer no painel do Master.
 *
 *   window.promptSlugOnboarding({ uid, email, name }) -> Promise<{slug, nomeEmpresa} | null>
 *   (null = usuário cancelou)
 */
(function () {
  'use strict';

  const STYLE_ID = 'slug-onboarding-style';
  const CSS = `
    #slug-onboarding{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'DM Sans',sans-serif}
    #slug-onboarding .so-card{width:100%;max-width:440px;background:var(--card,#141414);border:1px solid var(--border,#222);border-radius:12px;padding:28px;color:var(--text2,#E5E5E5)}
    #slug-onboarding h2{font-family:'DM Serif Display',serif;font-weight:400;font-size:24px;color:var(--text,#fff);margin-bottom:6px;letter-spacing:-.5px}
    #slug-onboarding .so-sub{color:var(--muted,#6B6B6B);font-size:14px;margin-bottom:22px;line-height:1.5}
    #slug-onboarding label{display:block;font-size:13px;font-weight:600;color:var(--text,#fff);margin:0 0 8px}
    #slug-onboarding input{width:100%;padding:13px 14px;border:1px solid var(--border,#222);border-radius:8px;background:var(--bg,#0D0D0D);color:var(--text,#fff);font-size:15px;outline:none}
    #slug-onboarding input:focus{border-color:var(--accent,#FF6B35)}
    #slug-onboarding .so-field{margin-bottom:16px}
    #slug-onboarding .so-row{display:flex;align-items:center;gap:8px}
    #slug-onboarding .so-suffix{color:var(--muted,#6B6B6B);font-size:14px;white-space:nowrap}
    #slug-onboarding .so-preview{margin-top:10px;font-size:13px;color:var(--muted,#6B6B6B);word-break:break-all}
    #slug-onboarding .so-preview b{color:var(--accent,#FF6B35)}
    #slug-onboarding .so-status{min-height:20px;margin-top:6px;font-size:13px}
    #slug-onboarding .so-status.ok{color:#3DDC84}
    #slug-onboarding .so-status.bad{color:var(--red,#FF4D4D)}
    #slug-onboarding .so-status.wait{color:var(--muted,#6B6B6B)}
    #slug-onboarding .so-actions{display:flex;flex-direction:column;gap:10px;margin-top:18px}
    #slug-onboarding button{width:100%;padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid var(--border,#222);background:transparent;color:var(--text,#fff)}
    #slug-onboarding button.so-primary{background:var(--accent,#FF6B35);border-color:var(--accent,#FF6B35);color:#fff}
    #slug-onboarding button:disabled{opacity:.45;cursor:not-allowed}
    .so-welcome{background:rgba(61,220,132,.1);color:#3DDC84;border:1px solid rgba(61,220,132,.25);padding:14px;border-radius:8px;font-size:13px;margin-bottom:20px;line-height:1.5}
  `;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildOverlay() {
    const el = document.createElement('div');
    el.id = 'slug-onboarding';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'so-title');
    // Somente texto estático aqui: nada vindo do usuário entra por innerHTML.
    el.innerHTML = `
      <div class="so-card">
        <h2 id="so-title">Escolha o endereço da sua empresa</h2>
        <p class="so-sub">Esse será o link de acesso da sua equipe. Você pode mudar depois no painel.</p>
        <div class="so-field">
          <label for="so-nome">Nome da empresa</label>
          <input id="so-nome" type="text" maxlength="80" autocomplete="organization">
        </div>
        <div class="so-field">
          <label for="so-slug">Endereço</label>
          <div class="so-row">
            <input id="so-slug" type="text" maxlength="30" autocomplete="off" autocapitalize="none" spellcheck="false">
            <span class="so-suffix">.obrareal.com</span>
          </div>
          <div class="so-preview">Seu link: https://<b id="so-preview-slug"></b>.obrareal.com</div>
          <div class="so-status" id="so-status" aria-live="polite"></div>
        </div>
        <div class="so-actions">
          <button type="button" class="so-primary" id="so-create" disabled>Criar minha empresa</button>
          <button type="button" id="so-cancel">Cancelar</button>
        </div>
      </div>`;
    return el;
  }

  window.promptSlugOnboarding = function (ctx) {
    const S = window.ObraSlug;
    const db = firebase.database();

    return new Promise((resolve) => {
      injectStyle();
      const overlay = buildOverlay();
      document.body.appendChild(overlay);

      const $ = (id) => overlay.querySelector('#' + id);
      const nomeEl = $('so-nome');
      const slugEl = $('so-slug');
      const previewEl = $('so-preview-slug');
      const statusEl = $('so-status');
      const createBtn = $('so-create');
      const cancelBtn = $('so-cancel');

      let state = 'idle';        // idle | checking | ok | bad
      let slugTouched = false;   // se o usuário mexeu no slug, paramos de sugerir a partir do nome
      let checkSeq = 0;          // descarta respostas de checagens antigas
      let timer = null;
      let busy = false;

      const firstName = (ctx.name && ctx.name !== 'Sem Nome') ? ctx.name : '';
      nomeEl.value = S.cleanCompanyName(firstName ? `${firstName} Engenharia` : 'Minha Empresa');
      slugEl.value = S.suggestSlug(nomeEl.value, ctx.email);

      function setStatus(kind, text) {
        statusEl.className = 'so-status ' + kind;
        statusEl.textContent = text;
      }

      function render() {
        previewEl.textContent = slugEl.value || 'suaempresa';
        createBtn.disabled = busy || state !== 'ok';
      }

      async function check() {
        const seq = ++checkSeq;
        const v = S.validateSlug(slugEl.value);
        if (!v.ok) {
          state = 'bad';
          setStatus(slugEl.value ? 'bad' : 'wait', v.error);
          render();
          return;
        }
        state = 'checking';
        setStatus('wait', 'Verificando disponibilidade...');
        render();
        try {
          const taken = await S.isSlugTaken(db, v.slug);
          if (seq !== checkSeq) return;
          state = taken ? 'bad' : 'ok';
          setStatus(taken ? 'bad' : 'ok', taken ? 'Esse endereço já está em uso. Tente outro.' : 'Endereço disponível!');
        } catch (e) {
          if (seq !== checkSeq) return;
          state = 'bad';
          setStatus('bad', 'Não foi possível verificar agora. Tente de novo.');
        }
        render();
      }

      function scheduleCheck() {
        clearTimeout(timer);
        state = 'checking';
        render();
        timer = setTimeout(check, 350);
      }

      function close(result) {
        clearTimeout(timer);
        checkSeq++;
        overlay.remove();
        resolve(result);
      }

      nomeEl.addEventListener('input', () => {
        if (!slugTouched) slugEl.value = S.suggestSlug(nomeEl.value, ctx.email);
        render();
        if (!slugTouched) scheduleCheck();
      });

      slugEl.addEventListener('input', () => {
        slugTouched = true;
        const norm = S.normalizeSlug(slugEl.value);
        if (norm !== slugEl.value) slugEl.value = norm;
        scheduleCheck();
      });

      async function submit() {
        if (busy || state !== 'ok') return;
        busy = true;
        createBtn.textContent = 'Criando...';
        render();
        try {
          const created = await S.createTenantAccount(db, {
            slug: slugEl.value,
            nomeEmpresa: nomeEl.value,
            email: ctx.email,
            uid: ctx.uid,
            nome: ctx.name
          });
          close(created);
          return;
        } catch (err) {
          if (err && err.code === 'slug/taken') {
            state = 'bad';
            setStatus('bad', 'Esse endereço acabou de ser usado por outra empresa. Escolha outro.');
          } else if (err && err.code === 'slug/invalid') {
            state = 'bad';
            setStatus('bad', err.message);
          } else {
            console.error('[Slug] Erro ao criar empresa:', err);
            state = 'ok';
            setStatus('bad', 'Não foi possível criar a empresa agora. Tente novamente em instantes.');
          }
        }
        busy = false;
        createBtn.textContent = 'Criar minha empresa';
        render();
      }

      createBtn.addEventListener('click', submit);
      cancelBtn.addEventListener('click', () => { if (!busy) close(null); });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        if (e.key === 'Escape' && !busy) close(null);
      });

      render();
      check();
      slugEl.focus();
    });
  };

  // Chegada no subdomínio recém-criado (produção): avisa e já deixa o e-mail preenchido.
  function showWelcomeIfAny() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bemvindo') !== '1') return;
    const form = document.getElementById('login-form');
    if (!form) return;

    const email = params.get('email') || '';
    const banner = document.createElement('div');
    banner.className = 'so-welcome';
    banner.textContent = 'Empresa criada! Entre com ' + (email || 'o mesmo e-mail do cadastro') + ' para abrir o seu painel.';
    injectStyle();
    form.parentNode.insertBefore(banner, form);

    const emailInput = document.getElementById('auth-email');
    if (emailInput && email) emailInput.value = email;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showWelcomeIfAny);
    else showWelcomeIfAny();
  }
})();
