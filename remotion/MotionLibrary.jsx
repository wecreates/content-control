import {characterMotion} from "./CharacterSystem";

const ease=(p)=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
export const resolveMotion=(character,pose,p,intensity=1)=>{
  const table=characterMotion[character]||{};
  const base=table[pose]||{lean:0,arm:0,leg:0};
  const e=ease(Math.max(0,Math.min(1,p)));
  const pulse=Math.sin(Math.PI*e);
  return {
    lean:(base.lean||0)*(.55+.45*pulse),
    arm:(base.arm||0)*(.5+.5*pulse)*intensity,
    leg:(base.leg||0)*(.5+.5*Math.sin(Math.PI*2*e))*intensity,
    bob:Math.sin(Math.PI*2*e)*6*intensity
  };
};
export const MOTION_LIBRARY_VERSION="1.0.0";
