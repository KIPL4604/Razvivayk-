// Visual layout only. Collision, progression, saves and input live in the engine.
// Props use [atlas slot, centre x, bottom y, width, height].
export const SCENES=Object.freeze([
  {ambient:'#989fa2',mist:'#c9a5ad',fans:[[378,152,125],[590,535,110]],props:[[12,158,240,164,100],[6,430,672,150,164],[9,610,672,70,155],[15,590,240,40,82]],moss:false},
  {ambient:'#989fa2',mist:'#a3a3c5',fans:[[242,138,110],[523,540,110]],props:[[9,152,672,138,177],[15,474,240,55,84],[9,665,672,90,190]],moss:false},
  {ambient:'#989fa2',mist:'#b8b4b1',fans:[[541,320,100]],props:[[12,345,240,180,104],[15,680,240,42,82],[6,145,672,90,120],[9,694,672,74,142]],moss:false},
  {ambient:'#989fa2',mist:'#d3a59a',fans:[[126,330,100]],props:[[5,409,672,160,170],[15,288,240,77,91],[9,680,672,85,165]],moss:false},
  {ambient:'#989fa2',mist:'#a7b2a1',fans:[[238,340,110]],props:[[5,458,672,130,168],[15,324,240,84,94],[9,660,672,100,192],[12,264,240,120,83]],moss:true},
  {ambient:'#989fa2',mist:'#d6a298',fans:[[318,550,110]],props:[[5,528,672,140,181],[15,176,672,65,128],[12,365,240,180,100]],moss:false},
  {ambient:'#879593',mist:'#a18eb7',fans:[],props:[],moss:true},
  {ambient:'#8c9b8e',mist:'#9fb8a0',fans:[],props:[],moss:true}
]);
export const VISUAL_LIMITS=Object.freeze({dust:24,rays:64,lightStep:6,lightRadius:170});
// Short synthesized cues use the existing opt-in audio setting; no ambient loop.
export const SOUND_CUES=Object.freeze({crawl:[63,38,.07,.018],dash:[160,45,.16,.04],body:[78,28,.13,.045],grab:[190,52,.1,.035],human:[240,90,.13,.035],call:[540,390,.18,.025],warning:[660,300,.18,.025],glass:[690,125,.1,.025],panel:[120,32,.16,.04],echo:[780,180,.35,.028]});
