import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode1V10NarrationCandidate} from "./Episode1V10NarrationCandidate";
// Explicit diagnostic entrypoint, never imported by canonical v10-index.jsx.
const Root=()=> <Composition id="Episode1V10NarrationCandidate" component={Episode1V10NarrationCandidate} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
