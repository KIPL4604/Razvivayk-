// Pointer gestures only. Legal moves and persistence stay in the game controller.
export function attachCardGestures({mount,enabled,source,swipe,drop,restoreHighlights}) {
  let pointer=null,ghost=null,highlight=null,suppressUntil=0;
  const clean=()=>{
    ghost?.remove();ghost=null;
    mount.querySelectorAll('.card-drop-ready,.card-drop-over,.card-drag-source').forEach(e=>e.classList.remove('card-drop-ready','card-drop-over','card-drag-source'));
    highlight=null;
  };
  function cancel(){
    const old=pointer;pointer=null;clean();
    if(old&&mount.hasPointerCapture(old.id))mount.releasePointerCapture(old.id);
    restoreHighlights?.();
  }
  function beginDrag(){
    const p=pointer;
    ghost=document.createElement('div');ghost.className='card-drag-ghost';ghost.setAttribute('aria-hidden','true');
    ghost.style.width=p.rect.width+'px';
    p.nodes.forEach(node=>{
      const r=node.getBoundingClientRect(),copy=document.createElement('div');
      copy.innerHTML=node.querySelector('.playing-card').outerHTML;
      copy.style.cssText=`position:absolute;left:${r.x-p.rect.x}px;top:${r.y-p.rect.y}px;width:${r.width}px`;
      copy.querySelectorAll('[data-card-key]').forEach(e=>e.removeAttribute('data-card-key'));
      ghost.append(copy);node.classList.add('card-drag-source');
    });
    document.body.append(ghost);p.targets.forEach(t=>t.element.classList.add('card-drop-ready'));
  }
  mount.addEventListener('pointerdown',e=>{
    if(!enabled()||!e.isPrimary||e.button!==0||pointer)return;
    const node=e.target.closest('.hand-card,.sol-card[data-cardgame-action="sol-source"]');
    if(!node)return;
    const data=source(node);if(!data)return;
    pointer={...data,id:e.pointerId,x:e.clientX,y:e.clientY,rect:node.getBoundingClientRect(),mode:null,canSwipe:!!node.closest('.table-hand:not(.blackjack-hand)')};
  });
  document.addEventListener('pointermove',e=>{
    const p=pointer;if(!p||p.id!==e.pointerId)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(!p.mode&&Math.hypot(dx,dy)>9){
      p.mode=p.canSwipe&&Math.abs(dx)>Math.abs(dy)*1.7?'swipe':p.targets.length?'drag':'cancel';
      mount.setPointerCapture(e.pointerId);
      if(p.mode==='drag')beginDrag();
    }
    if(p.mode!=='drag')return;
    e.preventDefault();ghost.style.transform=`translate(${p.rect.x+dx}px,${p.rect.y+dy}px)`;
    const target=p.targets.find(t=>{const r=t.element.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
    if(highlight!==target){highlight?.element.classList.remove('card-drop-over');highlight=target;highlight?.element.classList.add('card-drop-over');}
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    const p=pointer;if(!p||p.id!==e.pointerId)return;
    // Resolve the release position, even if the last move event was coalesced.
    const target=p.mode==='drag'?p.targets.find(t=>{const r=t.element.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}):null;
    if(p.mode)suppressUntil=performance.now()+450;
    cancel();
    if(target)drop(target.action);
    else if(p.mode==='swipe'&&Math.abs(e.clientX-p.x)>50)swipe();
  });
  document.addEventListener('pointercancel',cancel);
  mount.addEventListener('lostpointercapture',e=>{if(e.target===mount&&pointer&&!mount.hasPointerCapture(pointer.id))cancel();});
  // Swallow the synthetic click following a drop, before document delegation.
  document.addEventListener('pointerdown',()=>{suppressUntil=0;},true);
  document.addEventListener('click',e=>{if(e.detail&&performance.now()<suppressUntil){suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('blur',cancel);
  window.addEventListener('resize',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  return {cancel};
}
