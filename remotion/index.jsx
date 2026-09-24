import React from "react";
import {Composition, registerRoot} from "remotion";
import {Episode1Motion} from "./Episode1Motion";
import {Episode1V4} from "./Episode1V4";
import {Episode1V5Proof} from "./Episode1V5Proof";

const Root = () => (
  <>
    <Composition
      id="Episode1Motion"
      component={Episode1Motion}
      durationInFrames={18000}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{audioDuration:306}}
    />
    <Composition
      id="Episode1V4"
      component={Episode1V4}
      durationInFrames={18000}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{audioDuration:316}}
    />
    <Composition
      id="Episode1V5Proof"
      component={Episode1V5Proof}
      durationInFrames={900}
      fps={30}
      width={1280}
      height={720}
    />
  </>
);

registerRoot(Root);
