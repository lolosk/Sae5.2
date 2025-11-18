// src/scenes/Login.js
import { addSoundToggle } from '../utils/soundToggle.js';
import { api } from '../utils/api.js';

export class Login extends Phaser.Scene {
  constructor() { super('Login'); }

  preload() {
    // Si Boot charge déjà ces assets, ce preload est optionnel.
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');
  }

  create() {
    const { width, height } = this.scale.gameSize;

    // --- Bouton son (haut-gauche)
    addSoundToggle(this);

    // --- Fond animé
    this.background = this.add
      .tileSprite(width / 2, height / 2, 1280, 720, 'background')
      .setOrigin(0.5);

    // --- Logo
    const logo = this.add.image(width / 2, height * 0.22, 'logo').setOrigin(0.5);
    const maxW = width * 0.60, maxH = height * 0.32;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    logo.setScale(s);
    this.tweens.add({
      targets: logo,
      scaleX: s * 1.025, scaleY: s * 1.025,
      duration: 1400, ease: 'Sine.inOut', yoyo: true, loop: -1
    });

    // --- Carte login (DOM)
    const cardW = Math.min(520, width * 0.9);
    const cardHTML = `
      <style>
        .card { width:${cardW}px; padding:20px 22px; border-radius:18px;
          background: rgba(6,12,24,0.72); border:1px solid rgba(255,255,255,0.12);
          box-shadow:0 12px 40px rgba(0,0,0,0.45); color:#eaf4ff; font-family:system-ui, Arial, sans-serif;
          backdrop-filter: blur(6px);
        }
        h1 { margin:0 0 6px; font-size:22px; }
        p.sub { margin:0 0 14px; opacity:.85; font-size:14px; }
        .field { margin:10px 0; }
        label { display:block; font-size:14px; margin-bottom:6px; opacity:.9; }
        input { width:100%; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.08); color:#eaf4ff; outline:none; transition:.15s;
        }
        input:focus { background:rgba(255,255,255,0.12); border-color:#1e90ff; box-shadow:0 0 0 3px rgba(30,144,255,0.15); }
        .actions { display:flex; gap:10px; margin-top:14px; }
        button { flex:1; padding:12px 16px; border:none; border-radius:14px; cursor:pointer; color:white; font-weight:700; letter-spacing:.3px;
          background:linear-gradient(180deg,#1e90ff,#0b6bd3); box-shadow:0 10px 28px rgba(0,0,0,.35); }
        button:disabled { opacity: .6; cursor: not-allowed; }
        button:active { transform: translateY(1px) scale(.99); }
        .link { margin-top:10px; text-align:right; font-size:14px; }
        .link a { color:#ffd54d; text-decoration:none; }
        .link a:hover { text-decoration:underline; }
        .error { color:#ff8b8b; font-size:13px; display:none; margin-top:6px; }
        .show { display:block; }
        .hint { margin-top:8px; font-size:12px; opacity:.75; }
        .hint code { background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:6px; }
      </style>
      <div class="card">
        <h1>Se connecter</h1>
        <p class="sub">Entre tes identifiants pour accéder au casino R&amp;T.</p>
        <form id="f">
          <div class="field">
            <label for="u">Nom d'utilisateur</label>
            <input id="u" name="username" type="text" required minlength="3" maxlength="32" autocomplete="username" placeholder="ex. admin" />
          </div>
          <div class="field">
            <label for="p">Mot de passe</label>
            <input id="p" name="password" type="password" required minlength="4" maxlength="128" autocomplete="current-password" placeholder="••••" />
          </div>
          <div id="err" class="error">Identifiants invalides.</div>
          <div class="actions">
            <button id="submitBtn" type="submit">Se connecter</button>
          </div>
          <div class="hint">Compte de test : <code>admin / 1234</code></div>
          <div class="link">
            <a href="#" id="goRegister">Pas de compte ? S’inscrire</a>
          </div>
        </form>
      </div>
    `;

    const dom = this.add.dom(width / 2, height * 0.58).createFromHTML(cardHTML);
    dom.setOrigin(0.5);

    // --- Logic formulaire
    const root  = dom.node;
    const form  = root.querySelector('#f');
    const u     = root.querySelector('#u');
    const p     = root.querySelector('#p');
    const errEl = root.querySelector('#err');
    const btn   = root.querySelector('#submitBtn');
    const goRegister = root.querySelector('#goRegister');

    const userRe = /^[a-zA-Z0-9._-]{3,32}$/;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.classList.remove('show');

      // Validation minimale (mot de passe >= 4)
      if (!userRe.test(u.value) || !p.value || p.value.length < 4) {
        errEl.textContent = 'Vérifie le format du nom d’utilisateur et un mot de passe (≥ 4).';
        errEl.classList.add('show');
        return;
      }

      btn.disabled = true;

      try {
        // Appel à la Servlet (crée la session si OK)
        const { user } = await api('api/login', {
          method: 'POST',
          body: { username: u.value.trim(), password: p.value }
        });

        // Sauvegarde côté Phaser (utilisé par Menu, etc.)
        this.registry.set('user', user);

        // Rediriger vers le Menu
        this.scene.start('Menu');

      } catch (err) {
        errEl.textContent = (err.status === 401)
          ? 'Identifiants invalides (essaie admin / 1234).'
          : 'Erreur réseau/serveur. Réessaie.';
        errEl.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });

    goRegister.addEventListener('click', (e) => {
      e.preventDefault();
      this.scene.start('Register');
    });
  }

  update() {
    this.background.tilePositionX += 2;
  }
}
