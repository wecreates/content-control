const SHA256=/^[a-f0-9]{64}$/;

export function buildPreviewIdentity(config,acceptance){
  const expected=acceptance?.expected??null;
  const actual=acceptance?.actual??null;
  const captionSha256=acceptance?.captionHash??null;
  const captionCandidateSha256=acceptance?.captionCandidateSha256??null;
  const checks={
    candidate_sha256_valid:SHA256.test(expected||""),
    candidate_bytes_exact:SHA256.test(actual||"")&&actual===expected,
    caption_sha256_valid:SHA256.test(captionSha256||""),
    caption_candidate_exact:captionCandidateSha256===expected,
    video_gate_ready:acceptance?.videoReady===true,
    caption_gate_ready:acceptance?.captionReady===true,
    publication_locked:acceptance?.publicationLocked===true
  };
  const failedChecks=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
  const identityConsistent=failedChecks.length===0;
  const ready=acceptance?.ready===true&&identityConsistent;
  const query=ready?`sha256=${expected}&caption_sha256=${captionSha256}`:null;
  return {
    id:config.id,
    engine:config.engine,
    evidencePresent:acceptance?.evidencePresent===true,
    ready,
    identityConsistent,
    failedChecks,
    expected,
    actual,
    captionSha256,
    captionCandidateSha256,
    qaStatus:acceptance?.qaStatus||"missing",
    watchPath:config.watchPath,
    watchUrl:ready?`${config.watchPath}?${query}`:null,
    mediaUrl:ready?`${config.mediaPath}?sha256=${expected}`:null,
    captionsUrl:ready?`${config.captionsPath}?sha256=${captionSha256}`:null
  };
}

// A newer preview with any retained evidence owns readiness even when it is
// incomplete or corrupt. Falling back to an older green preview would hide the
// broken candidate and make readiness point at a different player identity.
export function selectCurrentPreview(previews){
  return previews.find(preview=>preview.evidencePresent)??previews.at(-1)??null;
}

export function previewRequestMatches(query,candidateSha256,captionSha256){
  const requestedCandidate=query?.sha256;
  const requestedCaption=query?.caption_sha256;
  const identityRequested=requestedCandidate!==undefined||requestedCaption!==undefined;
  return !identityRequested||(requestedCandidate===candidateSha256&&requestedCaption===captionSha256);
}
