// Visual layout only. Collision, progression, saves and input live in the engine.
// Props use [atlas slot, centre x, bottom y, width, height].
export const SCENES=Object.freeze([
  {ambient:'#89818e',mist:'#c9a5ad',fans:[[378,160,154]],props:[[12,158,161,204,110],[6,474,384,184,164],[9,665,384,90,155],[15,680,144,40,82]],moss:false},
  {ambient:'#787c96',mist:'#a3a3c5',fans:[[242,264,158],[523,257,134]],props:[[9,152,384,158,177],[15,474,144,55,84],[9,665,384,130,190]],moss:false},
  {ambient:'#82828c',mist:'#b8b4b1',fans:[[541,260,156]],props:[[12,345,168,230,104],[15,680,144,42,82],[6,145,384,90,120],[9,694,384,74,142]],moss:false},
  {ambient:'#89808a',mist:'#d3a59a',fans:[[126,263,124]],props:[[5,409,384,207,206],[15,288,144,77,91],[9,680,384,110,165]],moss:false},
  {ambient:'#7e867f',mist:'#a7b2a1',fans:[[238,255,150]],props:[[5,458,384,170,168],[15,324,144,84,94],[9,660,384,130,192],[12,264,144,150,83]],moss:true},
  {ambient:'#897a85',mist:'#d6a298',fans:[[318,249,149]],props:[[5,528,384,180,181],[15,176,384,75,128],[12,365,168,203,100]],moss:false}
]);
export const VISUAL_LIMITS=Object.freeze({dust:24,rays:64,lightStep:6,lightRadius:170});
