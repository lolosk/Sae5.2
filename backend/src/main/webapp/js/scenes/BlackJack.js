import { addSoundToggle } from '../utils/soundToggle.js';
import { api } from '../utils/api.js';
import { playSfx } from '../utils/sfx.js';

export class BlackJack extends Phaser.Scene {
  constructor(){ super('BlackJack'); }

  preload() {
    this.load.image('background', 'assets/menu/bg.png');
    this.load.image('logo', 'assets/menu/logo.png');
  }

  create() {
    const { width, height } = this.scale.gameSize;
    const u0 = this.registry.get('user');
    if (!u0) return this.scene.start('Login');

    addSoundToggle(this);

    // Fond + logo
    this.background = this.add.tileSprite(width/2, height/2, 1280, 720, 'background').setOrigin(0.5);
    const logo = this.add.image(width/2, height*0.16, 'logo').setOrigin(0.5);
    const s = Math.min(width*0.40 / logo.width, height*0.20 / logo.height);
    logo.setScale(s);
    this.tweens.add({ targets: logo, scaleX:s*1.02, scaleY:s*1.02, duration:1400, ease:'Sine.inOut', yoyo:true, loop:-1 });

    // Carte DOM
    const cardW = Math.min(600, width*0.95);
    const html = `
      <style>
        .card { width:${cardW}px; padding:18px 20px; border-radius:16px;
          background: rgba(6,12,24,0.75); border:1px solid rgba(255,255,255,0.12);
          box-shadow:0 12px 36px rgba(0,0,0,.45); color:#eaf4ff; font-family:system-ui, Arial;
          backdrop-filter: blur(6px);
        }
        h2 { margin:0 0 10px; font-size:20px; }
        .row { display:flex; gap:10px; align-items:center; margin:8px 0; flex-wrap:wrap; }
        label { font-size:14px; opacity:.9; }
        input { padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.08); color:#eaf4ff; outline:none; }
        button { padding:10px 14px; border:none; border-radius:12px; cursor:pointer; color:white; font-weight:700;
          background:linear-gradient(180deg,#1e90ff,#0b6bd3); box-shadow:0 10px 28px rgba(0,0,0,.35); }
        button:disabled { opacity:.6; cursor:not-allowed; }
        .hand { font-size:18px; }
        .status { margin-top:8px; font-size:16px; }
        .error { color:#ff8b8b; font-size:13px; display:none; margin-top:6px; }
        .show { display:block; }
        .small { font-size:12px; opacity:.8; }
      </style>
      <div class="card">
        <h2>BlackJack</h2>
        <div class="row">
          <label for="bet">Mise</label>
          <input id="bet" type="number" min="1" step="1" value="10" style="width:90px" />
          <span class="small">Crédits: <strong id="credits">${u0.credits ?? 0}</strong></span>
          <button id="start">Start</button>
          <button id="hit" disabled>Hit</button>
          <button id="stand" disabled>Stand</button>
        </div>
        <div class="row hand"><b>Joueur:</b> <span id="p"></span></div>
        <div class="row hand"><b>Croupier:</b> <span id="d"></span></div>
        <div id="status" class="status"></div>
        <div id="err" class="error">Erreur</div>
      </div>
    `;
    const dom = this.add.dom(width/2, height*0.60).createFromHTML(html).setOrigin(0.5);
    const root = dom.node;
    const betEl = root.querySelector('#bet');
    const creditsEl = root.querySelector('#credits');
    const startBtn = root.querySelector('#start');
    const hitBtn   = root.querySelector('#hit');
    const standBtn = root.querySelector('#stand');
    const pEl = root.querySelector('#p');
    const dEl = root.querySelector('#d');
    const statusEl = root.querySelector('#status');
    const errEl = root.querySelector('#err');

    const showState = (state) => {
      pEl.textContent = state.player.join(' ');
      dEl.textContent = state.dealer.join(' ');
      statusEl.textContent = (state.status === 'playing') ? 'À toi de jouer…' : `Résultat: ${state.status}`;
    };

    startBtn.addEventListener('click', async () => {
      errEl.classList.remove('show'); statusEl.textContent = '';
      const bet = parseInt(betEl.value, 10) || 0;
      if (bet <= 0) { errEl.textContent='Mise invalide'; errEl.classList.add('show'); return; }
      startBtn.disabled = hitBtn.disabled = standBtn.disabled = true;
      try {
        const res = await api('api/blackjack/start', { method:'POST', body:{ bet } });
        showState(res.state);
        creditsEl.textContent = res.credits;
        this._playing = true;
        startBtn.disabled = true;
        hitBtn.disabled = false;
        standBtn.disabled = false;

        // MAJ HUD
        const user = this.registry.get('user') || {};
        user.credits = res.credits;
        this.registry.set('user', user);
        this.game.events.emit('credits:update', res.credits);

      } catch (e) {
        if (e.status === 409) errEl.textContent = 'Crédits insuffisants.';
        else if (e.status === 401) { errEl.textContent = 'Session expirée.'; this.scene.start('Login'); return; }
        else errEl.textContent = 'Erreur serveur.';
        errEl.classList.add('show');
      } finally {
        // si erreur, réactiver start
        if (!this._playing) startBtn.disabled = false;
      }
    });

    hitBtn.addEventListener('click', async () => {
      errEl.classList.remove('show');
      hitBtn.disabled = standBtn.disabled = true;
      try {
        const res = await api('api/blackjack/hit', { method:'POST' });
        showState(res.state);
        // si bust → fin
        if (res.state.status !== 'playing') {
          this._playing = false;
          startBtn.disabled = false;
          playSfx?.(this, 'ui_hover');
        } else {
          // encore ton tour
          hitBtn.disabled = false;
          standBtn.disabled = false;
        }
      } catch (e) {
        errEl.textContent = (e.status===401)?'Session expirée.':'Erreur serveur.'; errEl.classList.add('show');
        if (e.status===401) this.scene.start('Login');
      }
    });

    standBtn.addEventListener('click', async () => {
      errEl.classList.remove('show');
      hitBtn.disabled = standBtn.disabled = true;
      try {
        const res = await api('api/blackjack/stand', { method:'POST' });
        showState(res.state);
        statusEl.textContent += res.payout ? ` (+${res.payout})` : '';
        creditsEl.textContent = res.credits;

        // fin de main
        this._playing = false;
        startBtn.disabled = false;

        // MAJ HUD
        const user = this.registry.get('user') || {};
        user.credits = res.credits;
        this.registry.set('user', user);
        this.game.events.emit('credits:update', res.credits);

        playSfx?.(this, 'ui_click');

      } catch (e) {
        errEl.textContent = (e.status===401)?'Session expirée.':'Erreur serveur.'; errEl.classList.add('show');
        if (e.status===401) this.scene.start('Login');
      }
    });
  }

  update(){ this.background.tilePositionX += 2; }
}
