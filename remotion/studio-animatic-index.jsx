import React from "react";
import {Composition,registerRoot} from "remotion";
import {StudioAnimaticComposition} from "./StudioAnimaticComposition";
const fallback={schema_version:1,scenes:[{id:"scene-000",start:0,end:3,story:{beat:"ROUGH ANIMATIC"},camera:{shot_scale:"medium",move:"punch_in"},characters:[{id:"dave"}],props:[{id:"card"}]}]};
const calc=({props})=>({durationInFrames:Math.max(1,Math.ceil(Math.max(...(props.ccsd?.scenes||fallback.scenes).map(s=>Number(s.end)||0),3)*24))});
const Root=()=> <Composition id="StudioAnimatic" component={StudioAnimaticComposition} defaultProps={{ccsd:fallback}} calculateMetadata={calc} durationInFrames={72} fps={24} width={720} height={1280}/>;
registerRoot(Root);
