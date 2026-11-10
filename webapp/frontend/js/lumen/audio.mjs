import {assetBytes} from './asset-cache.mjs';

const RATE=12000,LOOP=16,TAU=Math.PI*2;
const hz=midi=>440*2**((midi-69)/12);
const THEMES={
  garden:{chords:[[45,57,60,64],[41,53,57,60],[48,55,60,64],[43,55,59,62]],
    melody:[69,72,76,74,72,69,67,71],timbre:.16},
  quarry:{chords:[[38,50,53,57],[36,48,55,58],[34,46,53,57],[36,48,51,55]],
    melody:[74,81,77,72,77,69,75,72],timbre:.08},
  castle:{chords:[[36,48,51,55],[32,44,48,51],[41,48,53,56],[43,50,55,59]],
    melody:[67,63,68,72,65,68,62,71],timbre:.32},
  crater:{chords:[[36,48,55,58],[34,46,53,55],[38,50,53,57],[36,48,51,55]],
    melody:[67,70,65,70,74,69,63,67],timbre:.23},
};

function writeNote(samples,start,midi,duration,volume,attack,release,harmonic,ratio=2){
  const startFrame=Math.round(start*RATE),length=Math.round(duration*RATE);
  const increment=TAU*hz(midi)/RATE;
  for(let i=0;i<length;i++){
    const time=i/RATE,phase=i*increment;
    const envelope=Math.min(1,time/attack,(duration-time)/release);
    const voice=Math.sin(phase)+Math.sin(phase*ratio)*harmonic;
    samples[(startFrame+i+samples.length)%samples.length]+=voice*envelope*volume;
  }
}

function makeScore(context,map){
  const theme=THEMES[map],buffer=context.createBuffer(1,RATE*LOOP,RATE);
  const samples=buffer.getChannelData(0);
  theme.chords.forEach((chord,bar)=>{
    const start=bar*4;
    chord.forEach((note,index)=>writeNote(samples,start-.28+index*.15,note,4.65,
      index===0?.105:.044,.65,1.3,theme.timbre));
    for(let beat=0;beat<2;beat++){
      const note=theme.melody[bar*2+beat];
      const time=start+.5+beat*1.87;
      const crystal=map==='quarry';
      writeNote(samples,time,note,crystal?1.75:1.36,.092,.045,1,crystal?.35:.19,crystal?2.76:2);
      if(crystal||map==='garden')writeNote(samples,time+.29,note,1.1,.022,.07,.83,.12);
    }
  });
  return buffer;
}

// [delay, initial Hz, final Hz, duration, relative level, oscillator type]
const NOTES={
  boulder:[[0,89,34,.36,.85,'sine'],[.13,442,382,.16,.23,'triangle']],
  glass:[[0,1256,937,.16,.43,'triangle'],[.04,1710,1390,.24,.29,'sine'],[.10,791,666,.28,.31,'sine']],
  brambles:[[0,178,76,.18,.45,'triangle'],[.03,328,209,.19,.21,'sine']],
  crystal:[[0,880,940,.105,.45,'sine'],[.043,1318,1304,.15,.25,'sine']],
  chest:[[0,330,330,.25,.48,'triangle'],[.065,494,494,.27,.42,'sine'],[.136,659,660,.33,.31,'triangle']],
  level:[[0,523,523,.18,.54,'triangle'],[.075,659,659,.24,.44,'sine'],[.15,784,1046,.36,.39,'sine']],
  hurt:[[0,155,67,.20,.58,'triangle']],
  kill:[[0,328,165,.13,.38,'triangle']],
  boss:[[0,98,94,.48,.54,'triangle'],[.10,147,139,.55,.38,'sine']],
};
// [duration, low-pass cutoff, level]
const NOISE={boulder:[.31,620,.62],glass:[.25,4900,.31],brambles:[.24,1100,.37],chest:[.13,1700,.19],hurt:[.10,740,.21],kill:[.085,650,.2]};
const COOLDOWN={boulder:.15,glass:.17,brambles:.18,crystal:.09,chest:.28,level:.32,hurt:.21,kill:.14,boss:.8};
const SAMPLES={
  quarry:{cue:'boulder',file:'audio/quarry-impact.ogg',bytes:12433,sha256:'2609b1bc63425f80c524480db5ac1e5b0dcf1d62194d4a905c126db7be106704'},
  castle:{cue:'glass',file:'audio/castle-glass.ogg',bytes:7831,sha256:'4626d66ba683c7fd41044826f7c7d9fd689593e9f47cc9888d62a2cb1874c33e'},
};

export class LumenAudio{
  constructor(){
    this.context=null;this.master=null;this.noise=null;
    this.scores=new Map();this.pendingScores=new Set();
    this.samples=new Map();this.voices=new Set();this.lastCue=new Map();
    this.loop=null;this.boss=false;this.requestedSample=null;
  }

