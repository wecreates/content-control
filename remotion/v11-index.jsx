import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V11FinalProof} from "./Episode1V11FinalProof";
const Root=()=> <Composition id="Episode1V11FinalProof" component={Episode1V11FinalProof} durationInFrames={580} fps={24} width={720} height={1280}/>;
registerRoot(Root);
