import React from "react";
import {Composition,registerRoot} from "remotion";
import {Episode2CouponBook} from "./Episode2CouponBook";
const Root=()=> <Composition id="Episode2CouponBook" component={Episode2CouponBook} durationInFrames={720} fps={24} width={720} height={1280}/>;
registerRoot(Root);
