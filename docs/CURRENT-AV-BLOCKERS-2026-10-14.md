# Current audiovisual blockers — 2026-10-14

Publication remains disabled. This change does not certify creative quality.

## Confirmed and repaired

The exact-review source selector rejected caption-repair run 38574413400 even though both jobs succeeded and its downloaded candidate hashes were independently verified. It now accepts only that specific run, source commit dcb4775fe1891df8d8bcaab477bcb919e6771b50, same repository, successful PR workflow, and Short/Long artifact names. Preparation checks the downloaded media against the known SHA-256 before creating review material. Other PR artifacts remain rejected. No rendering is required.

The mobile comparison workspace exported filenames and sizes without verified identity. Local SHA-256 hashing now runs in a worker; exports require both hashes. Changing files invalidates prior identity and findings. No media is uploaded. Large files may exceed a phone's memory: verification failure blocks export and directs the reviewer to a desktop browser. This is not physical Android acceptance.

Invalid or absent video duration could also pass the timestamp finding validator; it now rejects non-finite and non-positive durations.

## Verification

31 Node tests passed (comparison, exact review, creative handoff); 3 offline review package tests passed. Exact review preparation against the retained repaired Short and Long yielded REVIEW_REQUIRED with the expected hashes, never approval:

- Short: 3cdb6a504fb72ee12cfe9fc451b68a16c1fb7adc978ae1f94836a540082e31fe
- Long: 9ff0d9c74843f246307dabb82f19f61962369cf8aa2603c0b9bc1c0d803beeb1

## Unfinished evidence

- Full independent audiovisual review, including actual listening, motion, pacing, character consistency and synchronization, remains unverified. Technical checks and sampled frame inspections are separate evidence.
- Two distinct competitor videos with audio have not been supplied/reviewed end to end. Existing still frames cannot complete this requirement.
- Physical Android playback acceptance remains unverified. Browser unit tests do not establish device acceptance.
- Google AI Studio's attachment failure root cause remains unknown. Accepted upload and INACCESSIBLE results do not establish model access; unrelated generated descriptions remain invalid evidence.
- Latest recorded V2 production run 38575931175 is a different candidate (0547e5b26b0020b68f322d0c6827ccf4b6a2e7f7ef62f712f799fa95084cac81). Its stale-hash visual review block must not be cleared by borrowing a Short/Long review. It needs its own exact-media assessment.

Use the free local review package and comparison workspace for actual inspection, record attributable observations, and validate each review against its exact media. Do not substitute a fabricated receipt to clear any remaining blocker.
