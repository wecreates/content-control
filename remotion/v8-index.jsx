import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V8VerticalProof} from "./Episode1V8VerticalProof";
const Root=()=> <Composition id="Episode1V8VerticalProof" component={Episode1V8VerticalProof} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
