# OpenMontage local interoperability adapter

Uses unmodified upstream plugins at commit `9327439db69021ab4b0e2776729bf3b58fdb5a87` of https://github.com/calesthio/OpenMontage in a separate Python interpreter. The existing Remotion engine remains authoritative. This adapter does not install, discover or invoke any generation, cloud, upload, or publishing providers.

Reviewed interfaces:

- `tools.analysis.audio_probe.AudioProbe.execute({input_path})`: local FFprobe duration/audio/format reporting.
- `tools.video.video_stitch.VideoStitch.execute({operation: "stitch", clips, output_path, transition: "cut", auto_normalize: false})`: local FFmpeg concat of compatible clips. Incompatible clips fail instead of silently normalizing. Upstream labels this tool experimental.

The process boundary is not an operating-system network sandbox. Only the reviewed local plugins are allowlisted, credentials are not inherited, `.env` is rejected, and upstream files must match the pin. No upstream implementation is vendored here. Upstream stays unchanged with its original LICENSE and notices intact. Outputs still require Content Control QA and Android playback validation.

## Use

Clone upstream separately and checkout the exact pin. Python 3.10+, FFmpeg and FFprobe are sufficient for these two plugins; the full provider dependency bundle is not needed.

Create a JSON request such as:

```json
{"operation":"concat","clips":["/absolute/a.mp4","/absolute/b.mp4"],"output_path":"/absolute/new-output.mp4","publication_enabled":false}
```

Or `{"operation":"probe","input_path":"/absolute/a.mp4","publication_enabled":false}`.

Run `python integrations/openmontage/adapter.py --upstream /path/to/clean/OpenMontage --request request.json --receipt receipt.json`.

Run the owned synthetic-media acceptance test with `OPENMONTAGE_CHECKOUT=/path/to/clean/OpenMontage python integrations/openmontage/test_adapter.py`.

## AGPL review and deployment boundary

Upstream LICENSE is AGPL-3.0: https://github.com/calesthio/OpenMontage/blob/9327439db69021ab4b0e2776729bf3b58fdb5a87/LICENSE . The checked-out license was read, including sections 4–6 and 13. Preserve license/copyright notices when conveying source. Distribution of covered binaries carries corresponding-source obligations. Modified versions used for remote network interaction must prominently offer their corresponding source under section 13. Combining upstream with other code may affect the covered-work scope; a subprocess boundary alone is not a legal exemption.

This change only invokes the unmodified separately checked-out local tool modules for internal file processing. It does not deploy an OpenMontage network service or bundle upstream with the application. Reassess license compliance before distribution, modification, or exposing it as a hosted service. Keep the pinned source accessible and retain its original LICENSE; no source-availability claim about a future hosted integration is made here.

## Existing production pipeline gate

After the final render (and again after any repair render), call:

```bash
python integrations/openmontage/verify_render.py \
  --upstream "$RUNNER_TEMP/OpenMontage" \
  --video "$CANDIDATE_VIDEO" \
  --expected-duration "$EXPECTED_DURATION" \
  --receipt "$JOB_STATE/openmontage-probe.json"
```

Use duration from the active CCSD after audio retiming, not a hardcoded original target. The helper verifies the candidate hash before and after probing, binds the upstream receipt to that hash, and checks duration and audio stream presence. It exits nonzero on failure. Persist this receipt with the job artifacts. It supplements, rather than replaces, actual sound, synchronization, video-codec, frame and creative QA. The pipeline must explicitly provide a clean pinned checkout; it never silently downloads dependencies or falls back to an unrelated probe implementation.
