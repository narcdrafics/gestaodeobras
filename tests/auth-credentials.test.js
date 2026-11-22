// tests/auth-credentials.test.js
// Contratos da recuperação de senha e da entrega de credenciais ao novo usuário.
// O projeto usa testes de inspeção de fonte para garantir que esses fluxos
// (que dependem de Firebase/Hosting) não sejam removidos por acidente.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const loginHtml = read('public/login.html');
const authSrc = read('public/js/auth_core.js');
const appSrc = read('public/js/app_core.js');
const usuariosFn = read('functions/usuarios.js');
const functionsIndex = read('functions/index.js');
const firebaseJson = read('firebase.json');
const credModal = read('public/modals/modal-credenciais-usuario.html');
const appCss = read('public/css/app.css');

describe('login — recuperação de senha', () => {
  it('oferece um link "Esqueceu?" que abre o painel de recuperação', () => {
    expect(loginHtml).toContain('onclick="abrirRecuperacaoSenha()"');
    expect(loginHtml).toContain('id="recovery-panel"');
    expect(loginHtml).toContain('id="recovery-email"');
    expect(loginHtml).toContain('onclick="enviarLinkRecuperacao()"');
    expect(loginHtml).toContain('onclick="fecharRecuperacaoSenha()"');
    expect(loginHtml).not.toContain('href="#" style="color:var(--accent)'); // link morto antigo
  });

  it('envia o link nativo do Firebase Auth sem revelar se o e-mail existe', () => {
    expect(authSrc).toContain('function abrirRecuperacaoSenha()');
    expect(authSrc).toContain('async function enviarLinkRecuperacao()');
    expect(authSrc).toContain('firebase.auth().sendPasswordResetEmail(email)');
    expect(authSrc).toContain('Se o e-mail estiver cadastrado');
    const funcaoRecuperacao = authSrc.slice(
      authSrc.indexOf('async function enviarLinkRecuperacao()'),
      authSrc.indexOf('function normalizeUserRecord')
    );
    expect(funcaoRecuperacao).not.toContain('auth/user-not-found');
  });
});

describe('Cloud Function — criação de usuário com senha temporária', () => {
  it('é exportada e roteada no Hosting', () => {
    expect(functionsIndex).toContain("require('./usuarios')");
    expect(functionsIndex).toContain('exports.criarUsuarioTenant = criarUsuarioTenant;');
    expect(firebaseJson).toContain('"/api/admin/criar-usuario"');
    expect(firebaseJson).toContain('"function": "criarUsuarioTenant"');
  });

  it('exige token válido, cargo administrativo e convite do mesmo tenant', () => {
    expect(usuariosFn).toContain('admin.auth().verifyIdToken(match[1])');
    expect(usuariosFn).toContain("const ROLES_ADMIN = ['admin', 'super_admin']");
    expect(usuariosFn).toContain('!ROLES_ADMIN.includes(chamadorInfo.role)');
    expect(usuariosFn).toContain('invite.tenantId !== tenantId');
    expect(usuariosFn).toContain('email_vinculado_outro_tenant');
  });

  it('gera senha aleatória e nunca a grava no Realtime Database', () => {
    expect(usuariosFn).toContain('crypto.randomInt');
    expect(usuariosFn).toContain('admin.auth().createUser(');
    expect(usuariosFn).toContain('admin.auth().updateUser(');
    expect(usuariosFn).toContain('password: senha');
    expect(usuariosFn).not.toMatch(/invites[^\n]*senha/);
    expect(usuariosFn).not.toContain(".set({ password");
  });
});

describe('painel admin — exibição das credenciais', () => {
  it('chama a função autenticada ao criar um usuário', () => {
    expect(appSrc).toContain("fetch('/api/admin/criar-usuario'");
    expect(appSrc).toContain("'Authorization': 'Bearer ' + token");
    expect(appSrc).toContain('criarCredencialAuthUsuario(userData)');
    expect(appSrc).toContain("const userData = { email, name, role, tenantId };");
    expect(appSrc).toContain('CRED_ERRORES_FATAIS.includes(erroCredencial.code)');
    expect(appSrc).toContain('inviteRef.remove()');
    expect(appSrc).toContain('superAdminActiveTenant.id'); // tenant correto no Super Admin
  });

  it('abre um modal com e-mail, senha e botão de copiar', () => {
    expect(appSrc).toContain("openModal('modal-credenciais-usuario')");
    expect(appSrc).toContain('async function copiarCredenciaisUsuario()');
    expect(credModal).toContain('id="cred-usuario-email"');
    expect(credModal).toContain('id="cred-usuario-senha"');
    expect(credModal).toContain('onclick="copiarCredenciaisUsuario()"');
    expect(appCss).toContain('.credenciais-linha > code');
  });
});
