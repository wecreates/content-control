import React from "react";
import {Composition,registerRoot} from "remotion";
import {CashbackTrapSnippet} from "./CashbackTrapSnippet";
const Root=()=> <Composition id="CashbackTrapSnippet" component={CashbackTrapSnippet} durationInFrames={432} fps={24} width={720} height={1280}/>;
registerRoot(Root);
