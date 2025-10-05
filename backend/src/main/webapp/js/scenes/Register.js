import { addSoundToggle } from '../utils/soundToggle.js';

// src/scenes/Register.js
export class Register extends Phaser.Scene {
  constructor() {
    super('Register');
  }

  preload() {
    // Mêmes assets que Start
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');

  }

  create() {
    const { width, height } = this.scale.gameSize;

    //Bouton son
    addSoundToggle(this);

    // --- Fond animé identique à l'accueil
    this.background = this.add
      .tileSprite(width / 2, height / 2, 1280, 720, 'background')
      .setOrigin(0.5);

    // --- Logo identique (+ petite respiration)
    const logo = this.add.image(width / 2, height * 0.22, 'logo').setOrigin(0.5);
    const maxW = width * 0.60, maxH = height * 0.32;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    logo.setScale(s);
    this.tweens.add({
      targets: logo,
      scaleX: s * 1.025, scaleY: s * 1.025,
      duration: 1400, ease: 'Sine.inOut', yoyo: true, loop: -1
    });

    // --- Carte/formulaire DOM (username / password / bouton)
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
        button:active { transform: translateY(1px) scale(.99); }
        .link { margin-top:10px; text-align:right; font-size:14px; }
        .link a { color:#ffd54d; text-decoration:none; }
        .link a:hover { text-decoration:underline; }
        .error { color:#ff8b8b; font-size:13px; display:none; margin-top:6px; }
        .show { display:block; }
      </style>
      <div class="card">
        <h1>Créer un profil</h1>
        <p class="sub">Inscris-toi pour accéder au casino R&amp;T.</p>
        <form id="f">
          <div class="field">
            <label for="u">Nom d'utilisateur</label>
            <input id="u" name="username" type="text" required minlength="3" maxlength="32" autocomplete="username" placeholder="ex. porc_eth54" />
            <div id="ue" class="error">3–32 caractères (lettres, chiffres, . _ -)</div>
          </div>
          <div class="field">
            <label for="p">Mot de passe</label>
            <input id="p" name="password" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="••••••••" />
            <div id="pe" class="error">Au moins 6 caractères.</div>
          </div>
          <div class="actions">
            <button type="submit">Créer profil</button>
          </div>
          <div class="link">
            <a href="#" id="goLogin">Déjà un compte ? Se connecter</a>
          </div>
        </form>
      </div>
    `;

    // On place le DOM centré
    const dom = this.add.dom(width / 2, height * 0.58).createFromHTML(cardHTML);
    dom.setOrigin(0.5);

    // --- Logic form côté client (aujourd’hui: retour menu ; plus tard: POST Servlet)
    const root  = dom.node;
    const form  = root.querySelector('#f');
    const u     = root.querySelector('#u');
    const p     = root.querySelector('#p');
    const ue    = root.querySelector('#ue');
    const pe    = root.querySelector('#pe');
    const goLogin = root.querySelector('#goLogin');

    const userRe = /^[a-zA-Z0-9._-]{3,32}$/;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      ue.classList.remove('show'); pe.classList.remove('show');

      let ok = true;
      if (!userRe.test(u.value)) { ue.classList.add('show'); ok = false; }
      if (!p.value || p.value.length < 6) { pe.classList.add('show'); ok = false; }
      if (!ok) return;

      // Version actuelle : retour à l'accueil (même modèle Phaser)
      this.scene.start('Start');

      // Version Servlet plus tard :
      /*
      try {
        const res = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ username: u.value.trim(), password: p.value })
        });
        if (!res.ok) { alert('Erreur: ' + (await res.text())); return; }
        this.scene.start('Start');
      } catch (err) {
        alert('Réseau indisponible. Réessaie.');
      }
      */
    });

    goLogin.addEventListener('click', (e) => {
      e.preventDefault();
      // Si tu veux une LoginScene plus tard :
      this.scene.start('Login');
    });
  }

  update() {
    // Fond qui défile comme sur Start
    this.background.tilePositionX += 2;
  }
}
