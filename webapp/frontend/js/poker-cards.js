/* Original Teramont deck: vector artwork, conventional French suits and two-way courts.
   No external assets or runtime dependencies. Hidden cards never contain their face. */
(function () {
  'use strict';

  const PAPER = '#FFFDF5';
  const NAVY = '#253A4B';
  const GOLD = '#BA9557';
  const RED = '#AC3C48';
  const SUITS = {
    s: { name: 'пик', color: NAVY, path: 'M0-13C-3-8-12-4-12 3a7 7 0 0 0 11 5c0 4-2 6-4 8H5C3 14 1 12 1 8a7 7 0 0 0 11-5C12-4 3-8 0-13Z' },
    h: { name: 'червей', color: RED, path: 'M0 13C-4 9-13 2-13-5c0-9 10-11 13-4 3-7 13-5 13 4C13 2 4 9 0 13Z' },
    d: { name: 'бубен', color: RED, path: 'M0-15 11 0 0 15-11 0Z' },
    c: { name: 'треф', color: NAVY, path: 'M-4 0a7 7 0 1 1 8 0 7 7 0 1 1-3 10c0 3 2 5 4 7H-5c2-2 4-4 4-7A7 7 0 1 1-4 0Z' }
  };
  const NAMES = { A: 'Туз', K: 'Король', Q: 'Дама', J: 'Валет', T: 'Десятка', '9': 'Девятка', '8': 'Восьмёрка', '7': 'Семёрка', '6': 'Шестёрка', '5': 'Пятёрка', '4': 'Четвёрка', '3': 'Тройка', '2': 'Двойка' };
  // Coordinates describe central suit marks only; the two corner indices are separate.
  const PIPS = {
    '2': [[100,76],[100,204]],
    '3': [[100,76],[100,140],[100,204]],
    '4': [[65,76],[135,76],[65,204],[135,204]],
    '5': [[65,76],[135,76],[100,140],[65,204],[135,204]],
    '6': [[65,76],[135,76],[65,140],[135,140],[65,204],[135,204]],
    '7': [[65,76],[135,76],[100,108],[65,140],[135,140],[65,204],[135,204]],
    '8': [[65,76],[135,76],[100,108],[65,140],[135,140],[100,172],[65,204],[135,204]],
    '9': [[65,69],[135,69],[65,116],[135,116],[100,140],[65,164],[135,164],[65,211],[135,211]],
    T: [[65,69],[135,69],[100,92],[65,116],[135,116],[65,164],[135,164],[100,188],[65,211],[135,211]]
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function suit(s, x, y, size, upsideDown) {
    return '<path d="' + SUITS[s].path + '" fill="' + SUITS[s].color + '" transform="translate(' + x + ' ' + y + ') scale(' + size + ')'+ (upsideDown ? ' rotate(180)' : '') + '"/>';
  }

  function svg(inner, extra) {
    return '<svg viewBox="0 0 200 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"' + (extra || '') + '>' + inner + '</svg>';
  }

  function paper() {
    return '<rect x="1" y="1" width="198" height="278" rx="12" fill="'+PAPER+'" stroke="#D9D5C6" stroke-width="2"/><rect x="6" y="6" width="188" height="268" rx="8" stroke="'+GOLD+'" stroke-opacity=".38" stroke-width=".7"/><path d="M14 4h172" stroke="white" stroke-width="3" stroke-linecap="round"/><path d="M7 266q1 8 10 8h166" stroke="#D8D2BE" stroke-opacity=".28" stroke-width="2"/>';
  }

  function index(rank, s) {
    const shown = rank === 'T' ? '10' : rank;
    const half = '<text x="24" y="39" text-anchor="middle" fill="' + SUITS[s].color + '" font-family="Georgia,Times New Roman,serif" font-size="32" font-weight="700" letter-spacing="-2">' + shown + '</text>' + suit(s,24,56,.57);
    return half + '<g transform="rotate(180 100 140)">' + half + '</g>';
  }

  function ace(s) {
    let scrolls = '';
    for (const flip of ['', ' transform="rotate(180 100 140)"']) {
      scrolls += '<g' + flip + ' stroke="' + GOLD + '" stroke-width="1" opacity=".85"><path d="M62 95q-17 17-4 33t-6 28m10-57q-7 12 1 20m-8 18-7-5m7 16-8 4M138 95q17 17 4 33t6 28m-10-57q7 12-1 20m8 18 7-5m-7 16 8 4"/><path d="m94 74 6-7 6 7-6 7Z"/><path d="M83 75h-9m43 0h9"/></g>';
    }
    return scrolls + suit(s,100,138,2.55) + '<path d="M73 205h54" stroke="'+GOLD+'" stroke-width=".8"/><text x="100" y="220" text-anchor="middle" font-family="Georgia,serif" font-size="8" letter-spacing="2.3" fill="'+NAVY+'">TERAMONT</text>';
  }

  function courtHalf(rank, s) {
    const ink = SUITS[s].color;
    const accent = s === 's' || s === 'c' ? RED : NAVY;
    const skin = '#F1D9B5';
    let detail = '';
    // Woven brocade: larger motifs stay readable at table size, fine lines reward a close look.
    for (let row = 0; row < 3; row++) {
      const y = 117 + row * 9;
      detail += '<path d="m57 '+y+' 4-3 4 3-4 3Zm76 0 4-3 4 3-4 3Z" fill="'+GOLD+'"/>';
    }
    let headwear;
    if (rank === 'K') {
      headwear = '<path d="m83 71-5-20 12 7 9-13 9 13 13-7-5 20Z" fill="'+GOLD+'" stroke="'+NAVY+'" stroke-width="1.3"/><path d="m84 62 7 3 8-11 8 11 8-3M84 68h31" stroke="'+PAPER+'" stroke-width="1.4"/><circle cx="99" cy="47" r="2" fill="'+ink+'"/><path d="m96 65 3-4 3 4-3 3Z" fill="'+ink+'"/>';
    } else if (rank === 'Q') {
      headwear = '<path d="M84 73q-10-17 2-18l4-9 9 10 9-10 4 10q12 1 3 17" fill="'+GOLD+'" stroke="'+NAVY+'" stroke-width="1.3"/><path d="m88 60 11 6 12-6M86 70h27" stroke="'+PAPER+'" stroke-width="1.5"/><circle cx="99" cy="61" r="2.5" fill="'+ink+'"/><path d="M85 76q-9 14-4 28m34-28q11 19 4 30" stroke="'+GOLD+'" stroke-width="4"/>';
    } else {
      headwear = '<path d="M81 75q-9-17 8-20 17-7 30 6l-5 11Z" fill="'+accent+'" stroke="'+NAVY+'" stroke-width="1.3"/><path d="m83 73 33-5v7l-32 3Z" fill="'+GOLD+'"/><path d="M111 59q6-15 17-16-1 13-16 20m1-4 10-11" fill="'+PAPER+'" stroke="'+GOLD+'" stroke-width="1.5"/>';
    }
    let object;
    if (rank === 'Q') {
      object = '<path d="M138 138V91m0 17q-11-2-11-11 9 0 11 8m0 11q10-3 11-11-9 0-11 7" stroke="'+GOLD+'" stroke-width="2"/><path d="M138 76c-9-10-13 1-7 4-10 6-1 13 5 7 3 10 13 5 9-1 10-2 6-12-2-9 0-10-9-8-5-1Z" fill="'+ink+'" stroke="'+GOLD+'" stroke-width="1.2"/><circle cx="138" cy="82" r="4" fill="'+GOLD+'"/>';
    } else if (rank === 'K') {
      object = '<path d="M138 138V75" stroke="'+GOLD+'" stroke-width="4"/><path d="m138 58 7 10-7 10-7-10Z" fill="'+GOLD+'" stroke="'+NAVY+'" stroke-width="1.2"/><path d="M130 79h16m-12 4h8" stroke="'+GOLD+'" stroke-width="2"/><circle cx="138" cy="68" r="2.4" fill="'+ink+'"/>';
    } else {
      object = '<path d="m140 138-7-47 2-29 10 26 1 49Z" fill="'+PAPER+'" stroke="'+GOLD+'" stroke-width="1.5"/><path d="m135 69 8 54m-13-5 19-3" stroke="'+NAVY+'" stroke-width="1.4"/><path d="m135 124 14-2" stroke="'+GOLD+'" stroke-width="4"/>';
    }
    return '<path d="M49 140v-17q9-12 33-19l17 7 17-7q23 5 35 19v17Z" fill="'+ink+'" stroke="'+NAVY+'" stroke-width="1.3"/><path d="m81 106-8 34h38l7-34-19 9Z" fill="'+accent+'"/><path d="m80 107 19 19 19-19m-42 30 24-6 11 7M54 125l17-11m-16 17 15-9m60-9 16 12m-15-4 15 10" stroke="'+GOLD+'" stroke-width="1.5"/>' + detail + '<path d="M90 97v12l10 10 12-11V95" fill="'+skin+'" stroke="'+NAVY+'" stroke-width="1.2"/><path d="M85 81q-6-13 4-16 12-8 24 7 10 10 5 27l-7 8-25-5q-5-12-1-21Z" fill="'+NAVY+'"/>' + '<path d="M94 74q12-5 18 7v7l5 6-5 2v7q-10 7-21-8l-3-11q-2-8 6-10Z" fill="'+skin+'" stroke="'+NAVY+'" stroke-width="1.2"/><path d="m103 83 6 1m-2 3h1m-8 13q5 2 8 0m-6-6 5 1m-13-18q-5 9-2 14" stroke="'+NAVY+'" stroke-width="1.4" stroke-linecap="round"/><path d="m103 105-3 6-8-8" stroke="'+GOLD+'" stroke-width="1.6"/>' + (rank === 'K' ? '<path d="M94 96q8 9 18 5l-5 12-12-6-6-14" fill="'+NAVY+'"/><path d="m95 100 4 6m3-3 2 5" stroke="'+GOLD+'" stroke-width="1"/>' : '') + headwear + '<path d="m83 107 16 13 17-13-8 17H91Z" fill="'+PAPER+'" stroke="'+GOLD+'" stroke-width="1.2"/>' + object + '<path d="m129 127 6-6 7 2 2 9-9 3Z" fill="'+skin+'" stroke="'+NAVY+'" stroke-width="1.2"/><path d="m134 125 6 2m-7 2 7 2" stroke="'+NAVY+'" stroke-width=".8"/>' + suit(s,60,91,.45) + '<path d="M49 139h102" stroke="'+GOLD+'" stroke-width="2"/>';
  }

  function court(rank, s) {
    const half = courtHalf(rank,s);
    return '<rect x="45" y="41" width="110" height="198" rx="2" fill="#F4EBD8" stroke="'+GOLD+'" stroke-width="1.5"/><path d="M48 44h104v192H48Z" stroke="'+GOLD+'" stroke-width=".7"/>' + half + '<g transform="rotate(180 100 140)">' + half + '</g><path d="m49 140 18-5 33 5 33-5 18 5-18 5-33-5-33 5Z" fill="'+GOLD+'" stroke="'+NAVY+'" stroke-width=".7"/>';
  }

  function face(rank,s) {
    const central = rank === 'A' ? ace(s) : 'KQJ'.includes(rank) ? court(rank,s) : PIPS[rank].map(([x,y]) => suit(s,x,y,rank === 'T' || rank === '9' ? .82 : .94,y>140)).join('');
    return svg(paper() + index(rank,s) + central);
  }

  function backSvg() {
    let weave = '';
    for (let y=22;y<260;y+=12) {
      for (let x=22;x<183;x+=12) {
        weave += '<path d="m'+x+' '+y+' 5 5-5 5-5-5Z"/>';
      }
    }
    let flourishes = '';
    for (const rotation of [0,180]) {
      flourishes += '<g transform="rotate('+rotation+' 100 140)" stroke="'+GOLD+'" stroke-width="1.3"><path d="M47 97q-14-21 5-33 10-7 17-1 9 10-2 16-6 3-10-1 13-4 7-9-9-7-16 3-6 9 7 24m98 1q14-21-5-33-10-7-17-1-9 10 2 16 6 3 10-1-13-4-7-9 9-7 16 3 6 9-7 24M72 46q28 19 56 0m-47-8q19 12 38 0"/><path d="m94 48 6-9 6 9-6 9Z" fill="'+GOLD+'"/><path d="M49 107q4 17-10 33m112-33q-4 17 10 33"/></g>';
    }
    return svg(paper() + '<rect x="12" y="12" width="176" height="256" rx="5" fill="#214E59"/><g stroke="#D8CCA2" stroke-opacity=".16" stroke-width=".65">'+weave+'</g><rect x="17" y="17" width="166" height="246" rx="3" stroke="'+GOLD+'" stroke-width="1.3"/><path d="M23 49V23h26m102 0h26v26M23 231v26h26m102 0h26v-26" stroke="'+GOLD+'" stroke-width="2"/>'+flourishes+'<path d="m100 78 47 62-47 62-47-62Z" fill="'+NAVY+'" stroke="'+GOLD+'" stroke-width="2"/><path d="m100 88 38 52-38 52-38-52Z" stroke="'+GOLD+'" stroke-width=".7"/><path d="M79 126v-9h42v9m-21-9v47m-9 0h18" stroke="#E5D4A7" stroke-width="2.6" stroke-linecap="square"/><path d="m96 99 4-5 4 5-4 5Zm0 82 4-5 4 5-4 5Z" fill="'+GOLD+'"/><circle cx="74" cy="140" r="2" fill="'+GOLD+'"/><circle cx="126" cy="140" r="2" fill="'+GOLD+'"/>');
  }

  const BACK = backSvg();
  const FACES = Object.create(null);

  function shell(content, options, hidden, label) {
    const opts = options || {};
    const indexValue = Number.isFinite(Number(opts.index)) ? Math.max(0,Math.min(20,Number(opts.index))) : 0;
    const classes = 'poker-card' + (hidden ? ' is-hidden' : '') + (opts.winner ? ' is-winner' : '') + (opts.reveal && !hidden ? ' is-revealing' : '') + (opts.deal === false ? '' : ' is-dealt');
    const reverse = opts.reveal && !hidden ? '<span class="poker-card-back">'+BACK+'</span>' : '';
    return '<span class="'+classes+'" style="--deal-index:'+indexValue+'" role="img" aria-label="'+esc(label)+'"><span class="poker-card-inner"><span class="poker-card-'+(hidden?'back':'front')+'">'+content+'</span>'+reverse+'</span></span>';
  }

  function back(options) {
    return shell(BACK,options,true,'Карта соперника закрыта');
  }

  function card(code, options) {
    const opts = options || {};
    if (opts.hidden || code === null || code === undefined || code === '??') return back(opts);
    const normalized = String(code).trim().replace(/^10/i,'T');
    if (!/^[2-9tjqka][shdc]$/i.test(normalized)) return shell(BACK,{ ...opts, winner:false },true,'Карта не определена');
    const rank = normalized[0].toUpperCase();
    const s = normalized[1].toLowerCase();
    const key = rank+s;
    if (!FACES[key]) FACES[key] = face(rank,s);
    return shell(FACES[key],opts,false,opts.label || NAMES[rank]+' '+SUITS[s].name);
  }

  function art() {
    const miniature = (rank,s,x,y,rotation) => '<g fill="none" transform="translate('+x+' '+y+') rotate('+rotation+' 20 28) scale(.22)">'+face(rank,s).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')+'</g>';
    return '<svg class="game-art poker-art" viewBox="0 0 170 112" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="170" height="112" rx="14" fill="#E0EEEA"/><path d="M-12 100Q71 19 184 90" stroke="#C3DCD3" stroke-width=".8" fill="none"/><path d="M-8 107Q77 25 181 97" stroke="#C3DCD3" stroke-width=".8" fill="none"/><ellipse cx="86" cy="91" rx="55" ry="5" fill="#1E5145" opacity=".08"/>'+miniature('K','s',37,20,-17)+miniature('Q','h',65,13,-1)+miniature('A','s',92,22,16)+'<g transform="translate(41 84)"><ellipse cy="3" rx="12" ry="5" fill="#9E7738"/><ellipse rx="12" ry="5" fill="#C6A367" stroke="#FFF4D6" stroke-width="1.2"/><ellipse rx="7" ry="2.8" fill="none" stroke="#F9E2B7" stroke-width=".7"/></g><path d="m134 29 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#638F83"/></svg>';
  }

  const ICONS = {
    cards: '<g class="poker-icon-card-a"><path d="m9 4-4-.6a2 2 0 0 0-2.3 1.7L1.5 16a2 2 0 0 0 1.7 2.2L7 19"/></g><g class="poker-icon-card-b"><rect x="8" y="3" width="13" height="18" rx="2"/><path d="m14.5 8 3 4-3 4-3-4Z"/></g>',
    math: '<g class="poker-icon-equation"><path d="M3 7h7M6.5 3.5v7m8.5-5 5 5m0-5-5 5M3 17h7m5-2h6m-6 4h6"/></g>',
    chips: '<g class="poker-icon-chip-base"><ellipse cx="12" cy="15.5" rx="8.5" ry="4"/><path d="M3.5 15.5v3c0 2.2 3.8 4 8.5 4s8.5-1.8 8.5-4v-3m-15 3.5v2m5-1v2m5-2v2"/></g><g class="poker-icon-chip-top"><ellipse cx="12" cy="6.5" rx="8.5" ry="4"/><ellipse cx="12" cy="6.5" rx="4" ry="1.5"/><path d="M3.5 6.5v3c0 2.2 3.8 4 8.5 4s8.5-1.8 8.5-4v-3m-15 3.5v2m5-1v2m5-2v2"/></g>',
    shuffle: '<g class="poker-icon-shuffle-a"><path d="M3 6h3q3 0 6 6t6 6h3m-3-3 3 3-3 3"/></g><g class="poker-icon-shuffle-b"><path d="M3 18h3q2 0 4-3m4-6q2-3 4-3h3m-3-3 3 3-3 3"/></g>'
  };

  function icon(name) {
    const safeName = Object.hasOwn(ICONS,name) ? name : 'cards';
    return '<svg class="ui-icon poker-icon poker-icon-'+safeName+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+ICONS[safeName]+'</svg>';
  }

  window.PokerCards = Object.freeze({ card, back, art, icon });
})();
