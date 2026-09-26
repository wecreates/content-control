import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V7VerticalProof} from "./Episode1V7VerticalProof";
const Root=()=> <Composition id="Episode1V7VerticalProof" component={Episode1V7VerticalProof} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
