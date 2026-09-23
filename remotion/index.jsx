import React from "react";
import {Composition, registerRoot} from "remotion";
import {Episode1Motion} from "./Episode1Motion";

const Root = () => (
  <Composition
    id="Episode1Motion"
    component={Episode1Motion}
    durationInFrames={9180}
    fps={30}
    width={1280}
    height={720}
  />
);

registerRoot(Root);