  unlock(settings){
    if(!settings.sound||!settings.volume)return;
    try{
      if(!this.context){
        const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
        const context=new AudioContext(),master=context.createGain();
        master.gain.value=settings.volume/100;master.connect(context.destination);
        this.context=context;this.master=master;
      }
      if(this.context.state!=='running')void this.context.resume().catch(()=>{});
    }catch{/* Audio is optional in unsupported or restricted webviews. */}
  }

  reset(boss){
    this.stop();
    this.boss=boss;this.requestedSample=null;
    this.lastCue.clear();
  }

  prepareScore(context,map){
    if(this.pendingScores.has(map))return;
    this.pendingScores.add(map);
    const prepare=()=>{
      this.scores.set(map,makeScore(context,map));
      this.pendingScores.delete(map);
    };
    if(globalThis.requestIdleCallback)globalThis.requestIdleCallback(prepare,{timeout:500});
    else setTimeout(prepare,0);
  }

  update(map,boss,settings){
    const context=this.context;
    if(!settings.sound||!settings.volume){this.stop();return;}
    if(context?.state!=='running')return;
    const now=context.currentTime;
    if(this.volume!==settings.volume){
      this.volume=settings.volume;
      this.master.gain.setTargetAtTime(settings.volume/100,now,.03);
    }
    if(this.loop?.map!==map){
      this.stopMusic();
      const sample=SAMPLES[map];
      if(sample&&this.requestedSample!==sample&&!this.samples.has(sample.cue)){
        this.requestedSample=sample;
        // Fetch alongside the expedition. A slow or unsupported sample leaves the synthesized cue available.
        void assetBytes(sample,undefined,{priority:'low'}).then(bytes=>context.decodeAudioData(bytes.slice(0)))
          .then(buffer=>this.samples.set(sample.cue,buffer)).catch(()=>{});
      }
      if(!this.scores.has(map)){this.prepareScore(context,map);return;}
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=this.scores.get(map);
      source.loop=true;
      source.playbackRate.value=boss?1.055:1;
      gain.gain.value=0;
      gain.gain.setTargetAtTime(boss?.38:.25,now,.20);
      source.connect(gain);gain.connect(this.master);
      source.start();
      this.loop={map,source,gain};
    }
    if(boss!==this.boss){
      this.boss=boss;
      this.loop.source.playbackRate.setTargetAtTime(boss?1.055:1,now,.27);
      this.loop.gain.gain.setTargetAtTime(boss?.38:.25,now,.27);
      if(boss)this.play('boss');
    }
  }

  stopMusic(){
    if(!this.loop)return;
    const {source,gain}=this.loop;
    source.stop();source.disconnect();gain.disconnect();
    this.loop=null;
  }

  stop(){
    this.stopMusic();
    for(const voice of this.voices)voice.disconnect();
    this.voices.clear();
  }

  play(kind){
    const context=this.context;
    if(context?.state!=='running'||this.voices.size>=6)return;
    const now=context.currentTime;
    if(now-(this.lastCue.get(kind)??-Infinity)<COOLDOWN[kind])return;
    this.lastCue.set(kind,now);
    const voice=context.createGain();
    voice.gain.value=.17;voice.connect(this.master);this.voices.add(voice);
    const sample=this.samples.get(kind);
    let layers=NOTES[kind].length+Number(Boolean(sample||NOISE[kind]));
    const add=(source,start,duration,level,filter)=>{
      const envelope=context.createGain();
      envelope.gain.value=.0001;
      envelope.gain.setValueAtTime(.0001,start);
      envelope.gain.exponentialRampToValueAtTime(level,start+.009);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      if(filter)source.connect(filter);
      (filter||source).connect(envelope);envelope.connect(voice);
      source.onended=()=>{
        source.disconnect();filter?.disconnect();envelope.disconnect();
        if(--layers===0&&this.voices.delete(voice))voice.disconnect();
      };
      source.start(start);source.stop(start+duration+.01);
    };
    for(const [delay,from,to,duration,level,type] of NOTES[kind]){
      const start=now+delay,osc=context.createOscillator();
      osc.type=type;
      osc.frequency.setValueAtTime(from,start);
      osc.frequency.exponentialRampToValueAtTime(to,start+duration);
      add(osc,start,duration,level);
    }
    if(sample){
      const source=context.createBufferSource();
      source.buffer=sample;
      add(source,now,sample.duration,kind==='boulder'?.68:.52);
    }else if(NOISE[kind]){
      if(!this.noise){
        this.noise=context.createBuffer(1,RATE/2,RATE);
        let seed=27845;
        const samples=this.noise.getChannelData(0);
        for(let i=0;i<samples.length;i++){
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          samples[i]=seed/0x80000000-1;
        }
      }
      const [duration,cutoff,level]=NOISE[kind];
      const noise=context.createBufferSource(),filter=context.createBiquadFilter();
      noise.buffer=this.noise;filter.frequency.value=cutoff;
      add(noise,now,duration,level,filter);
    }
  }
}
