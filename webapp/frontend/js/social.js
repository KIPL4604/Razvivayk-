/* Friends and text chat. Identity comes only from Telegram's signed initData. */
(() => {
  const main=document.querySelector('#main'),section=document.createElement('section');
  section.className='screen hub-page social-page';section.dataset.screen='friends';section.setAttribute('aria-labelledby','friendsTitle');
  section.innerHTML=`<div class="social-heading"><div><h1 id="friendsTitle" tabindex="-1">Друзья</h1><p>Играть интереснее вместе.</p></div><button type="button" class="primary-button" data-social="add">Добавить друга</button></div><div id="socialStatus" role="status"></div><div class="social-layout"><div id="socialDirectory"><div class="social-section-heading"><h2>Твои друзья <span id="socialCount"></span></h2><button type="button" class="text-button" data-social="requests">Заявки <span id="socialRequests"></span></button></div><p class="social-presence-note">В сети — сейчас в Развивайке.</p><div id="socialFriends" class="social-list"></div><label class="social-search"><span>Найти друга</span><input id="socialSearch" type="search" placeholder="Имя или @ник" autocomplete="off"></label><div class="social-section-heading"><h2>Чаты</h2><span id="socialUnread"></span></div><div id="socialChats" class="social-list"></div></div><div id="socialConversation" class="social-conversation"><div class="social-chat-idle">${uiIcon('friends')}<h2>На связи</h2><p>Выбери друга, чтобы начать переписку.</p></div></div></div>`;
  main.append(section);
  const dialog=document.createElement('dialog');dialog.className='social-dialog';dialog.setAttribute('aria-labelledby','socialDialogTitle');document.body.append(dialog);
  let data=null,selected=null,history=[],hasMore=false,poll=null,socket=null,refreshing=null,loadTicket=0,nonce=null,sending=false;
  const drafts=new Map(),session=crypto.randomUUID(),auth=Boolean(tg?.initData&&hasTelegramIdentity);
  const $=s=>section.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function stableHTML(element,html){if(element._socialMarkup===html)return;element._socialMarkup=html;element.innerHTML=html;}
  function status(text,error=false){$('#socialStatus').textContent=text;$('#socialStatus').classList.toggle('is-error',error);}
  async function request(path='',options={}){
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);
    try{
      const response=await fetch('/api/social'+path,{method:options.method||'GET',headers:{'X-Init-Data':tg.initData,'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,signal:abort.signal,cache:'no-store',keepalive:options.keepalive||false});
      if(!response.ok){let text='Не удалось связаться с сервером';try{const d=await response.json();text=typeof d.detail==='string'?d.detail:text;}catch(_){}if(response.status===401)text='Сессия истекла. Открой Развивайку заново через бота.';throw new Error(text);}
      return options.blob?response.blob():response.json();
    }catch(error){if(error.name==='AbortError')throw new Error('Сервер не ответил. Проверь соединение и повтори.');throw error;}finally{clearTimeout(timeout);}
  }
  function avatar(p){return `<span class="social-avatar">${p.photo?`<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:esc([...p.name][0]||'И')}</span>`;}
  function personText(p){return `<span class="social-person"><b>${esc(p.name)}</b><small>${p.username?'@'+esc(p.username)+' · ':''}<span class="social-presence ${p.online?'online':''}">${p.online?'В сети':'Не в сети'}</span></small></span>`;}
  function filtered(items){const q=$('#socialSearch').value.trim().toLocaleLowerCase('ru').replace(/^@/,'');return items.filter(p=>(p.name+' '+p.username).toLocaleLowerCase('ru').includes(q));}
  function renderDirectory(){
    if(!data)return;
    $('#socialCount').textContent=data.friends.length||'';$('#socialRequests').textContent=data.incoming.length||'';
    stableHTML($('#socialFriends'),filtered(data.friends).map(p=>`<button class="social-person-row" type="button" data-social-chat="${p.code}" ${selected===p.code?'aria-current="true"':''}>${avatar(p)}${personText(p)}<span aria-hidden="true">↗</span></button>`).join('')||`<p class="social-empty">${data.friends.length?'Никого не нашли. Попробуй другое имя.':'Здесь появятся твои друзья. Обменяйтесь кодами и отправьте первую заявку.'}</p>`);
    stableHTML($('#socialChats'),filtered(data.chats).map(p=>`<button class="social-person-row social-chat-row" type="button" data-social-chat="${p.code}">${avatar(p)}<span class="social-person"><b>${esc(p.name)}</b><small>${p.last.mine?'Ты: ':''}${esc(p.last.text)}</small></span><span class="social-chat-meta"><time>${time(p.last.createdAt)}</time>${p.unread?`<b class="social-badge">${p.unread}</b>`:''}</span></button>`).join('')||'<p class="social-empty">Переписка начнётся с первого сообщения другу.</p>');
    const count=data.chats.reduce((sum,c)=>sum+c.unread,0);$('#socialUnread').textContent=count?count+' новых':'';
    const nav=document.querySelector('[data-screen-link="friends"]');if(nav)nav.setAttribute('aria-label','Друзья'+(count?', новых сообщений: '+count:''));
    if(selected&&!data.friends.some(p=>p.code===selected)){closeChat();status('Дружба завершена. Чтобы продолжить переписку, нужна новая заявка.');}
    if(selected){const p=data.friends.find(p=>p.code===selected);const heading=$('#socialChatPerson');if(heading)heading.innerHTML=personText(p);}
  }
  function time(ms){return new Date(ms).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});}
  async function refresh(force=false){
    if(!auth||document.hidden)return;
    if(refreshing){await refreshing;if(force)return refresh();return;}
    refreshing=(async()=>{
      try{data=await request('/state');renderDirectory();if(activeScreen==='friends')status('');if(selected&&activeScreen==='friends')await loadMessages();}
      catch(error){if(activeScreen==='friends')status(error.message,true);}
    })();
    try{await refreshing;}finally{refreshing=null;}
  }
  function rememberDraft(){const field=$('#socialCompose');if(field&&selected)drafts.set(selected,field.value);}
  function closeChat(){rememberDraft();selected=null;history=[];loadTicket++;section.classList.remove('chat-open');$('#socialConversation').innerHTML='<div class="social-chat-idle">'+uiIcon('friends')+'<h2>На связи</h2><p>Выбери друга, чтобы начать переписку.</p></div>';}
  async function openChat(code){
    rememberDraft();selected=code;history=[];nonce=null;hasMore=false;
    const p=data?.friends.find(p=>p.code===code);if(!p)return closeChat();
    section.classList.add('chat-open');$('#socialConversation').innerHTML=`<header class="social-chat-header"><button type="button" class="text-button" data-social="back" aria-label="К списку друзей">←</button><div id="socialChatPerson">${personText(p)}</div><button type="button" class="text-button" data-social="remove" aria-label="Удалить друга">Удалить</button></header><div class="social-message-scroll"><button type="button" class="text-button social-older" data-social="older" hidden>Ранее</button><ol id="socialMessages" role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false" aria-label="Переписка"></ol><p id="socialChatStatus" role="status">Загружаем сообщения…</p></div><form id="socialSend"><label class="sr-only" for="socialCompose">Сообщение</label><textarea id="socialCompose" rows="1" maxlength="2000" placeholder="Написать сообщение…" enterkeyhint="send"></textarea><button class="primary-button" type="submit" aria-label="Отправить сообщение">↑</button></form>`;
    $('#socialCompose').value=drafts.get(code)||'';renderDirectory();fitConversation();await loadMessages();$('#socialCompose')?.focus({preventScroll:true});
  }
  function paintMessages(scroll=true){
    const list=$('#socialMessages');if(!list)return;
    const scrollbox=list.parentElement,atEnd=scrollbox.scrollHeight-scrollbox.scrollTop-scrollbox.clientHeight<80,oldHeight=scrollbox.scrollHeight;
    const existing=new Map([...list.children].map(li=>[li.dataset.messageId,li]));let anchor=null;
    for(let i=history.length-1;i>=0;i--){const m=history[i];let li=existing.get(m.id);
      if(!li){li=document.createElement('li');li.dataset.messageId=m.id;li.className=m.mine?'mine':'';
        const text=document.createElement('p'),stamp=document.createElement('time');text.textContent=m.text;stamp.dateTime=new Date(m.createdAt).toISOString();stamp.textContent=time(m.createdAt);li.append(text,stamp);list.insertBefore(li,anchor);
      }anchor=li;
    }
    $('[data-social="older"]').hidden=!hasMore;$('#socialChatStatus').textContent=history.length?'':'Напиши первым.';
    if(scroll&&atEnd||history.length<=1)scrollbox.scrollTop=scrollbox.scrollHeight;
    if(!scroll)scrollbox.scrollTop+=scrollbox.scrollHeight-oldHeight;
  }
  async function loadMessages(older=false){
    if(!selected)return;const code=selected,ticket=++loadTicket;
    try{
      const cursor=older?history[0]?.id:history.at(-1)?.id;
      let page=await request('/friends/'+code+'/messages'+(cursor?'?'+(older?'before':'after')+'='+encodeURIComponent(cursor):''));
      if(ticket!==loadTicket||selected!==code)return;
      // Catch up in bounded pages; the next poll resumes from the last received cursor.
      const seen=new Set(history.map(m=>m.id));history=older?[...page.messages.filter(m=>!seen.has(m.id)),...history]:[...history,...page.messages.filter(m=>!seen.has(m.id))];
      if(older||!cursor)hasMore=page.hasMore;paintMessages(!older);
      const last=history.at(-1);if(last&&!document.hidden&&activeScreen==='friends'){
        const chat=data?.chats.find(c=>c.code===code);if(chat?.unread){await request('/friends/'+code+'/read',{method:'POST',body:{id:last.id}});chat.unread=0;renderDirectory();}
      }
    }catch(error){if(selected===code&&$('#socialChatStatus'))$('#socialChatStatus').textContent=error.message;}
  }
  async function send(event){
    event.preventDefault();if(sending||!selected)return;
    const code=selected,field=$('#socialCompose'),text=field.value.trim();if(!text)return;
    nonce ||= crypto.randomUUID();const id=nonce;sending=true;$('#socialSend button').disabled=true;$('#socialChatStatus').textContent='Отправляем…';
    try{
      const m=await request('/friends/'+code+'/messages',{method:'POST',body:{text,clientId:id}});drafts.delete(code);
      if(selected===code){if(!history.some(x=>x.id===m.id))history.push(m);if(field.value.trim()===text)field.value='';nonce=null;paintMessages();const scroll=$('.social-message-scroll');scroll.scrollTop=scroll.scrollHeight;}
      void refresh();
    }catch(error){if(selected===code)$('#socialChatStatus').textContent=error.message;}
    finally{sending=false;if($('#socialSend button'))$('#socialSend button').disabled=false;}
  }
  function dialogShell(title,body){dialog.innerHTML=`<header><h2 id="socialDialogTitle">${title}</h2><button type="button" class="text-button" data-social="close" aria-label="Закрыть">×</button></header>${body}<p class="social-dialog-status" role="status"></p>`;if(!dialog.open)dialog.showModal();}
  let qrURL;
  async function addDialog(){
    if(!data){await refresh(true);if(!data)return;}
    dialogShell('Добавить друга',`<p>Введи код друга или отсканируй его QR. Он увидит заявку и сможет её принять.</p><form id="socialAdd"><label for="socialCode">Код друга</label><div class="social-code-input"><input id="socialCode" required maxlength="32" placeholder="RZ-012345ABCDEF" autocomplete="off" autocapitalize="characters"><button class="primary-button" type="submit">Отправить</button></div></form><button class="text-button" type="button" data-social="scan" ${tg?.isVersionAtLeast?.('6.4')?'':'disabled'}>Сканировать QR</button>${tg?.isVersionAtLeast?.('6.4')?'':'<small>Сканер доступен в мобильном Telegram. Здесь можно ввести код.</small>'}<div class="social-own-code"><h3>Твой код</h3><button type="button" class="text-button" data-social="copy">${esc(data.me.code)} · копировать</button><div id="socialQR" aria-label="Твой QR-код">Готовим QR…</div></div>`);
    try{const blob=await request('/me/qr',{blob:true});if(qrURL)URL.revokeObjectURL(qrURL);qrURL=URL.createObjectURL(blob);const mount=dialog.querySelector('#socialQR');if(mount)mount.innerHTML=`<img src="${qrURL}" alt="QR-код ${data.me.code}" width="184" height="184">`;}
    catch(error){const mount=dialog.querySelector('#socialQR');if(mount)mount.textContent=error.message;}
  }
  function requestsDialog(){
    if(!data)return;
    const rows=(items,incoming)=>items.map(p=>`<div class="social-request-row">${avatar(p)}<span class="social-person"><b>${esc(p.name)}</b><small>${p.username?'@'+esc(p.username):p.code}</small></span><div>${incoming?`<button class="primary-button" type="button" data-social-respond="${p.code}" data-accept="true">Принять</button><button class="text-button" type="button" data-social-respond="${p.code}" data-accept="false">Отклонить</button>`:`<button class="text-button" type="button" data-social-cancel="${p.code}">Отменить</button>`}</div></div>`).join('');
    dialogShell('Заявки в друзья',`<h3>Входящие</h3>${rows(data.incoming,true)||'<p class="social-empty">Новых заявок нет.</p>'}<h3>Отправленные</h3>${rows(data.outgoing,false)||'<p class="social-empty">Отправленных заявок нет.</p>'}`);
  }
  async function addCode(code){const result=await request('/requests',{method:'POST',body:{code:code.trim().toUpperCase()}});await refresh(true);const s=dialog.querySelector('.social-dialog-status');if(s)s.textContent=result.status==='accepted'?'Вы теперь друзья.':'Заявка отправлена.';}
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||(!section.contains(button)&&!dialog.contains(button)))return;
    try{
      if(button.dataset.socialChat)return void openChat(button.dataset.socialChat);
      if(button.dataset.socialRespond){button.disabled=true;await request('/requests/'+button.dataset.socialRespond+'/respond',{method:'POST',body:{accept:button.dataset.accept==='true'}});await refresh(true);requestsDialog();return;}
      if(button.dataset.socialCancel){const removing=data.friends.some(p=>p.code===button.dataset.socialCancel);button.disabled=true;await request('/friends/'+button.dataset.socialCancel,{method:'DELETE'});await refresh(true);if(removing)dialog.close();else requestsDialog();return;}
      const action=button.dataset.social;
      if(action==='add')await addDialog();
      if(action==='requests')requestsDialog();
      if(action==='close')dialog.close();
      if(action==='back')closeChat();
      if(action==='older')await loadMessages(true);
      if(action==='copy'){await navigator.clipboard.writeText(data.me.code);dialog.querySelector('.social-dialog-status').textContent='Код скопирован.';}
      if(action==='scan'){
        tg.showScanQrPopup({text:'Отсканируй код друга Развивайки'},text=>{
          if(!/^RZ-[A-F0-9]{12}$/i.test(text.trim())){dialog.querySelector('.social-dialog-status').textContent='Это не код друга Развивайки.';return false;}
          dialog.querySelector('#socialCode').value=text.trim().toUpperCase();dialog.querySelector('.social-dialog-status').textContent='Код прочитан. Нажми «Отправить», чтобы отправить заявку.';return true;
        });
      }
      if(action==='remove'){dialogShell('Удалить друга?',`<p>Переписка станет недоступна до новой принятой заявки.</p><button type="button" class="primary-button" data-social-cancel="${selected}">Удалить из друзей</button>`);}
    }catch(error){if(dialog.open){dialog.querySelector('.social-dialog-status').textContent=error.message;button.disabled=false;}else status(error.message,true);}
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id==='socialSend')return void send(event);
    if(event.target.id!=='socialAdd')return;event.preventDefault();const b=event.target.querySelector('button');b.disabled=true;
    try{await addCode(dialog.querySelector('#socialCode').value);}catch(error){dialog.querySelector('.social-dialog-status').textContent=error.message;}finally{b.disabled=false;}
  });
  section.addEventListener('input',e=>{if(e.target.id==='socialSearch')renderDirectory();if(e.target.id==='socialCompose'){nonce=null;rememberDraft();}});
  section.addEventListener('keydown',e=>{if(e.target.id==='socialCompose'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#socialSend').requestSubmit();}});
  async function presence(active=!document.hidden){if(!auth)return;try{await request('/presence',{method:'POST',body:{session,active},keepalive:!active});}catch(_){} }
  function onScreen(name){
    clearInterval(poll);socket?.close();socket=null;
    if(name!=='friends'){rememberDraft();if(dialog.open)dialog.close();return;}
    if(!auth){status('Друзья и переписка доступны при запуске через Telegram.');$('#socialDirectory').hidden=true;$('#socialConversation').hidden=true;section.querySelector('[data-social="add"]').disabled=true;return;}
    status(data?'':'Загружаем друзей…');void refresh();poll=setInterval(refresh,5000);
    socket=Platform.socket({onEvent:e=>{if(['social.changed','resync'].includes(e.type))void refresh();}});
  }
  document.addEventListener('visibilitychange',()=>{void presence();if(!document.hidden&&activeScreen==='friends')void refresh();});
  function fitConversation(){
    const box=$('#socialConversation');if(!box)return;
    if(!selected||innerWidth>800){box.style.removeProperty('height');return;}
    const nav=document.querySelector('.bottom-nav').getBoundingClientRect(),viewport=window.visualViewport;
    const bottom=Math.min(nav.top,viewport?viewport.height+viewport.offsetTop:innerHeight);
    box.style.height=Math.max(240,bottom-box.getBoundingClientRect().top-16)+'px';
  }
  window.addEventListener('resize',fitConversation);window.visualViewport?.addEventListener('resize',fitConversation);
  section.addEventListener('error',e=>{if(e.target.matches('.social-avatar img'))e.target.replaceWith(document.createTextNode(e.target.closest('.social-person-row')?.querySelector('b')?.textContent?.[0]||'И'));},true);
  window.addEventListener('pagehide',()=>{void presence(false);});
  tg?.onEvent?.('activated',()=>void presence(true));tg?.onEvent?.('deactivated',()=>void presence(false));
  if(auth){void presence();setInterval(()=>presence(!document.hidden&&tg?.isActive!==false),20000);}
  window.Social={onScreen,back(){if(dialog.open){dialog.close();return true;}if(selected){closeChat();return true;}return false;}};
})();
