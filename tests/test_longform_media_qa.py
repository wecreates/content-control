from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

from scripts import longform_media_qa


class LongformMediaQATests(unittest.TestCase):
    def probe(self, *, video_duration, container_duration="300.000000", **timing):
        data = {
            "streams": [
                {"codec_type": "video", "codec_name": "h264", "width": 1280, "height": 720,
                 "duration": video_duration, **timing},
                {"codec_type": "audio", "codec_name": "aac", "duration": "300.000000"},
            ],
            "format": {"duration": container_duration},
        }
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "qa.json"
            with mock.patch.object(sys, "argv", ["longform_media_qa.py", "--video", "test.mp4",
                                                 "--out", str(report)]):
                with mock.patch.object(longform_media_qa.subprocess, "check_output",
                                       return_value=json.dumps(data)):
                    with redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as result:
                        longform_media_qa.main()
            return result.exception.code, json.loads(report.read_text())

    def test_rejects_short_picture_with_long_audio_and_container(self):
        code, report = self.probe(video_duration="60.000000", duration_ts=983040, time_base="1/16384")
        self.assertEqual(code, 2)
        self.assertEqual(report["failed_checks"], ["duration_longform"])
        self.assertEqual(report["duration_seconds"], 300)
        self.assertEqual(report["picture_duration_seconds"], 60)

    def test_picture_ticks_are_used_before_rounded_stream_duration(self):
        code, report = self.probe(video_duration="300.000000", duration_ts=2999999999,
                                  time_base="1/10000000")
        self.assertEqual(code, 2)
        self.assertLess(report["picture_duration_seconds"], 300)

    def test_measured_stream_duration_is_used_when_ticks_are_unavailable(self):
        code, report = self.probe(video_duration="300.000000")
        self.assertEqual(code, 0)
        self.assertEqual(report["picture_duration_seconds"], 300)
        self.assertFalse(report["publication_enabled"])

    def test_unavailable_picture_duration_cannot_pass(self):
        code, report = self.probe(video_duration="N/A")
        self.assertEqual(code, 2)
        self.assertEqual(report["failed_checks"], ["duration_longform"])

    def test_short_container_cannot_pass_with_long_picture(self):
        code, report = self.probe(video_duration="300.000000", container_duration="299.999999")
        self.assertEqual(code, 2)
        self.assertEqual(report["failed_checks"], ["duration_longform"])
