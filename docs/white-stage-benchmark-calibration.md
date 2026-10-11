# White-stage benchmark correction and calibration

## Scope

This is a technical pixel-style test for the V2 white-background brief. It is not a measure of humor, causality, story quality, financial accuracy, lip-sync, natural voice performance, or competitor quality. A PASS cannot create an audiovisual review or approve a handoff.

The default CLI profile remains legacy. The new profile is explicitly selected with --comparison-profile white-stage-v2. Raw metrics, raw legacy comparison, reference-frame hashes, exact candidate hash, and profile limits remain in every report. No reference asset is recolored or replaced.

## Defect and correction

The ten reference frames have cream-paper backgrounds (90th-percentile grayscale 243) while the requested candidate uses white. Counting only pixels above 245 makes identical light-stage art appear unrelated. On the initial candidate, 92.50% of distance came from this absolute white-pixel term.

For the explicit profile only, grayscale values are normalized to a 90th-percentile bright-stage background. The divisor is clamped to at least 210, so dark media cannot be whitened into acceptability. The existing three weights remain exactly 0.35 edge density, 0.35 white fraction, 0.30 brightness. The mean limit remains 0.14 and the p90 limit remains 0.21.

Normalization alone is insufficient: a blank white frame could look close under a global-average distance. New independent safeguards require:

- At least four exactly paired reference/candidate samples
- Reference background p90 at least 210, and at least 55% of pixels at luma 210 or brighter
- Candidate background p90 at least 245 in every BGR channel, channel spread at most 10, and at least 55% light pixels; cream output does not satisfy the white brief
- At least 0.5% dark foreground in every reference and candidate sample
- Mean contrast-relative foreground density and normalized edge density each between one half and twice the corresponding reference density

The factor-two content limits guard against erasing most drawing activity or replacing sparse line art with a dense fill. They are general content-retention bounds, not fitted to a desired candidate score. These global metrics can still miss semantic substitution or some spatial rearrangements; separate pixel-border, rendered-motion and full creative review are mandatory.

## Calibration independent of the candidate

Synthetic tests use a fixed stick figure, several backgrounds, erased content and different scales. A separate test file uses only the repository's original reference images. It never reads a candidate MP4.

Positive controls: unchanged reference geometry on a white light-stage background, and JPEG recompression at quality 65, pass. Negative controls: blank white, black, red background, quarter-linear-scale content and foreground erased below the top 15.625% fail. Synthetic tests also reject cream candidate output, dark references, unequal sample counts and insufficient reference coverage. They assert the distance weights/limits remain unchanged and creative_acceptance stays false.

Local validation: 14 focused parity tests, 3 reference-only calibration tests and 9 layout tests pass. The prior exact 841-frame candidate independently measures normalized mean 0.02879276699091094, p90 0.04781765720741424; raw legacy mean remains 0.34980583129084963. This result is technical style evidence only. A new safe branch workflow will validate the reconciled current renderer once concurrent caption-owner work is integrated.

## Partial creative evidence and remaining limits

Candidate 88d8bb5e19e0a68ed9e826be0462fe7f78bd0c7825783d20a77f8c4bf47116b2 received 36 exact-frame inspections (0 through 35 seconds), not continuous video watching. Full audio objective measurements were -16.7 LUFS and -1.1 dBFS true peak; audio input was unsupported, so none was heard.

A concrete mismatch was fixed in this branch: the trap's visible PANIC TAP button is now BAD IDEA, matching the spoken setup without changing placement or choreography. Captions revealing whole jokes early are being addressed by the concurrently active observed-caption work. The branded CHASE/AMEX opening versus generic budget payoff, repeated staging and sandwich callback still need actual creative review and any justified rewrite.

Two full ASR/SRT sources supported script-structure comparison only: https://www.instagram.com/reel/DcjbVcvzAXM/ (jevon_anim, delayed four-turn wordplay) and https://www.instagram.com/reel/DYcfrMyyOHd/ (lowkeyexplains, contradiction-to-mechanism-to-callback structure). Neither source video was watched or heard. Browser access did not complete; no retry or access bypass was made. These are not two completed audiovisual competitor reviews.

No creative approval has been fabricated. Publishing remains disabled and unfinished previews must stay withheld.
