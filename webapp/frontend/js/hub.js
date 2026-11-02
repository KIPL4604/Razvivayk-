/* Game hub. Game state and catalog actions remain owned by games.js. */
(() => {
  const main=document.querySelector('#main'), home=main.querySelector('[data-screen="home"]');
  document.querySelector('#homeTitle').textContent='Библиотека';
  document.querySelector('.library-count').innerHTML='<strong>18</strong> игр в коллекции';
  const search=document.createElement('label');search.className='hub-search';search.innerHTML='<span>Найти игру</span><input type="search" id="hubSearch" placeholder="Название игры" autocomplete="off" aria-controls="campaignCards">';
  home.querySelector('.category-filters').before(search);
  const empty=document.createElement('p');empty.id='hubSearchEmpty';empty.hidden=true;empty.setAttribute('role','status');empty.textContent='Игр с таким названием нет. Попробуй другой запрос.';home.querySelector('#campaignCards').after(empty);
  function filterSearch(){
    const q=search.querySelector('input').value.trim().toLocaleLowerCase('ru');
    const cards=[...home.querySelectorAll('.campaign-card')];
    cards.forEach(card=>{card.classList.toggle('search-hidden',!!q&&!card.textContent.toLocaleLowerCase('ru').includes(q));});
    empty.hidden=cards.some(card=>!card.hidden&&!card.classList.contains('search-hidden'));
  }
  search.addEventListener('input',filterSearch);
  new MutationObserver(filterSearch).observe(document.querySelector('#campaignCards'),{childList:true});
  const profileScreen=main.querySelector('[data-screen="profile"]');
  profileScreen.insertAdjacentHTML('beforeend','<footer class="profile-legal"><p>Документы Развивайки</p><a href="#privacy" data-hub-document="privacy">Политика конфиденциальности</a><a href="#terms" data-hub-document="terms">Условия использования</a><a href="#storage" data-hub-document="storage">Хранение данных</a><a href="#licenses" data-hub-document="licenses">Авторы и лицензии</a></footer>');
  const articleLinks='<div class="hub-help-articles"><h2>Об играх и прогрессе</h2><button type="button" data-hub-document="lumen">Люмен: первый свет <span>→</span></button><button type="button" data-hub-document="specimen">Нулевой образец: выход из изолятора <span>→</span></button><button type="button" data-hub-document="progress">Прогресс и сохранения <span>→</span></button></div>';
  main.querySelector('[data-screen="help"]').insertAdjacentHTML('afterbegin',articleLinks);
  main.insertAdjacentHTML('beforeend',`  <section class="screen hub-page" data-screen="settings" aria-labelledby="settingsTitle"><div class="hub-page-heading"><h1 id="settingsTitle">Настройки</h1><p>Один интерфейс для всей коллекции.</p></div><div class="hub-settings"><fieldset><legend>Оформление</legend><p>Светлая или тёмная чёрно-белая тема.</p><div class="theme-options"><button type="button" data-ui-theme="dark">Тёмная</button><button type="button" data-ui-theme="light">Светлая</button></div></fieldset><div class="hub-setting-row"><span><b>Движение фона</b><small>Зацикленные записи геймплея в меню</small></span><button type="button" data-ui-motion></button></div><p class="hub-setting-note">Системная настройка уменьшения движения имеет приоритет. Звук регулируется отдельно внутри каждой игры.</p></div><button class="text-button" data-screen-link="help" type="button">Помощь с играми →</button></section>`);
  const nav=document.querySelector('.bottom-nav');
  nav.innerHTML=[['home','games','Игры'],['cards','cards','Карты'],['profile','user','Профиль'],['settings','settings','Настройки']].map(([id,icon,label])=>'<button type="button" data-screen-link="'+id+'">'+uiIcon(icon)+label+'</button>').join('');
  const categories=home.querySelector('.category-filters'),categoryZone=document.createElement('div');categoryZone.className='category-gesture-zone';categoryZone.dataset.noSwipe='';
  categories.before(categoryZone);categoryZone.append(categories);
  const documents={
    privacy:{title:'Политика конфиденциальности',legal:true,body:`<p>Развивайка сохраняет игровой прогресс и настройки, чтобы можно было продолжить игру. Этот текст описывает текущую работу приложения.</p><h3>Какие данные используются</h3><p>При запуске из Telegram приложение получает данные запуска Mini App. Для авторизации сервер проверяет подпись Telegram. Игровой профиль может содержать идентификатор Telegram, имя, имя пользователя и фотографию, если они доступны при запуске. Приложение хранит результаты, опыт, достижения, сохранённые партии и настройки.</p><h3>Для чего они нужны</h3><p>Для отображения профиля, сохранения и синхронизации прогресса, работы партий и восстановления подключения. В обычном браузере доступно локальное сохранение.</p><h3>Сторонние сервисы</h3><p>Mini App работает внутри Telegram и загружает его Web App SDK. Обработка данных самим Telegram регулируется его документами. Игры и материалы могут содержать собственные уведомления об авторах и лицензиях.</p><h3>Обращения по данным</h3><p>Порядок обращений, сведения об операторе, применимая юрисдикция и сроки хранения будут добавлены перед окончательной публикацией документа. Публичный контакт пока не указан.</p>`},
    terms:{title:'Условия использования',legal:true,body:`<p>Развивайка — коллекция браузерных игр. Доступные режимы, правила и управление указаны внутри игр и в справке.</p><h3>Прогресс и игровые ресурсы</h3><p>Опыт, монеты, фишки и другие игровые показатели используются внутри соответствующего режима. Покер работает с виртуальными фишками. Прогресс может храниться на устройстве или синхронизироваться при запуске через Telegram.</p><h3>Доступность</h3><p>Для сетевых режимов и облачного сохранения требуется подключение. Очистка хранилища браузера может удалить локальные партии. Изменения приложения могут влиять на доступность режимов; наличие сохранения не заменяет резервное копирование.</p><h3>Материалы</h3><p>Название, графика, программный код и сторонние компоненты имеют своих правообладателей. Сведения о сторонних материалах доступны в уведомлениях о лицензиях.</p><h3>Статус документа</h3><p>Владелец, контакт, юрисдикция и окончательные условия будут указаны позже. Этот черновик не является завершённой публичной офертой.</p>`},
    storage:{title:'Хранение данных',legal:true,body:`<h3>На устройстве</h3><p>Приложение использует localStorage и, в поддерживаемых клиентах Telegram, DeviceStorage для прогресса. Выбранная тема и движение фона также сохраняются на устройстве. Это функциональное хранилище, а не файл с игровой установкой.</p><h3>На сервере</h3><p>При авторизации через Telegram профиль и поддерживаемые сохранения могут синхронизироваться с сервером. Отдельные игры сохраняют партии локально. При отсутствии сети приложение показывает состояние синхронизации и предлагает повторную отправку.</p><h3>Очистка</h3><p>Локальные данные можно удалить средствами браузера или клиента. Это не означает удаления данных на сервере. Контакт и порядок запроса серверного удаления будут добавлены владельцем.</p><h3>Сроки</h3><p>Единые сроки хранения и резервного копирования пока не опубликованы. Они будут указаны в окончательной версии документа.</p>`},
    licenses:{title:'Авторы и лицензии',legal:true,body:'<p>Развивайка · Teramont. В коллекции используются собственные игровые материалы и сторонние компоненты с отдельными условиями.</p><p><a href="/static/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">Открыть уведомления о сторонних материалах ↗</a></p><p>Сведения о владельце проекта будут добавлены позже. Права на сторонние материалы сохраняются за их авторами.</p>'},
    lumen:{title:'Первый свет',body:'<p>Люмен атакует сам. Твоя задача — двигаться, собирать кристаллы и не дать врагам замкнуть кольцо. На телефоне используй джойстик, на компьютере — WASD или стрелки.</p><h3>Перед экспедицией</h3><p>В меню «Играть» выбери доступную карту и бойца. Биосад открывает Лунный карьер, а затем становится доступен замок. Пройденные миры можно повторять.</p><h3>Новые бойцы</h3><p>В магазине у каждого бойца указано родное оружие. Найди его в случайном выборе и доведи до VIII стадии за один забег. После испытания можно потратить нужное количество монет на открытие бойца.</p><h3>Пауза и возвращение</h3><p>Escape или P открывает паузу. Можно вернуться в меню и продолжить сохранённую экспедицию. Постоянная прокачка маяка применяется к следующему новому забегу.</p>'},
    specimen:{title:'Выход из изолятора',body:'<p>Левый джойстик двигает организм, правый направляет захват. На компьютере используй WASD и удерживай левую кнопку мыши для захвата.</p><h3>Путь наружу</h3><p>Тяни рычаги и взаимодействуй с терминалами. Кнопка E действует рядом с доступным объектом. Большая форма пробивает перегородки рывком — пробел или кнопка со стрелками.</p><h3>Сохранение</h3><p>Зелёное живое ядро в стене сохраняет побег при сближении. После гибели можно восстановить образец из контрольной точки.</p><h3>Управление массой</h3><p>Оставляй массу в резервуаре и возвращайся за ней, когда потребуется большая форма. После открытия эхолокации клавиша R помогает обнаружить пищу.</p>'},
    progress:{title:'Твой игровой прогресс',body:'<p>В десяти кампаниях по 100 уровней. Следующий этап открывается после победы. За прохождение начисляется опыт; повторный уровень приносит меньше XP.</p><h3>Профиль</h3><p>Здесь собраны звание, серия дней, статистика кампаний и достижения. Каждые 100 XP повышают уровень профиля. Самостоятельные аркады и карточные партии используют свои сохранения.</p><h3>Без сети</h3><p>Локальный прогресс остаётся на устройстве. При проблемах с синхронизацией проверь сообщение о подключении и повтори отправку. Для облачного профиля запускай хаб через Telegram.</p>'}
  };
  const dialog=document.createElement('dialog');dialog.className='hub-document';dialog.setAttribute('aria-labelledby','hubDocumentTitle');document.querySelector('#app').append(dialog);
  let opener=null;
  document.addEventListener('click',e=>{
    const link=e.target.closest('[data-hub-document]');if(!link)return;e.preventDefault();
    const doc=documents[link.dataset.hubDocument];if(!doc)return;opener=link;
    dialog.innerHTML='<header><h2 id="hubDocumentTitle">'+doc.title+'</h2><button type="button" data-document-close aria-label="Закрыть документ">×</button></header><div class="document-body">'+(doc.legal?'<p class="document-draft">Черновик · реквизиты владельца будут добавлены позже.</p>':'')+doc.body+'</div>';
    dialog.showModal();dialog.querySelector('button').focus();MenuUI.animate(dialog);
  });
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-document-close]')||e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
  function preferences(){
    document.querySelectorAll('[data-ui-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.uiTheme===document.documentElement.dataset.theme)));
    const b=document.querySelector('[data-screen="settings"] [data-ui-motion]');b.textContent=MenuUI.get('motion')===false?'Выключено':'Включено';b.setAttribute('aria-pressed',String(MenuUI.get('motion')!==false));
  }
  document.addEventListener('menu-preferences',preferences);preferences();
  const pages=['home','cards','profile','settings'];
  CardGames.prepareLibrary();
  const observer=new MutationObserver(()=>{
    const active=main.querySelector('.screen.active'),name=active?.dataset.screen;
    nav.querySelectorAll('button').forEach(b=>{const selected=b.dataset.screenLink===name;b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.querySelectorAll('[data-menu-reel]').forEach(MenuUI.syncMedia);
  });
  main.querySelectorAll('.screen').forEach(s=>observer.observe(s,{attributes:true,attributeFilter:['class']}));
  for(const name of pages)MenuUI.pager(main.querySelector('[data-screen="'+name+'"]'),direction=>{
    if(dialog.open)return false;const i=pages.indexOf(activeScreen),next=pages[i+direction];if(!next)return false;showScreen(next);return true;
  },{target:()=>main.querySelector('.screen.active'),preview:direction=>main.querySelector('[data-screen="'+pages[pages.indexOf(activeScreen)+direction]+'"]')});
  nav.querySelector('[data-screen-link="home"]').setAttribute('aria-current','page');
  const levelMap=document.querySelector('#levelMap'),chapterNav=document.createElement('nav');
  chapterNav.className='hub-chapter-pager';chapterNav.setAttribute('aria-label','Перелистывание глав');
  chapterNav.innerHTML='<button type="button" data-chapter-page="-1" aria-label="Предыдущая глава">←</button><span></span><button type="button" data-chapter-page="1" aria-label="Следующая глава">→</button>';
  chapterNav.querySelector('[data-chapter-page="-1"]').innerHTML=MenuUI.arrow(-1);chapterNav.querySelector('[data-chapter-page="1"]').innerHTML=MenuUI.arrow(1);
  levelMap.before(chapterNav);
  function chapterStatus(){const chapters=[...levelMap.children],i=Math.max(0,chapters.findIndex(c=>c.open));chapterNav.querySelector(':scope > span').textContent='Глава '+(i+1)+' / '+chapters.length;chapterNav.querySelector('[data-chapter-page="-1"]').disabled=i===0;chapterNav.querySelector('[data-chapter-page="1"]').disabled=i===chapters.length-1;}
  function chapterPage(direction){const chapters=[...levelMap.children],i=Math.max(0,chapters.findIndex(c=>c.open)),next=chapters[i+direction];if(!next)return false;chapters.forEach(c=>c.open=c===next);MenuUI.animate(next,direction);next.scrollIntoView({block:'nearest'});chapterStatus();return true;}
  chapterNav.addEventListener('click',e=>{const b=e.target.closest('[data-chapter-page]');if(b)chapterPage(Number(b.dataset.chapterPage));});
  levelMap.addEventListener('toggle',chapterStatus,true);new MutationObserver(chapterStatus).observe(levelMap,{childList:true});
  MenuUI.pager(levelMap,chapterPage);chapterStatus();
})();
