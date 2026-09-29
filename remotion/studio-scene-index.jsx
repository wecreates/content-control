import React from "react";
import {Composition,registerRoot} from "remotion";
import {StudioAnimaticComposition} from "./StudioAnimaticComposition";
const fallback={schema_version:1,scenes:[{id:"scene-000",start:0,end:3,story:{beat:"SCENE"},camera:{},characters:[{id:"dave"}],props:[]}]};
const normalize=(props)=>{const id=props.sceneId;const src=props.ccsd||fallback;const found=(src.scenes||[]).find(s=>s.id===id)||(src.scenes||[])[0];if(!found)return fallback;const d=Math.max(.1,Number(found.end)-Number(found.start));return {...src,scenes:[{...found,start:0,end:d}]};};
const Scene=props=><StudioAnimaticComposition ccsd={normalize(props)}/>;
const calc=({props})=>{const n=normalize(props);return {durationInFrames:Math.max(1,Math.ceil(Number(n.scenes[0].end)*24))}};
const Root=()=> <Composition id="StudioScene" component={Scene} defaultProps={{ccsd:fallback,sceneId:"scene-000"}} calculateMetadata={calc} durationInFrames={72} fps={24} width={720} height={1280}/>;
registerRoot(Root);
