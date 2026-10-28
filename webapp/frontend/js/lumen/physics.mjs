// Foot circles are independent of weapon/projectile hitboxes. All calculations
// are deterministic world-space operations; no render rate or random calls.
export const CONTACT_PERIOD = .32;
export const PLAYER_BODY = 20;
const EPS = 1e-6;
const CELL = 96; // Largest possible body diameter is 90.
export function bodyRadius(entity) {
  if (!entity.kind || entity.kind === 'hero') return PLAYER_BODY;
  if(entity.kind==='castle-prop')return entity.radius;
  if(entity.kind==='arena-boss'&&entity.bossType==='monarch')return entity.radius;
  if(entity.kind==='arena-tick')return entity.radius+2;
  const padding = entity.kind === 'guardian' ? 9 : entity.elite ? 8
    : ['wasp','wisp','moonmoth'].includes(entity.kind) ? 10 : 12;
  return Math.min(45, entity.radius + padding);
}

// Sweep the player's circle to its FIRST obstruction, then keep only tangential
// motion. Walking cannot push a monster, tunnel through it, or cross a closed ring.
export function movePlayer(player, enemies, dx, dy) {
  for (let pass = 0; pass < 4 && Math.hypot(dx,dy) > EPS; pass++) {
    let first = 1, normal = null;
    const a = dx*dx + dy*dy;
    for (const enemy of enemies) {
      if (enemy.hp <= 0||enemy.kind==='castle-door') continue;
      const ox = player.x-enemy.x, oy = player.y-enemy.y;
      const radius = PLAYER_BODY+bodyRadius(enemy);
      const b = ox*dx+oy*dy, c = ox*ox+oy*oy-radius*radius;
      if (b >= -EPS) continue; // Outward/tangential motion is always allowed.
      const discriminant = b*b-a*c;
      if (discriminant < 0) continue;
      const t = c <= EPS ? 0 : (-b-Math.sqrt(discriminant))/a;
      if (t < 0 || t > first) continue;
      const nx = ox+dx*t, ny = oy+dy*t, length = Math.hypot(nx,ny);
      if (length < EPS) continue; // Old overlapping saves are resolved below.
      first = t; normal = [nx/length,ny/length];
    }
    player.x += dx*first; player.y += dy*first;
    if (!normal) break;
    dx *= 1-first; dy *= 1-first;
    const inward = Math.min(0,dx*normal[0]+dy*normal[1]);
    dx -= inward*normal[0]; dy -= inward*normal[1];
  }
}

const mass = e => e.kind === 'guardian' ? 5 : e.elite ? 3
  : ['beetle','shardback','palace-guard'].includes(e.kind) ? 2 : 1;
function direction(a,b) {
  const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
  if(d>EPS)return [dx/d,dy/d,d];
  // Stable escape from exactly coincident centers, including migrated saves.
  const angle=((a.id||0)*2.399963229728653+(b.id||0)*.754877666)% (Math.PI*2);
  return [Math.cos(angle),Math.sin(angle),0];
}
function keepOutsidePlayer(enemy,player,radius) {
  const [nx,ny,d]=direction(enemy,player);
  if(d<radius){enemy.x+=nx*(radius-d);enemy.y+=ny*(radius-d);}
}

export function separateCrowd(enemies,player) {
  const alive=enemies.filter(e=>e.hp>0&&e.kind!=='castle-door');
  const radii=alive.map(bodyRadius),masses=alive.map(mass);
  // Positions are bounded by save validation to +/- 1e7. This numeric key is
  // injective in that range and avoids allocating nine strings per body/pass.
  const key=(x,y)=>(x+131072)*262144+y+131072;
  // Rebuild after each positional pass: corrections may cross cell boundaries.
  for(let pass=0;pass<4;pass++) {
    const grid=new Map();
    for(let i=0;i<alive.length;i++) {
      const e=alive[i],cell=key(Math.floor(e.x/CELL),Math.floor(e.y/CELL));
      if(!grid.has(cell))grid.set(cell,[]);
      grid.get(cell).push(i);
    }
    for(let i=0;i<alive.length;i++) {
      const a=alive[i],cx=Math.floor(a.x/CELL),cy=Math.floor(a.y/CELL);
      for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++) {
        for(const j of grid.get(key(x,y))||[]) {
          if(j<=i)continue;
          const b=alive[j],radius=radii[i]+radii[j];
          const fixedA=['arena-tick','arena-boss'].includes(a.kind),fixedB=['arena-tick','arena-boss'].includes(b.kind);
          if(fixedA&&fixedB)continue;
          if((a.x-b.x)**2+(a.y-b.y)**2>=radius*radius)continue;
          const [nx,ny,d]=direction(a,b);
          if(d>=radius)continue;
          const depth=radius-d,share=fixedA?0:fixedB?1:masses[j]/(masses[i]+masses[j]);
          a.x+=nx*depth*share;a.y+=ny*depth*share;
          b.x-=nx*depth*(1-share);b.y-=ny*depth*(1-share);
        }
      }
    }
    for(let i=0;i<alive.length;i++)if(!['arena-tick','arena-boss'].includes(alive[i].kind))keepOutsidePlayer(alive[i],player,radii[i]+PLAYER_BODY);
  }
}

export const touchingEnemies = state => state.enemies.filter(e=>e.hp>0&&e.kind!=='castle-door'
  && Math.hypot(e.x-state.player.x,e.y-state.player.y)<=PLAYER_BODY+bodyRadius(e)+1);
export function contactDamage(contacts) {
  return contacts.length ? Math.round(Math.max(...contacts.map(e=>e.damage))
    *(1+.28*Math.min(4,contacts.length-1))) : 0;
}
