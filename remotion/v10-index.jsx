import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V10FinalProof} from "./Episode1V10FinalProof";
const Root=()=> <Composition id="Episode1V10FinalProof" component={Episode1V10FinalProof} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
