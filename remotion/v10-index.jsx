import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V10VerticalProof} from "./Episode1V10VerticalProof";
const Root=()=> <Composition id="Episode1V10VerticalProof" component={Episode1V10VerticalProof} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
