// Seconds, world pixels and pixels/second. Fixed-step simulation owns these values.
export const TENDRIL=Object.freeze({speed:760,retract:540,radius:7,retry:.16,stiffness:90,damping:9,maxSpeed:280,rest:18,crateRest:52,recoil:.12,maxRecoil:34,absorbDelay:.55,absorbTime:.28,absorbDistance:34,struggle:32,struggleRate:13,sweepStep:2,humanRadius:15,crateRadius:16,objectRadius:12,extendTaut:.7,retractTaut:.25});
export const LIMB=Object.freeze({reach:200,stageReach:28,extend:460,retract:360,spool:64,pullRate:24,pullStiffness:3,segments:8,passes:3,gravity:95,damping:.88,slack:26,maxPointSpeed:300,orderMargin:.35,bendLimit:20,bendRatio:.15,collisionStep:3,tensionDistance:28,forwardThreshold:8});
export const BODY=Object.freeze({gravity:170,peripheralGravity:110,impactSpeed:110,impactScale:300,impactCooldown:.28,impactDecay:5,recoil:24});
export const HUMAN=Object.freeze({heldDragX:.94,heldDragY:.97,maxJointSpeed:300,maxFallSpeed:360,gravity:420,torsoOffset:-8,footReach:48,footProbe:2,constraintPasses:5,constraintRate:.4,maxCorrection:2,getupCorrection:28,groundProbe:16,tetherSpread:.48});
export const SENSE=Object.freeze({sight:320,eyeOffset:20,near:48,cone:.18,memory:4.5,reaction:.28,civilianReactionScale:1.25,armedReactionScale:.8,search:2.8,hearing:300,noiseLife:.65,maxNoises:12,occludedHearing:.32,traceRange:150,traceAge:75,scanTicks:12,fleeSpeed:58,searchSpeed:24,arrival:12,lookRate:2,callDelay:1.1,callRange:240,callAlert:1.5,stepNoise:.7,soundGap:.16});
export const BLOOD=Object.freeze({dryTime:45,dripTime:4,dripLength:18,traceSize:4});
export const NAV=Object.freeze({grid:12,bodyHalf:9,maxStep:40,landingReach:66,climbSpeed:64,walkSpeed:30,runSpeed:86,repath:1.2,arrival:9,climbCost:1.15,verticalWeight:2,escapeTravelPenalty:.13,levelSafety:40,rungSpacing:12,dangerRadius:150,dangerWeight:5});
export const ROUTINE=Object.freeze({workTime:6,restTime:1.5,panicDelay:.22,noisePanic:.6,stumbleTime:.3,sampleDrop:5,patrolRadius:130,dockReach:26,dockArrival:2});
export const ECHO=Object.freeze({radius:310,duration:2.2,waveTime:.9,cooldown:6,unlockRoom:2});
export const BIOME=Object.freeze({wetSpeed:.78,wetDrag:.94,organicTraction:1.12});
