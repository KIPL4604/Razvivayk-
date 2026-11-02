/* Pointer-owned page movement. Never bind this to live gameplay controls. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let inCommit=false,activeCleanup=null,activeGestureCancel=null,suppressUntil=0;
  document.addEventListener('pointerdown',()=>{suppressUntil=0;},true);
  document.addEventListener('click',e=>{
    if(performance.now()<suppressUntil&&(e.detail||e.pointerType)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  function moving(){return !reduced.matches;}
  function reveal(element,direction=1){
    if(!element||inCommit)return;
    element.getAnimations().forEach(a=>a.cancel());
    element.animate(moving()?[{opacity:.8,transform:'translateX('+direction*24+'px)'},{opacity:1,transform:'translateX(0)'}]:[{opacity:.7},{opacity:1}],{duration:moving()?280:120,easing:'cubic-bezier(.25,.8,.25,1)'});
  }
  function reset(element){element.style.removeProperty('transform');element.style.removeProperty('will-change');}
  function settle(element,dx){
    reset(element);if(!dx||!moving())return;
    element.animate([{transform:'translateX('+dx+'px)'},{transform:'translateX(0)'}],{duration:240,easing:'cubic-bezier(.25,.8,.25,1)'});
  }
  function transition(source,commit,target,direction=1,dx=0){
    if(inCommit)return commit();
    activeCleanup?.();
    if(!source||!source.getClientRects().length||!moving()){
      if(source)reset(source);inCommit=true;let changed;
      try{changed=commit();}finally{inCommit=false;}
      if(changed!==false)reveal(target?.(),direction);
      return changed;
    }
    const main=source.closest('#main'),clip=main?.getBoundingClientRect()||{left:0,top:0,width:innerWidth,height:innerHeight};
    const rect=source.getBoundingClientRect(),width=Math.max(1,clip.width);
    const clone=source.cloneNode(true),layer=document.createElement('div');
    layer.className='menu-motion-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;
    Object.assign(layer.style,{position:'fixed',left:clip.left+'px',top:clip.top+'px',width:clip.width+'px',height:clip.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:'19'});
    let parent=layer;
    const ancestors=[];for(let node=source.parentElement;node&&node!==main&&node!==document.body;node=node.parentElement)ancestors.unshift(node);
    for(const node of ancestors){const shell=node.cloneNode(false);shell.removeAttribute('id');shell.inert=true;Object.assign(shell.style,{display:'contents',animation:'none',transform:'none'});parent.append(shell);parent=shell;}
    clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    const style=getComputedStyle(source);
    Object.assign(clone.style,{position:'absolute',left:(rect.left-clip.left-dx)+'px',top:(rect.top-clip.top)+'px',width:rect.width+'px',height:rect.height+'px',maxWidth:'none',maxHeight:'none',margin:'0',display:style.display,transform:'none',animation:'none',backgroundColor:style.backgroundColor==='rgba(0, 0, 0, 0)'?'var(--bg)':style.backgroundColor});
    parent.append(clone);document.body.append(layer);
    const originalNodes=[source,...source.querySelectorAll('*')],clonedNodes=[clone,...clone.querySelectorAll('*')];
    originalNodes.forEach((node,i)=>{if(clonedNodes[i]){clonedNodes[i].scrollTop=node.scrollTop;clonedNodes[i].scrollLeft=node.scrollLeft;}});
    reset(source);inCommit=true;let changed;
    try{changed=commit();}catch(error){layer.remove();throw error;}finally{inCommit=false;}
    if(changed===false){layer.remove();settle(source,dx);return false;}
    const destination=target?.();
    const duration=dx?Math.max(200,360*(1-Math.min(.7,Math.abs(dx)/width))):360;
    const options={duration,easing:'cubic-bezier(.25,.8,.25,1)'};
    const out=clone.animate([{transform:'translateX('+dx+'px)'},{transform:'translateX('+(-direction*width)+'px)'}],options);
    const incoming=destination?.animate([{transform:'translateX('+(direction*width+dx)+'px)'},{transform:'translateX(0)'}],options);
    const cleanup=()=>{out.cancel();incoming?.cancel();layer.remove();if(activeCleanup===cleanup)activeCleanup=null;};
    activeCleanup=cleanup;
    Promise.all([out.finished,incoming?.finished]).then(cleanup,cleanup);
    return true;
  }
  function screenTransition(){return false;}
  function pager(element,change,options={}){
    if(!element)return;
    let start=null,preview=null;
    const clearPreview=()=>{preview?.remove();preview=null;};
    const restore=()=>{if(start){settle(element,(start.dx||0)*.85);start=null;}clearPreview();if(activeGestureCancel===restore)activeGestureCancel=null;};
    function showPreview(direction,dx){
      if(!options.preview||!moving())return;
      if(!preview){
        const next=options.preview(direction);if(!next)return;
        const main=element.closest('#main'),box=main.getBoundingClientRect(),rect=element.getBoundingClientRect();
        preview=document.createElement('div');preview.className='menu-motion-layer';preview.inert=true;preview.setAttribute('aria-hidden','true');
        Object.assign(preview.style,{position:'fixed',left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:'19'});
        const clone=next.cloneNode(true);clone.classList.add('active');clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
        Object.assign(clone.style,{position:'absolute',display:'block',left:rect.left-box.left+'px',top:rect.top-box.top+'px',width:rect.width+'px',margin:'0',background:'var(--bg)',minHeight:box.height+'px',animation:'none'});
        preview.append(clone);document.body.append(preview);
      }
      preview.firstElementChild.style.transform='translateX('+(direction*element.closest('#main').clientWidth+dx*.85)+'px)';
    }
    const excluded=target=>{
      if(target.closest('input,select,textarea,a,[data-no-swipe],canvas,.sp-controls,.card-table,.category-gesture-zone,.category-filters,.lumen-book-tabs,.table-hand'))return true;
      for(let node=target;node&&node!==element;node=node.parentElement){const s=getComputedStyle(node);if(node.scrollWidth>node.clientWidth+2&&/auto|scroll/.test(s.overflowX))return true;}
      return false;
    };
    element.style.touchAction='pan-y';
    element.addEventListener('pointerdown',e=>{
      if(!e.isPrimary){restore();return;}
      if(e.pointerType==='mouse'||excluded(e.target))return;
      activeCleanup?.();activeGestureCancel?.();activeGestureCancel=restore;start={x:e.clientX,y:e.clientY,id:e.pointerId,dx:0,axis:null};
    });
    element.addEventListener('pointermove',e=>{
      if(!start||e.pointerId!==start.id)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;
      if(!start.axis&&Math.max(Math.abs(dx),Math.abs(dy))>12){
        start.axis=Math.abs(dx)>Math.abs(dy)*1.5?'x':'y';
        if(start.axis==='x'){element.setPointerCapture(e.pointerId);suppressUntil=performance.now()+900;element.getAnimations().forEach(a=>a.cancel());element.style.willChange='transform';start.direction=dx<0?1:-1;}
      }
      if(start.axis!=='x')return;
      e.preventDefault();start.dx=dx;suppressUntil=performance.now()+900;
      if(Math.abs(dx)>12&&start.direction!==(dx<0?1:-1)){clearPreview();start.direction=dx<0?1:-1;}
      showPreview(start.direction,dx);
      if(moving())element.style.transform='translateX('+dx*.85+'px)';
    },{passive:false});
    element.addEventListener('pointerup',e=>{
      if(!start||e.pointerId!==start.id)return;
      const gesture=start;start=null;
      if(activeGestureCancel===restore)activeGestureCancel=null;
      clearPreview();
      if(gesture.axis!=='x')return;
      suppressUntil=performance.now()+900;
      const dx=e.clientX-gesture.x,threshold=Math.min(240,Math.max(112,element.clientWidth*.34));
      if(Math.abs(dx)<threshold){settle(element,gesture.dx*.85);return;}
      transition(element,()=>change(dx<0?1:-1),options.target||(()=>element.isConnected?element:null),dx<0?1:-1,gesture.dx*.85);
    });
    element.addEventListener('pointercancel',restore);
    element.addEventListener('lostpointercapture',e=>{if(e.target===element)restore();});
  }
  window.PageMotion={pager,reveal,transition,screenTransition,cancel:()=>{activeGestureCancel?.();activeCleanup?.();document.querySelectorAll(".menu-motion-layer").forEach(e=>e.remove());},get committing(){return inCommit;}};
  const cancelMovement=()=>{activeGestureCancel?.();activeCleanup?.();};
  window.addEventListener('resize',cancelMovement);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelMovement();});
  reduced.addEventListener('change',()=>{if(reduced.matches)cancelMovement();});
})();
