# Audiovisual blocker progress — 2026-10-14

Publication and creative approval remain disabled.

## Confirmed fixes

- Exact review now recognizes verified visual-repair run 38583366384, source b8f22d0be0cd0e2196a892eea07a904898dc43eb. This resolves the selector retaining only the superseded caption-only repair. Original caption-only evidence remains addressable. Each run remains pinned to its workflow, commit, successful same-repository execution, artifact and candidate SHA-256.
- Comparison hashing now reads at most 1 MiB per slice in its worker, replacing the full-file memory allocation. Vendored MIT @noble/hashes 2.0.1 computes SHA-256 without outbound requests. Chunk-boundary and incomplete-read regressions pass; both actual latest MP4 hashes match.
- Browser transport CI covers a 360x800 viewport, local video input, hashing, playback advancement, audio mute routing, timestamp notes, overflow and export. This is a synthetic fixture test, not physical Android or creative acceptance.

## Actual media checked this session

Latest repair archives were downloaded and matched against GitHub ZIP digests with passing CRCs. An initially truncated Short transfer was rejected and successfully retrieved again.

Short candidate: 46a6989bc7a5f3e0c35c552d2a8c635d1c0fadf369c6252d1c66945b452ee17a
Long candidate: 41a479dda53d9b926b299e3769493b9082d450e71c4e1e65e12bf9732d649766

These are PR44's encoded title-clearance/end-card/caption fixes, not PR46's older caption-only render. Prior encoded-frame inspection and technical QA are recorded in PR44; this session does not falsely repeat that as full listening.

## Free reviewer and reference access investigation

The source of https://huggingface.co/spaces/Qwen/Qwen3-Omni-Demo was inspected. Its format_history uploads input media to object storage and generates public URLs. Unpublished candidates were not submitted. This endpoint was not accepted as a private review solution. No paid calls were made.

Public retrieval of the existing authorized benchmark https://www.youtube.com/watch?v=1OFJM4STSpI returned metadata (57 seconds), but actual video/audio transfers returned 195-byte HTML Site Unavailable responses, rejected by FFmpeg. No full competitor review is claimed. No login or access-control workaround was attempted.

Local Playwright browser installation returned truncated archives. Browser execution is delegated to the existing free GitHub CI environment, as previous Remotion rendering was; successful execution must be checked separately.

## Remaining acceptance boundaries

Full actual audiovisual semantic/listening assessment, two complete competitor audiovisual comparisons, and physical Android playback are not established by these code fixes. Google's earlier INACCESSIBLE backend cause remains unknown without provider processing/error evidence. Full review cannot be cleared by changing flags or borrowing another candidate's review. The offline inspection package remains free and local, but requires an actual reviewer.
