"""Read-only authenticated npm evidence retrieval for an equivalent source.

No canonical writes, dispatch, scan fabrication or fallback to old state reports.
The bounded run selection is not proof; every selected candidate is authenticated
again with the official run/artifact API, raw normalization and source snapshot.
"""
from pathlib import Path
import re
import subprocess
import sys
import zipfile
import zlib
sys.dont_write_bytecode = True
from import_hosted_npm_security_evidence import (GitHubAPI,WORKFLOW,LIMIT,sha,encode,unpack,verify_payload)
from npm_security_source_equivalence import assert_source_equivalent

def retrieve_verified_equivalent(checkout, expected_sha, repository, run_id, api=None):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository) or type(run_id) is not int or run_id<=0:
        raise ValueError('Invalid repository or run ID')
    root=Path(checkout).resolve()
    snapshot=assert_source_equivalent(root,expected_sha)
    if any((root/name).is_symlink() or not (root/name).is_file() for name in ('package.json','package-lock.json')):
        raise ValueError('Dependency manifests must be regular files')
    before={'source_sha':expected_sha,'manifest_sha256':{name:sha((root/name).read_bytes()) for name in ('package.json','package-lock.json')}}
    api=api or GitHubAPI(); base=f'repos/{repository}'
    run=api.get(f'{base}/actions/runs/{run_id}')
    if (run.get('id')!=run_id or run.get('status')!='completed' or run.get('conclusion')!='success'
        or run.get('head_sha')!=expected_sha or run.get('path')!=WORKFLOW
        or run.get('repository',{}).get('full_name')!=repository
        or run.get('head_repository',{}).get('full_name')!=repository
        or run.get('event') not in ('push','schedule','workflow_dispatch')
        or run.get('head_branch')!='main' or type(run.get('run_attempt')) is not int or run['run_attempt']<=0):
        raise ValueError('Run identity, source, workflow or completion is not eligible')
    attempt=run['run_attempt']
    wanted=f'runtime-security-audit-{expected_sha}-{run_id}-{attempt}'
    artifacts=[]
    for page in range(1,101):
        response=api.get(f'{base}/actions/runs/{run_id}/artifacts?per_page=100&page={page}')
        batch=response.get('artifacts')
        if not isinstance(batch,list) or any(not isinstance(x,dict) for x in batch):raise ValueError('Invalid artifact listing')
        artifacts.extend(x for x in batch if x.get('name')==wanted)
        if len(batch)<100:break
    else:raise ValueError('Artifact listing exceeded pagination limit')
    if len(artifacts)!=1:raise ValueError('Exactly one matching artifact is required')
    artifact=artifacts[0]; artifact_id=artifact.get('id')
    digest=artifact.get('digest')
    size=artifact.get('size_in_bytes')
    if type(size) is not int or size<=0 or size>LIMIT:
        raise ValueError('Artifact size is unavailable or exceeds limit')
    if (type(artifact_id) is not int or artifact_id<=0 or artifact.get('expired') is not False
        or artifact.get('workflow_run',{}).get('id')!=run_id
        or artifact.get('workflow_run',{}).get('head_sha')!=expected_sha
        or not isinstance(digest,str) or not re.fullmatch(r'sha256:[0-9a-f]{64}',digest)):
        raise ValueError('Artifact identity or server digest is unavailable')
    archive=api.get(f'{base}/actions/artifacts/{artifact_id}/zip',binary=True)
    if not isinstance(archive,bytes) or len(archive)>LIMIT or 'sha256:'+sha(archive)!=digest:raise ValueError('GitHub artifact digest mismatch')
    files=unpack(archive)
    expected={'SOURCE_SHA':expected_sha,'RUN_ID':str(run_id),'RUN_ATTEMPT':str(attempt),
              'REPOSITORY':repository,'WORKFLOW_PATH':WORKFLOW,
              'package_sha256':before['manifest_sha256']['package.json'],
              'package_lock_sha256':before['manifest_sha256']['package-lock.json']}
    report,receipt=verify_payload(files,expected)
    if assert_source_equivalent(root,expected_sha)!=snapshot:raise ValueError('Checkout changed during verification')
    return {'hosted_bundle_schema_version':1,'origin':'github_actions',
            'repository':repository,'source_sha':expected_sha,'run_id':run_id,'run_attempt':attempt,
            'artifact_id':artifact_id,'github_artifact_digest':digest,
            'manifest_sha256':before['manifest_sha256'],'report':report,
            'report_sha256':sha(encode(report)), 'receipt':receipt,
            'original_report_json':files['runtime-security-audit.json'].decode('utf-8'),
            'verification':'official_github_api_at_import_time_not_offline_signature'}


def load_live_npm_report(checkout,repository,api=None):
    """Select newest equivalent main run; never mask its failure with old PASS."""
    try:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository):
            raise ValueError('Invalid repository')
        api=api or GitHubAPI()
        listing=api.get(f'repos/{repository}/actions/workflows/runtime-security-audit.yml/runs?branch=main&per_page=10')
        runs=listing.get('workflow_runs')
        if not isinstance(runs,list) or len(runs)>10:raise ValueError('Invalid bounded run listing')
        if any(not isinstance(r,dict) or type(r.get('run_number')) is not int or r['run_number']<=0 for r in runs):
            raise ValueError('Missing workflow run ordering')
        if len({r['run_number'] for r in runs})!=len(runs):raise ValueError('Duplicate workflow run ordering')
        for run in sorted(runs,key=lambda r:r['run_number'],reverse=True):
            if not isinstance(run,dict):raise ValueError('Malformed run listing entry')
            source=run.get('head_sha');run_id=run.get('id')
            if not isinstance(source,str) or not re.fullmatch('[0-9a-f]{40}',source) or type(run_id) is not int or run_id<=0:raise ValueError('Malformed run identity')
            try:
                assert_source_equivalent(checkout,source)
            except (OSError,ValueError,TypeError,AttributeError,subprocess.SubprocessError):
                continue
            # Once an equivalent source is found, its missing/error evidence is
            # decisive. A previous PASS must not override newer failed evidence.
            bundle=retrieve_verified_equivalent(checkout,source,repository,run_id,api)
            return bundle['report']
        return {'schema_version':2,'status':'ERROR','audit_errors':['No eligible authenticated hosted evidence; migration or fresh scan required']}
    except (OSError,ValueError,TypeError,AttributeError,KeyError,EOFError,RuntimeError,NotImplementedError,zipfile.BadZipFile,zlib.error,subprocess.SubprocessError):
        return {'schema_version':2,'status':'ERROR','audit_errors':['Hosted evidence verification unavailable']}
