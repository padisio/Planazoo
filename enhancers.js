// --- Enhancers v4 ---
function enhanceHist(){
  const hist = document.querySelector('#hist');
  if(!hist) return;
  hist.querySelectorAll('.card').forEach(card=>{
    const rows = card.querySelectorAll('.row');
    if(!rows.length) return;
    const r = rows[rows.length-1];
    const btns = Array.from(r.querySelectorAll('button'));
    if(!btns.length) return;
    let wrap = r.querySelector('.btngrp');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className='btngrp';
      r.innerHTML='';
      r.appendChild(wrap);
    }
    const order = ['Abrir','Publicar','Valorar','Cancelar','Borrar'];
    if(!btns.some(b=>b.textContent.trim().toLowerCase().includes('publicar'))){
      const id = (card.querySelector('[data-id]')?.dataset.id) || (card.querySelector('button')?.getAttribute('onclick')||'').match(/\"(.*?)\"/)?.[1] || '';
      const b = document.createElement('button');
      b.className='btn s';
      b.textContent='Publicar';
      b.onclick=()=>publishPlan(id);
      btns.push(b);
    }
    order.forEach(lbl=>{
      const b = btns.find(x=>x && x.textContent && x.textContent.trim().toLowerCase().includes(lbl.toLowerCase()));
      if(b) wrap.appendChild(b);
    });
  });
}
if(typeof renderHist==='function'){
  const __renderHist = renderHist;
  renderHist = function(){ __renderHist(); setTimeout(enhanceHist,0); }
}

// Voting UI tweak
function enhanceVote(){
  const mv = document.querySelector('#mv');
  if(!mv) return;
  mv.querySelectorAll('button').forEach(b=>{
    if(b.textContent.trim().toLowerCase()==='cerrar'){
      b.textContent='Finalizar votación';
    }
  });
  mv.querySelectorAll('.row.actions, .row.vote-actions').forEach(x=>{
    x.classList.add('vote-actions');
  });
}
if(typeof openVote==='function'){
  const __openVote = openVote;
  openVote = function(){
    __openVote.apply(null, arguments);
    setTimeout(enhanceVote,0);
  }
}

// Service worker registration (safe)
try{
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    });
  }
}catch(_){}
