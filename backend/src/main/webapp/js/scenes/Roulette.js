const q = s => document.querySelector(s);
const betsEl = q('#bets');
const engagedEl = q('#engaged');
const msgEl = q('#msg');
const lastEl = q('#last');
const balanceEl = q('#balance');
const amountIn = q('#amount');
const typeSel = q('#type');
const paramWrap = q('#param-wrap');
const paramIn = q('#param');

let localBets = []; // {type, amount, param}

function euros(n){ return Number(n).toFixed(2) + ' €'; }

function setMsg(t){ msgEl.textContent = t || ''; }

function renderBets(){
  betsEl.innerHTML = '';
  if(localBets.length === 0){ betsEl.innerHTML = '<li>Aucune mise.</li>'; engagedEl.textContent = 'Total engagé : 0.00 €'; return; }
  let total = 0;
  localBets.forEach(b=>{
    total += Number(b.amount);
    const li = document.createElement('li');
    li.textContent = `• ${b.type}${b.param!=null?' '+b.param:''} : ${euros(b.amount)}`;
    betsEl.appendChild(li);
  });
  engagedEl.textContent = `Total engagé : ${euros(total)}`;
}

function needsParam(type){
  return type==='STRAIGHT' || type==='DOZEN' || type==='COLUMN';
}

typeSel.addEventListener('change', ()=>{
  const t = typeSel.value;
  paramWrap.classList.toggle('hidden', !needsParam(t));
  paramIn.value = '';
  if(t==='STRAIGHT') paramIn.placeholder = '0..36';
  else if(t==='DOZEN'||t==='COLUMN') paramIn.placeholder = '1..3';
  else paramIn.placeholder='';
});

// helpers HTTP
function postForm(url, data){
  return fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body: new URLSearchParams(data).toString()
  }).then(r=>r.text());
}

function getState(){
  // GET /roulette renvoie un texte (“Solde…”, “Mises en cours…”) – on tente d’extraire le solde si présent.
  return fetch(BASE).then(r=>r.text()).then(txt=>{
    const m = txt.match(/Solde\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if(m) balanceEl.textContent = 'Solde : ' + euros(m[1]);
    return txt;
  });
}

// Form “Ajouter mise”
q('#bet-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  setMsg('');
  const type = typeSel.value;
  const amount = amountIn.value;
  let data = {action:'bet', type, amount};
  if(needsParam(type)){
    const p = paramIn.value.trim();
    if(!p){ setMsg('Paramètre requis.'); return; }
    data.param = p;
  }
  postForm(BASE, data).then(txt=>{
    // serveur répond en texte ; on se fie à la présence de “Erreur”
    if(/Erreur/i.test(txt)) { setMsg(txt); return; }
    // OK côté serveur → on mémorise localement
    localBets.push({type, amount, param: data.param ?? null});
    renderBets();
    setMsg('Mise ajoutée.');
  }).catch(err=> setMsg('Erreur réseau: '+err.message));
});

// Bouton Effacer
q('#clear').addEventListener('click', ()=>{
  setMsg('');
  postForm(BASE, {action:'clear'}).then(()=>{
    localBets = [];
    renderBets();
    setMsg('Mises effacées.');
  });
});

// Bouton Spin
q('#spin').addEventListener('click', ()=>{
  setMsg('');
  postForm(BASE, {action:'spin'}).then(txt=>{
    // Exemple de réponse :
    // Résultat : 17 (RED)
    // Gain total : 10.00 €
    // Nouveau solde : 995.00 €
    const num = txt.match(/Résultat\s*:\s*(\d+)\s*\((RED|BLACK|GREEN)\)/i);
    const gain = txt.match(/Gain total\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    const solde = txt.match(/Nouveau solde\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);

    if(num){
      lastEl.textContent = `Dernier résultat : ${num[1]} (${num[2].toUpperCase()})`;
    } else {
      lastEl.textContent = 'Dernier résultat : —';
    }
    if(solde){ balanceEl.textContent = 'Solde : ' + euros(solde[1]); }
    localBets = []; renderBets();
    setMsg(gain ? `Encaissement : ${euros(gain[1])}` : txt);
  }).catch(err=> setMsg('Erreur réseau: '+err.message));
});

// Construire la grille 0..36
(function buildGrid(){
  const grid = q('#grid');
  // “0” tout seul
  const z = document.createElement('div');
  z.className = 'cell green'; z.textContent = '0';
  z.title = 'Miser sur 0 (plein)';
  z.addEventListener('click', ()=> quickStraight(0));
  grid.appendChild(z);

  // 1..36 par 3 colonnes
  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  for(let row=0; row<12; row++){
    for(let col=0; col<3; col++){
      const n = row*3 + (col+1);
      const d = document.createElement('div');
      d.className = 'cell ' + (reds.has(n)?'red':'black');
      d.textContent = String(n);
      d.title = `Miser sur ${n} (plein)`;
      d.addEventListener('click', ()=> quickStraight(n));
      grid.appendChild(d);
    }
  }
})();

function quickStraight(n){
  const amt = amountIn.value || '1.00';
  postForm(BASE, {action:'bet', type:'STRAIGHT', amount: amt, param: n})
    .then(txt=>{
      if(/Erreur/i.test(txt)) { setMsg(txt); return; }
      localBets.push({type:'STRAIGHT', amount:amt, param:n});
      renderBets(); setMsg(`Mise plein ${n} ajoutée.`);
    });
}

// Raccourcis
document.querySelectorAll('.quick button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const type = b.dataset.quick;
    const param = b.dataset.param ?? null;
    const amt = amountIn.value || '1.00';
    const data = {action:'bet', type, amount: amt};
    if(param) data.param = param;
    postForm(BASE, data).then(txt=>{
      if(/Erreur/i.test(txt)) { setMsg(txt); return; }
      localBets.push({type, amount:amt, param:param?Number(param):null});
      renderBets(); setMsg('Mise ajoutée.');
    });
  });
});

// init
renderBets();
getState();
