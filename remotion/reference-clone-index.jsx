import React from "react";
import {Composition,registerRoot} from "remotion";
import {ReferenceCloneComposition} from "./ReferenceCloneComposition";

const fallbackPlan={
  schema_version:1,
  duration_seconds:4,
  visual_style_fingerprint:{mean_luma:1,mean_rgb:[1,1,1]},
  scenes:[
    {index:0,start:0,end:2,character:"dave",pose:"recoil",camera:"punch_in",shot_scale:"close",motion_intensity:.05},
    {index:1,start:2,end:4,character:"points_monk",pose:"deadpan_point",camera:"snap_wide",shot_scale:"medium",motion_intensity:.03}
  ],
  publication_enabled:false
};
const calc=({props})=>({durationInFrames:Math.max(1,Math.ceil((props.scenePlan?.duration_seconds||4)*24))});
const Root=()=> <Composition id="ReferenceClone" component={ReferenceCloneComposition} defaultProps={{scenePlan:fallbackPlan}} calculateMetadata={calc} durationInFrames={96} fps={24} width={720} height={1280}/>;
registerRoot(Root);
