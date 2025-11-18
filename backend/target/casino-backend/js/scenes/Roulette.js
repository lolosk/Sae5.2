import { addSoundToggle } from '../utils/soundToggle.js';
import { api } from '../utils/api.js';
import { playSfx } from '../utils/sfx.js';

export class Roulette extends Phaser.Scene {
  constructor(){ super('Roulette'); }

  preload() {
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');
    // (option) images de roue/table si tu veux animer vraiment la roue plus tard
  }

  create() {
    const { width, height } = this.scale.gameSize;

    // Guard: doit être connecté
    const u0 = this.registry.get('user');
    if (!u0) { this.scene.start('Login'); return; }

    addSoundToggle(this);

    // Fond + logo
    this.background = this.add.tileSprite(width/2, height/2, 1280, 720, 'background').setOrigin(0.5);
    const logo = this.add.image(width/2, height*0.16, 'logo').setOrigin(0.5);
    const s = Math.min(width*0.40 / logo.width, height*0.20 / logo.height);
    logo.setScale(s);
    this.tweens.add({ targets: logo, scaleX:s*1.02, scaleY:s*1.02, duration:1400, ease:'Sine.inOut', yoyo:true, loop:-1 });

    // Carte DOM (mise + choix)
    const cardW = Math.min(560, width*0.95);
    const cardHTML = `
      <style>
        .card { width:${cardW}px; padding:18px 20px; border-radius:16px;
          background: rgba(6,12,24,0.75); border:1px solid rgba(255,255,255,0.12);
          box-shadow:0 12px 36px rgba(0,0,0,.45); color:#eaf4ff; font-family:system-ui, Arial;
          backdrop-filter: blur(6px);
        }
        h2 { margin:0 0 10px; font-size:20px; }
        .row { display:flex; gap:10px; align-items:center; margin:8px 0; flex-wrap:wrap; }
        label { font-size:14px; opacity:.9; }
        input, select { padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.08); color:#eaf4ff; outline:none; }
        input:focus, select:focus { background:rgba(255,255,255,0.12); border-color:#1e90ff; box-shadow:0 0 0 3px rgba(30,144,255,0.15); }
        button { padding:12px 16px; border:none; border-radius:14px; cursor:pointer; color:white; font-weight:700;
          background:linear-gradient(180deg,#1e90ff,#0b6bd3); box-shadow:0 10px 28px rgba(0,0,0,.35); }
        button:disabled { opacity:.6; cursor:not-allowed; }
        .small { font-size:12px; opacity:.8; }
        .outcome { margin-top:12px; font-size:16px; }
        .error { color:#ff8b8b; font-size:13px; display:none; margin-top:6px; }
        .show { display:block; }
      </style>
      <div class="card">
        <h2>Roulette</h2>
        <div class="row">
          <label for="bet">Mise</label>
          <input id="bet" type="number" min="1" step="1" value="10" style="width:90px" />
          <span class="small">Crédits: <strong id="credits">${u0.credits ?? 0}</strong></span>
        </div>
        <div class="row">
          <label for="choice">Choix</label>
          <select id="choice">
            <option value="red">Rouge (1:1)</option>
            <option value="black">Noir (1:1)</option>
            <option value="odd">Impair (1:1)</option>
            <option value="even">Pair (1:1)</option>
            <option value="green">Vert (35:1)</option>
            <option value="number">Numéro (35:1)</option>
          </select>
          <input id="num" type="number" min="0" max="36" placeholder="0..36" style="width:100px; display:none;" />
        </div>
        <div class="row">
          <button id="spin">Lancer</button>
          <span id="err" class="error">Erreur.</span>
        </div>
        <div id="out" class="outcome"></div>
      </div>
    `;
    const dom = this.add.dom(width/2, height*0.60).createFromHTML(cardHTML).setOrigin(0.5);
    const root = dom.node;
    const betEl = root.querySelector('#bet');
    const choiceEl = root.querySelector('#choice');
    const numEl = root.querySelector('#num');
    const spinBtn = root.querySelector('#spin');
    const errEl = root.querySelector('#err');
    const outEl = root.querySelector('#out');
    const creditsEl = root.querySelector('#credits');

    choiceEl.addEventListener('change', () => {
      numEl.style.display = choiceEl.value === 'number' ? 'inline-block' : 'none';
    });

    // Action SPIN
    spinBtn.addEventListener('click', async () => {
      errEl.classList.remove('show'); outEl.textContent = '';
      const bet = parseInt(betEl.value, 10) || 0;
      const choice = choiceEl.value;
      const number = numEl.style.display !== 'none' ? parseInt(numEl.value, 10) : null;

      if (bet <= 0) {
        errEl.textContent = 'Mise invalide.'; errEl.classList.add('show'); return;
      }
      if (choice === 'number' && (Number.isNaN(number) || number < 0 || number > 36)) {
        errEl.textContent = 'Numéro invalide (0..36).'; errEl.classList.add('show'); return;
      }

      spinBtn.disabled = true;

      try {
        const body = { bet, choice };
        if (choice === 'number') body.number = number;

        const res = await api('api/roulette/spin', { method:'POST', body });
        // outcome
        const n = res.outcome.number;
        const color = res.outcome.color;
        const win = !!res.win;
        const payout = res.payout;
        const credits = res.credits;

        // Petite animation de feedback
        this.cameras.main.flash(win ? 200 : 100, win ? 80 : 160, win ? 200 : 60, 60);
        playSfx?.(this, win ? 'ui_click' : 'ui_hover', { volume: 0.6 });

        outEl.textContent = `Résultat: ${n} (${color}) — ${win ? 'Gagné' : 'Perdu'} ${win ? '(+'+payout+')' : ''}`;
        creditsEl.textContent = credits;

        // MAJ registre + HUD Menu
        const user = this.registry.get('user') || {};
        user.credits = credits;
        this.registry.set('user', user);
        this.game.events.emit('credits:update', credits);

      } catch (e) {
        if (e.status === 409) errEl.textContent = 'Crédits insuffisants.';
        else if (e.status === 401) errEl.textContent = 'Session expirée. Reconnecte-toi.';
        else if (e.status === 400) errEl.textContent = 'Requête invalide.';
        else errEl.textContent = 'Erreur serveur.';
        errEl.classList.add('show');
        if (e.status === 401) this.scene.start('Login');
      } finally {
        spinBtn.disabled = false;
      }
    });
  }

  update() {
    this.background.tilePositionX += 2;
  }
}
