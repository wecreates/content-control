import React from "react";
import {Composition,registerRoot} from "remotion";
import {ReferenceCloneLongComposition} from "./ReferenceCloneLongComposition";

const fallbackPlan={
  schema_version:1,
  duration_seconds:6,
  scenes:[
    {index:0,start:0,end:3,character:"dave",camera:"punch_in",shot_scale:"wide"},
    {index:1,start:3,end:6,character:"points_monk",camera:"tracking",shot_scale:"medium"}
  ],
  publication_enabled:false
};
const calc=({props})=>({durationInFrames:Math.max(1,Math.ceil((props.scenePlan?.duration_seconds||6)*24))});
const Root=()=> <Composition id="ReferenceCloneLong" component={ReferenceCloneLongComposition} defaultProps={{scenePlan:fallbackPlan}} calculateMetadata={calc} durationInFrames={144} fps={24} width={1920} height={1080}/>;
registerRoot(Root);
