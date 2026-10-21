import {ARTIFACT_MEDIA_TYPES} from './artifacts.mjs';

const artifactMediaTypes=new Set(ARTIFACT_MEDIA_TYPES);

// Verify proof identity in PostgreSQL; never download evidence bodies merely to
// decide whether an intake/replay can refer to them. Call inside the writer's
// transaction. Artifact immutability prevents changes after verification.
export async function assertStoredEvidence(client,hashes,missingCode='EVIDENCE_ARTIFACT_MISSING'){
 if(!Array.isArray(hashes)||!hashes.length||hashes.length>32||
  hashes.some(sha=>typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha)))throw Error('EVIDENCE_ARTIFACT_INVALID');
 const unique=[...new Set(hashes)];
 // Legacy/foreign rows are visible for an explicit media error, but unsupported
 // blobs are not hashed. No evidence body crosses into the application.
 const rows=(await client.query(`SELECT sha256,media_type,CASE WHEN media_type=ANY($2::text[])
  THEN encode(sha256(body),'hex') ELSE NULL END AS body_sha256
  FROM pod_artifacts WHERE sha256=ANY($1::text[])`,[unique,ARTIFACT_MEDIA_TYPES])).rows;
 if(rows.some(row=>!unique.includes(row.sha256)))throw Error('EVIDENCE_ARTIFACT_CORRUPT');
 if(rows.some(row=>!artifactMediaTypes.has(row.media_type)))throw Error('EVIDENCE_ARTIFACT_MEDIA_INVALID');
 if(!unique.every(sha=>rows.some(row=>row.sha256===sha)))throw Error(missingCode);
 if(rows.some(row=>row.body_sha256!==row.sha256))throw Error('EVIDENCE_ARTIFACT_CORRUPT');
}
