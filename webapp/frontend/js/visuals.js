"use strict";
// Original Teramont game illustrations. Star glyph adapted from Iconimate/Phosphor;
// attribution and MIT license are in frontend/THIRD_PARTY_NOTICES.md.
const UI_PATHS={
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
  games:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>',
  route:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/>',
  flame:'<path d="M13 3c2 5-4 5-3 9 2 0 3-2 4-3 4 3 6 6 4 10a7 7 0 0 1-12-1c-3-6 1-8 2-11 0 4 3 4 3 1 0-2 0-3 2-5Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  erase:'<path d="m15 4 6 6-10 10H7l-5-5L13 4Z"/><path d="m8 9 7 7M11 20h10"/>',
  bulb:'<path d="M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9Z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
function uiIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(UI_PATHS[name]||UI_PATHS.games)+'</svg>';}
function rewardStar(){return '<svg class="reward-star" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"/></svg>';}
function gameArt(game){
  const colors={sudoku:["#E5EDFF","#4771D5"],memory:["#EEE6FC","#8761C8"],riddles:["#FCEBDA","#C47A3B"],sequences:["#E3F1FA","#3C8EBA"],tiles:["#FCE9E4","#C66E59"],pattern:["#E1F0E9","#418A69"],nonogram:["#E1EFEE","#3E8989"],arithmetic:["#FEEDD8","#BE7C34"],rebuses:["#EEE8FA","#8064B0"],stroop:["#F9E5EF","#AE5D87"]};
  const [wash,ink]=colors[game]||colors.sudoku;
  const rect=(x,y,w,h,fill,r=5)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'"/>';
  const text=(x,y,value,size=18,fill=ink)=>'<text x="'+x+'" y="'+y+'" fill="'+fill+'" font-size="'+size+'" font-weight="600" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">'+value+'</text>';
  let art="";
  if(game==="chess"){
    art=rect(35,15,100,82,"#fff",9);
    for(let i=0;i<16;i++){const x=43+i%4*22,y=22+Math.floor(i/4)*17;art+=rect(x,y,22,17,(i+Math.floor(i/4))%2?"#9EB1D0":"#EDF1F8",0);}
    art+='<g transform="translate(58 12) scale(1.2)">'+chessPiece("n","b").replace('class="chess-piece piece-black"','class="art-piece" width="48" height="66"')+'</g>';
  }else if(game==="sudoku"){
    art=rect(44,11,82,90,"#fff",7);
    for(let i=1;i<9;i++){const pos=44+i*9.1;art+='<path d="M'+pos+' 15v82M48 '+(15+i*9.1)+'h74" stroke="'+ink+'" stroke-opacity="'+(i%3===0?.6:.15)+'" stroke-width="'+(i%3===0?1.1:.6)+'"/>';}
    [[0,0,1],[2,0,9],[4,0,5],[7,0,8],[1,2,3],[5,2,7],[0,4,6],[3,4,1],[8,4,9],[2,6,7],[6,6,4],[4,8,8],[7,8,2]].forEach(([x,y,n])=>art+=text(48.8+x*9.1,19.5+y*9.1,n,7));
    art+=rect(62,42,28,28,ink,6)+text(76,56,5,19,"#fff");
  }else if(game==="memory"){
    art='<g transform="rotate(-12 65 58)">'+rect(33,23,52,69,ink,8)+rect(39,29,40,57,"none",5)+'<path d="m59 47 6-6 6 6-6 10Z" fill="#fff" opacity=".8"/></g><g transform="rotate(10 102 60)">'+rect(77,28,52,69,"#fff",8)+'<path d="M103 76 88 62c-12-12 6-22 15-10 9-12 27-2 15 10Z" fill="'+ink+'"/></g>';
  }else if(game==="pattern"||game==="nonogram"){
    const size=game==="pattern"?3:5,step=game==="pattern"?23:15,start=game==="pattern"?48:44;
    art=rect(start-7,15,size*step+10,size*step+10,"#fff",10);
    for(let i=0;i<size*size;i++){const on=game==="pattern"?[0,2,4,6].includes(i):[1,3,5,6,7,8,9,10,11,12,13,14,16,17,18,22].includes(i);art+=rect(start+i%size*step,22+Math.floor(i/size)*step,step-4,step-4,on?ink:wash,3);}
  }else if(game==="tiles"){
    for(let i=0;i<9;i++){const x=44+i%3*27,y=16+Math.floor(i/3)*27;art+=rect(x,y,24,24,i===8?"#F6D8CE":i===4?ink:"#fff",5);if(i<8)art+=text(x+12,y+12,i+1,13,i===4?"#fff":ink);}
  }else if(game==="arithmetic"){
    ["+","=","×","−"].forEach((n,i)=>{const x=40+i%2*43,y=16+Math.floor(i/2)*43;art+=rect(x,y,38,38,i===0?ink:"#fff",9)+text(x+19,y+19,n,27,i===0?"#fff":ink);});
  }else if(game==="sequences"){
    art='<path d="M33 78 62 56l29 5 33-38" stroke="'+ink+'" stroke-width="2" fill="none" opacity=".4"/>';
    [[34,76,2],[65,55,4],[96,62,8],[127,29,"?"]].forEach(([x,y,n],i)=>art+=rect(x-16,y-16,32,32,i===3?ink:"#fff",9)+text(x,y,n,18,i===3?"#fff":ink));
  }else if(game==="rebuses"){
    ["А","Б","?"].forEach((n,i)=>art+='<g transform="rotate('+(i-1)*9+' '+(40+i*41)+' 58)">'+rect(24+i*41,31,35,48,i===2?ink:"#fff",7)+text(41+i*41,55,n,23,i===2?"#fff":ink)+'</g>');
    art+='<path d="M50 91h60" stroke="'+ink+'" stroke-width="3" stroke-linecap="round" opacity=".4"/>';
  }else if(game==="stroop"){
    art=rect(32,24,99,65,"#fff",12)+text(81,55,"СИНИЙ",18,"#B94554");
    ["#4771D5","#418A69","#CF983C","#B94554"].forEach((c,i)=>art+='<circle cx="'+(48+i*22)+'" cy="78" r="6" fill="'+c+'"/>');
  }else{
    art=rect(36,24,51,59,"#fff",9)+text(61,52,"?",32);
    art+='<g transform="rotate(12 106 63)">'+rect(84,43,43,48,ink,8)+text(106,65,"!",25,"#fff")+'</g><circle cx="116" cy="22" r="5" fill="'+ink+'" opacity=".3"/>';
  }
  return '<svg class="game-art" viewBox="0 0 170 112" aria-hidden="true"><rect width="170" height="112" rx="14" fill="'+wash+'"/><circle cx="154" cy="6" r="48" fill="'+ink+'" opacity=".045"/><circle cx="6" cy="108" r="35" fill="'+ink+'" opacity=".045"/>'+art+'</svg>';
}
