"use strict";
// Original, compact SVG chessmen drawn for the Teramont board.
function chessPiece(type,color){
  const shapes={
    p:'<circle cx="24" cy="13" r="6"/><path d="M20 19h8c-1 8 1 11 5 15H15c4-4 6-7 5-15Z"/><path d="M13 35h22v5H13Z"/>',
    r:'<path d="M12 7h6v6h4V7h5v6h4V7h6v13H12Z"/><path d="M17 20h15l-2 14H19Z"/><path d="M13 35h23v5H13Z"/>',
    n:'<path d="m16 5 7 5 8 1 7 11-7 2-6-4-4 4c11-1 14 4 13 10H13c-1-8 2-12 6-17l-6 1-3-4 6-9Z"/><path d="M12 35h24v5H12Z"/><circle cx="27" cy="15" r="1.3" fill="'+(color==='w'?'#2C3B56':'#fff')+'" stroke="none"/>',
    b:'<path d="M24 5c-11 7-13 14-5 19h10c8-5 6-12-5-19Z"/><path d="m26 11-5 7" fill="none"/><path d="M20 25h8l4 9H16Z"/><path d="M13 35h22v5H13Z"/>',
    q:'<path d="m10 12 7 5 7-9 7 9 7-5-6 20H16Z"/><circle cx="10" cy="9" r="2.5"/><circle cx="24" cy="5" r="2.5"/><circle cx="38" cy="9" r="2.5"/><path d="M13 35h22v5H13Z"/><path d="M16 29h16" fill="none"/>',
    k:'<path d="M24 4v10m-5-6h10" fill="none" stroke-width="3"/><path d="M24 17c-12-9-19 4-11 11l5 5h12l5-5c8-7 1-20-11-11Z"/><path d="M13 35h22v5H13Z"/>'
  };
  return '<svg class="chess-piece '+(color==='w'?'piece-white':'piece-black')+'" viewBox="0 0 48 48" fill="'+(color==='w'?'#FFFFFF':'#2C3B56')+'" stroke="'+(color==='w'?'#435675':'#17233B')+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+shapes[type]+'</svg>';
}
