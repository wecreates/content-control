"""Verify observed words from the actual encoded video, without granting approval."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
try:
    from scripts.caption_contract import snapshot, object_from, sha, spoken, assert_destination, write_atomic
    from scripts.review_smoke_inputs import observed_hash
except ModuleNotFoundError:
    from caption_contract import snapshot, object_from, sha, spoken, assert_destination, write_atomic
    from review_smoke_inputs import observed_hash

REQUIRED = ('transcript_nonempty', 'sequence_similarity_ok', 'content_token_recall_ok',
            'semantic_recall_ok', 'duration_plausible', 'transcript_coverage_ok',
            'no_post_narration_hallucination', 'publication_disabled')


def verify(video, contract_path, transcription_path):
    report = {'schema_version': 1, 'generated_at': datetime.now(timezone.utc).isoformat(),
              'status': 'FAIL', 'publication_enabled': False,
              'production_approved': False, 'scope': 'Exact spoken words in encoded candidate; not voice quality, creative approval, or caption timing',
              'checks': {}, 'failed_checks': []}
    try:
        candidate = observed_hash(Path(video), 512 * 1024 * 1024)
        contract_bytes = snapshot(contract_path)
        transcript_bytes = snapshot(transcription_path)
        contract, transcript = object_from(contract_bytes), object_from(transcript_bytes)
        checks = {
            'publication_disabled': contract.get('publication_enabled') is False and transcript.get('publication_enabled') is False,
            'candidate_identity_bound': transcript.get('audio_sha256') == candidate,
            'observed_transcription_pass': transcript.get('status') == 'PASS' and transcript.get('engine') == 'faster-whisper',
            'transcription_checks_pass': isinstance(transcript.get('checks'), dict) and all(transcript['checks'].get(k) is True for k in REQUIRED),
            'approved_script_bound': spoken(transcript.get('expected_text')) == spoken(contract.get('narration_text')),
            'exact_spoken_words_match': spoken(transcript.get('actual_transcript')) == spoken(contract.get('narration_text')),
        }
        report.update(candidate_sha256=candidate, contract_sha256=sha(contract_bytes),
                      transcription_receipt_sha256=sha(transcript_bytes), checks=checks,
                      failed_checks=[k for k, ok in checks.items() if not ok])
        if all(checks.values()):
            report['status'] = 'PASS'
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        report['failed_checks'] = ['valid_current_inputs']
        report['reason'] = str(exc)
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--video', required=True)
    p.add_argument('--contract', required=True)
    p.add_argument('--transcription', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    assert_destination(a.output, [a.video, a.contract, a.transcription])
    report = verify(a.video, a.contract, a.transcription)
    write_atomic(a.output, json.dumps(report, indent=2, sort_keys=True) + '\n')
    print(json.dumps(report, sort_keys=True))
    return 0 if report['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
