import { sb, errMsg } from '../api.js';
import { esc, icon, toast } from '../ui.js';
import { APP_NAME } from '../config.js';
import { endRecovery } from '../app.js';

const redirect = () => location.origin + location.pathname;

function shell(inner) {
  document.getElementById('app').innerHTML = `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-mark big">D</span><div><h1>${APP_NAME}</h1><p>Tous tes projets, au même endroit.</p></div></div>
      ${inner}
    </div>
    <p class="auth-foot">Dev · RP · Perso · et tout le reste</p>
  </div>`;
}

export function renderLogin(mode = 'login') {
  const titles = { login: 'Connexion', signup: 'Créer un compte', forgot: 'Mot de passe oublié' };
  shell(`
    <div class="seg" role="tablist">
      <button class="${mode === 'login' ? 'on' : ''}" data-mode="login">Connexion</button>
      <button class="${mode === 'signup' ? 'on' : ''}" data-mode="signup">Créer un compte</button>
    </div>
    <form class="auth-form" novalidate>
      <h2 class="sr-only">${titles[mode]}</h2>
      <label class="field"><span>Email</span><input class="input" type="email" name="email" required autocomplete="email" autofocus></label>
      ${mode !== 'forgot' ? `<label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" required minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>` : ''}
      ${mode === 'signup' ? `<label class="field"><span>Confirmer le mot de passe</span><input class="input" type="password" name="password2" required minlength="6" autocomplete="new-password"></label>` : ''}
      <p class="auth-error" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${icon(mode === 'forgot' ? 'mail' : 'log-in')} ${mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}</button>
      ${mode === 'login' ? '<button type="button" class="link-btn" data-mode="forgot">Mot de passe oublié ?</button>' : ''}
      ${mode === 'forgot' ? '<button type="button" class="link-btn" data-mode="login">← Retour à la connexion</button>' : ''}
    </form>`);

  const app = document.getElementById('app');
  app.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => renderLogin(b.dataset.mode)));
  const form = app.querySelector('form');
  const errEl = app.querySelector('.auth-error');
  const showErr = (m) => { errEl.textContent = m; errEl.hidden = !m; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const email = form.email.value.trim();
    const password = form.password?.value;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    showErr('');
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (password !== form.password2.value) throw new Error('Les deux mots de passe ne correspondent pas.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
        if (error) throw error;
        if (!data.session) {
          shell(`<div class="auth-msg">${icon('mail-check', 'ic-xl')}<h2>Vérifie ta boîte mail</h2>
            <p>Un lien de confirmation a été envoyé à <b>${esc(email)}</b>. Clique dessus puis reviens te connecter.</p>
            <button class="btn btn-primary btn-block" data-back>Retour à la connexion</button></div>`);
          document.querySelector('[data-back]').onclick = () => renderLogin('login');
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect() });
        if (error) throw error;
        toast('Lien envoyé ! Regarde ta boîte mail.');
        renderLogin('login');
      }
    } catch (err) {
      showErr(errMsg(err));
    } finally {
      btn.disabled = false;
    }
  });
}

export function renderReset() {
  shell(`
    <form class="auth-form" novalidate>
      <h2>Nouveau mot de passe</h2>
      <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="password" required minlength="6" autocomplete="new-password" autofocus></label>
      <label class="field"><span>Confirmer</span><input class="input" type="password" name="password2" required minlength="6" autocomplete="new-password"></label>
      <p class="auth-error" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${icon('key-round')} Enregistrer</button>
    </form>`);
  const form = document.querySelector('.auth-form');
  const errEl = form.querySelector('.auth-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.password.value !== form.password2.value) { errEl.textContent = 'Les deux mots de passe ne correspondent pas.'; errEl.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: form.password.value });
    if (error) { errEl.textContent = errMsg(error); errEl.hidden = false; return; }
    toast('Mot de passe modifié.');
    history.replaceState(null, '', location.pathname);
    endRecovery();
  });
}
