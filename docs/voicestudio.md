# Optional free VoiceStudio narration

Existing Kokoro defaults and historical accepted takes remain unchanged. This adds an explicit VoiceStudio/Kitten path to the V2 execution voice stage and assembler, with pinned model identity and source/receipt hashes. It does not enable paid inference, publishing, voice cloning, or automatic creative approval. Dialogue is spoken exactly as supplied; no extra spoken sentence is inserted.

## Setup and use

Use Money Factory's existing `integrations/voicestudio/setup_runtime.py` to install its pinned runtime and `integrations/vendor/voicestudio` submodule. Setup requires internet downloads; generation runs offline on CPU. The runtime must be accessible on the same host as Content Control. No API key is needed.

Create a local JSON config with absolute `money_factory` and `runtime` paths. Run:

```
python scripts/v2_execution.py --ccsd /path/ccsd.json --workdir /new/job-directory --voicestudio-config /path/voicestudio.json
```

For just voice generation and assembly:

```
python scripts/v2_voicestudio.py --ccsd /path/ccsd.json --out-dir /new/clips --money-factory /path/Money-factory --runtime /path/runtime
python scripts/v2_audio_assemble.py --ccsd /path/ccsd.json --manifest /new/clips/approved-manifest.json --out /new/voice.wav --receipt /new/assembly.json
```

The stock voice mapping for this optional path is narrator=Jasper (`expr-voice-2-m`), Dave=Bruno (`expr-voice-3-m`), points monk=Hugo (`expr-voice-4-m`). Cashback goblin remains nonverbal. These are declared preset choices, not listening-approved replacements for accepted character voices. A CCSD that explicitly declares incompatible prior voice assignments is rejected by the existing continuity check; do not silently rewrite it.

The native 24 kHz mono PCM16 output is retained, then converted to 44.1 kHz stereo PCM16 for assembly. Maximum 1,200 characters per dialogue; one timed dialogue per scene. If speech exceeds its window, generation fails rather than truncating. Existing output directories are refused to protect accepted media. Successful stages can resume; if a voice stage needs regeneration after changed input/code or damaged output, use a fresh workdir. Pre-change Kokoro continuity baselines lack `selected_voice_policy`; resuming those old workdirs now fails closed at the memory stage. Start an explicit fresh baseline/workdir after reviewing the provider and voice assignments. No baseline is silently reset or migrated. The manifest filename is a legacy interface name, not creative approval.

## Verified scope, 2026-11-07

A fresh pinned VoiceStudio backend run synthesized the sale script with Jasper. The final native narration and converted clip last 15.833333 seconds. The Content Control assembler accepted the exact converted clip and produced a 30-second stereo timeline, with narration from 0 through 15.833333 seconds. This is real synthesis and audio-stage handoff, not a full video render or live-host deployment. Transcription and subjective listening are separate checks.

Upstream VoiceStudio revision: `4df5033e5a1a92e22936fb4d7d2d39e03cf10a91`.
Kitten model revision: `c02725660cea441db4c383af69f1f26f5cd00947`.
Converted clip SHA-256: `e4675a049e853677ab8fd5c2526f78771cd66c7bf91aa29d5491bd198cf10cd9`.
Assembled timeline SHA-256: `c7392f101393e09bf8d26a4ac770180ff6d2573747bcfcbe221a65dd959314a2`.

## Licensing and review

VoiceStudio application code is AGPL-3.0-only; the Kitten SDK is MIT. The selected model card declares Apache-2.0. The upstream VoiceStudio registry still labels complete component/output rights review incomplete; this work does not certify blanket commercial output rights. The default OmniVoice model is not used. No spoken disclosure requirement was identified in these selected licenses. Attribution/source obligations for software distribution or modified network service still apply. The existing optional watermark hook remains intact and recorded `watermark_applied: false` because AudioSeal was unavailable. Provenance metadata is not an embedded watermark or authenticated proof of generation.
