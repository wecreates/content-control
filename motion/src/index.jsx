import React from 'react';
import {registerRoot, Composition} from 'remotion';
import {Episode1} from './episode1.jsx';

const Root = () => (
  <Composition
    id="Episode1"
    component={Episode1}
    durationInFrames={18000}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{publicationEnabled:false}}
  />
);

registerRoot(Root);
