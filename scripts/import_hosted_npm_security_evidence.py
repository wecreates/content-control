"""Explicit hosted evidence promotion. CLI always retrieves GitHub API evidence.

No offline JSON import mode. Does not dispatch, commit, push, install or deploy.
Requires an already authenticated gh CLI when invoked. Offline consumer checks
integrity under the trusted local promotion boundary, not a GitHub signature.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import zipfile
sys.dont_write_bytecode = True
from normalize_npm_security_audit import normalize, security_report_is_clean
from refresh_npm_security_evidence import identity

WORKFLOW = '.github/workflows/runtime-security-audit.yml'
CANONICAL = ('state/runtime-security-audit.json', 'state/runtime-security-audit-hosted.json')
# Source-verified outputs of the three earlier watchdog validator steps.
# These may be dirty locally, but never justify changed committed source.
GENERATED_WATCHDOG = ('state/deployment-health.json', 'state/workflow-control-health.json',
                      'state/system-wiring-health.json')
MEMBERS = {'npm-audit.json', 'npm-audit-exit', 'runtime-security-audit.json', 'provenance.json'}
LIMIT = 16 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'))+'\n').encode()


class GitHubAPI:
    """Only official API routes are constructed here; never accept supplied URLs."""
    def get(self, route, binary=False):
        result = subprocess.run(['gh', 'api', '--hostname', 'github.com', route],
                                capture_output=True, timeout=120)
        if result.returncode or len(result.stdout) > LIMIT:
            raise ValueError('Official GitHub API retrieval failed or exceeded size limit')
        return result.stdout if binary else json.loads(result.stdout)


def unpack(archive):
    if len(archive)>LIMIT:
        raise ValueError('Artifact exceeds size limit')
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        infos=zipped.infolist()
        if len(infos)!=len(MEMBERS) or {x.filename for x in infos}!=MEMBERS:
            raise ValueError('Artifact members are missing, duplicated or unexpected')
        if sum(x.file_size for x in infos)>LIMIT:
            raise ValueError('Expanded artifact exceeds size limit')
        for item in infos:
            if item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('Encrypted or linked artifact member')
        return {name:zipped.read(name) for name in MEMBERS}


def verify_payload(files, expected):
    receipt=json.loads(files['provenance.json'])
    if not isinstance(receipt,dict) or receipt.get('receipt_schema_version')!=1 or receipt.get('origin')!='github_actions':
        raise ValueError('Unsupported hosted receipt')
    for key,value in expected.items():
        if receipt.get(key)!=value:
            raise ValueError('Hosted receipt identity or manifest mismatch')
    if receipt.get('report_sha256')!=sha(files['runtime-security-audit.json']):
        raise ValueError('Report digest mismatch')
    raw=json.loads(files['npm-audit.json'])
    code=int(files['npm-audit-exit'].decode().strip())
    report=json.loads(files['runtime-security-audit.json'])
    if report!=normalize(raw,code) or not security_report_is_clean(report):
        raise ValueError('Hosted scan is not a consistent PASS')
    return report,receipt


def retrieve_verified(checkout, expected_sha, repository, run_id, api=None):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository) or type(run_id) is not int or run_id<=0:
        raise ValueError('Invalid repository or run ID')
    root=Path(checkout).resolve(); before=identity(root,subprocess.run)
    if before['source_sha']!=expected_sha:
        raise ValueError('Target checkout does not match requested source')
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
        if not isinstance(batch,list):raise ValueError('Invalid artifact listing')
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
    if 'sha256:'+sha(archive)!=digest:raise ValueError('GitHub artifact digest mismatch')
    files=unpack(archive)
    expected={'SOURCE_SHA':expected_sha,'RUN_ID':str(run_id),'RUN_ATTEMPT':str(attempt),
              'REPOSITORY':repository,'WORKFLOW_PATH':WORKFLOW,
              'package_sha256':before['manifest_sha256']['package.json'],
              'package_lock_sha256':before['manifest_sha256']['package-lock.json']}
    report,receipt=verify_payload(files,expected)
    if identity(root,subprocess.run)!=before:raise ValueError('Checkout changed during verification')
    return {'hosted_bundle_schema_version':1,'origin':'github_actions',
            'repository':repository,'source_sha':expected_sha,'run_id':run_id,'run_attempt':attempt,
            'artifact_id':artifact_id,'github_artifact_digest':digest,
            'manifest_sha256':before['manifest_sha256'],'report':report,
            'report_sha256':sha(encode(report)), 'receipt':receipt,
            'original_report_json':files['runtime-security-audit.json'].decode('utf-8'),
            'verification':'official_github_api_at_import_time_not_offline_signature'}


def promote(root,bundle,runner=subprocess.run):
    # Two replacements are fail-closed: consumer requires the pair to match.
    root=Path(root).resolve()
    current=identity(root,runner)
    if current['source_sha']!=bundle.get('source_sha') or current['manifest_sha256']!=bundle.get('manifest_sha256'):
        raise ValueError('Target changed before canonical promotion')
    if bundle.get('origin')!='github_actions' or not security_report_is_clean(bundle.get('report')):
        raise ValueError('Only verified clean hosted evidence may be promoted')
    state=root/'state'
    if state.is_symlink() or (state.exists() and not state.is_dir()):raise ValueError('Unsafe canonical state directory')
    for relative in CANONICAL:
        target=root/relative
        if target.is_symlink() or (target.exists() and not target.is_file()):raise ValueError('Unsafe canonical file')
    state.mkdir(exist_ok=True)
    for relative,value in zip(CANONICAL,(bundle['report'],bundle)):
        temporary=None
        try:
            with tempfile.NamedTemporaryFile(dir=state,delete=False) as stream:
                temporary=Path(stream.name);stream.write(encode(value));stream.flush();os.fsync(stream.fileno())
            os.replace(temporary,root/relative)
        finally:
            if temporary is not None:temporary.unlink(missing_ok=True)


def load_hosted_report(checkout, repository, runner=subprocess.run):
    """Offline integrity gate for evidence written by the trusted import command.

    Not standalone proof of GitHub authenticity. Re-run the importer to establish
    server authenticity again. Only evidence-only descendants of source qualify.
    """
    try:
        root=Path(checkout).resolve()
        top=runner(['git','rev-parse','--show-toplevel'],cwd=root,capture_output=True,text=True,timeout=30)
        if top.returncode or Path(top.stdout.strip()).resolve()!=root:raise ValueError('Not repository root')
        if (root/'state').is_symlink():raise ValueError('Unsafe canonical state directory')
        for relative in (*CANONICAL,'package.json','package-lock.json'):
            path=root/relative
            if path.is_symlink() or not path.is_file():raise ValueError('Evidence and manifests must be regular files')
        report=json.loads((root/CANONICAL[0]).read_text()); bundle=json.loads((root/CANONICAL[1]).read_text())
        if bundle.get('hosted_bundle_schema_version')!=1 or bundle.get('origin')!='github_actions' or bundle.get('repository')!=repository:
            raise ValueError('Not matching hosted evidence')
        if any(type(bundle.get(key)) is not int or bundle[key]<=0 for key in ('run_id','run_attempt','artifact_id')):
            raise ValueError('Invalid hosted run or artifact identity')
        if not isinstance(bundle.get('github_artifact_digest'),str) or not re.fullmatch(r'sha256:[0-9a-f]{64}',bundle['github_artifact_digest']):
            raise ValueError('Missing hosted artifact digest')
        if bundle.get('verification')!='official_github_api_at_import_time_not_offline_signature':
            raise ValueError('Unrecognized import provenance')
        source=bundle.get('source_sha')
        if not isinstance(source,str) or not re.fullmatch('[0-9a-f]{40}',source):raise ValueError('Invalid source')
        if bundle.get('report')!=report or bundle.get('report_sha256')!=sha(encode(report)) or not security_report_is_clean(report):
            raise ValueError('Invalid canonical report pair')
        receipt=bundle.get('receipt')
        if not isinstance(receipt,dict) or receipt.get('origin')!='github_actions' or receipt.get('receipt_schema_version')!=1:
            raise ValueError('Invalid hosted receipt')
        for field,expected in {'SOURCE_SHA':source,'REPOSITORY':repository,'WORKFLOW_PATH':WORKFLOW,
                               'RUN_ID':str(bundle.get('run_id')),'RUN_ATTEMPT':str(bundle.get('run_attempt'))}.items():
            if receipt.get(field)!=expected:raise ValueError('Canonical receipt identity mismatch')
        original=bundle.get('original_report_json')
        if not isinstance(original,str) or sha(original.encode())!=receipt.get('report_sha256') or json.loads(original)!=report:
            raise ValueError('Canonical receipt report mismatch')
        hashes=bundle.get('manifest_sha256',{})
        if receipt.get('package_sha256')!=hashes.get('package.json') or receipt.get('package_lock_sha256')!=hashes.get('package-lock.json'):
            raise ValueError('Canonical receipt manifest mismatch')
        for name in ('package.json','package-lock.json'):
            if sha((root/name).read_bytes())!=bundle.get('manifest_sha256',{}).get(name):raise ValueError('Manifest mismatch')
        def git(*args):
            result=runner(['git',*args],cwd=root,capture_output=True,text=True,timeout=30)
            if result.returncode:raise ValueError('Cannot verify source ancestry')
            return result.stdout
        git('merge-base','--is-ancestor',source,'HEAD')
        committed=git('diff','--name-only',source,'HEAD','--').splitlines()
        if any(path not in CANONICAL for path in committed):raise ValueError('Committed source changed since audit')
        dirty=git('diff','--name-only','HEAD','--').splitlines()
        allowed_dirty=(*CANONICAL,*GENERATED_WATCHDOG)
        if any(path not in allowed_dirty for path in dirty):raise ValueError('Executable source changed locally')
        untracked=git('ls-files','--others','--exclude-standard').splitlines()
        if any(path not in allowed_dirty for path in untracked):raise ValueError('Untracked source is not audited')
        return report
    except (OSError,ValueError,TypeError,AttributeError,subprocess.SubprocessError):
        return {'schema_version':2,'status':'ERROR','audit_errors':['Missing, stale or mismatched hosted evidence']}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout',required=True);parser.add_argument('--expected-sha',required=True)
    parser.add_argument('--repository',required=True);parser.add_argument('--run-id',required=True,type=int)
    parser.add_argument('--promote',required=True,action='store_true',help='Explicitly replace local canonical report and hosted receipt; never commits or pushes')
    args=parser.parse_args()
    try:
        bundle=retrieve_verified(args.checkout,args.expected_sha,args.repository,args.run_id)
        promote(args.checkout,bundle)
    except (OSError,ValueError,TypeError,AttributeError,zipfile.BadZipFile,subprocess.SubprocessError):
        parser.exit(2,'Hosted evidence verification failed; no successful promotion claimed.\n')
    print('Verified GitHub audit evidence promoted locally. No Git commit, push or deployment performed.')


if __name__=='__main__':main()
