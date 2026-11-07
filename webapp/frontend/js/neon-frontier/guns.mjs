const IMPULSE = {
  id: "impulse", label: "Веер", description: "Частый залп веером",
  shade: "#2060a5", edge: "#62ccff", light: "#ddfaff",
};

export const BEAM = {
  id: "beam", label: "Луч", description: "Луч прошивает цели после зарядки",
  shade: "#255f92", edge: "#78dcff", light: "#effdff",
};

export const PLASMA = {
  id: "plasma", label: "Плазма", description: "Плазма взрывается при попадании",
  shade: "#117771", edge: "#61f6c2", light: "#e5fff2",
};

export function cannonProfile(rank) {
  return rank === 2 ? BEAM : rank === 3 ? PLASMA : IMPULSE;
}
