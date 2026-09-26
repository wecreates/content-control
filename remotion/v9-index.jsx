import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V9VerticalProof} from "./Episode1V9VerticalProof";

const Root=()=> <Composition id="Episode1V9VerticalProof" component={Episode1V9VerticalProof} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
