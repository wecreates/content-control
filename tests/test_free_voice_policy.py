import json
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import cartesia_sonic_generate, eleven_v3_generate, cartesia_voice_engine
from scripts.voice_provider import build_provider_plan

ROOT = Path(__file__).resolve().parents[1]

class FreeVoicePolicyTests(unittest.TestCase):
    def test_paid_http_boundaries_never_open_network(self):
        for module in (cartesia_sonic_generate, eleven_v3_generate):
            with self.subTest(module=module.__name__), patch('urllib.request.urlopen') as network:
                with self.assertRaisesRegex(RuntimeError, 'paid_voice_provider_disabled'):
                    module.request_audio('present-but-not-authorized', {}, Path('unused.wav'))
                network.assert_not_called()

    def test_paid_sdk_boundary_never_loads_sdk_or_reads_credentials(self):
        with patch('scripts.cartesia_voice_engine.os.getenv') as credentials:
            with self.assertRaisesRegex(RuntimeError, 'paid_voice_provider_disabled'):
                cartesia_voice_engine.generate({}, {}, 'unused-output')
            credentials.assert_not_called()

    def test_credentials_cannot_reenable_paid_router(self):
        lock=json.loads((ROOT/'control/voice-lock-v1.json').read_text())
        plan=build_provider_plan(lock, {'CARTESIA_API_KEY':'present','ELEVENLABS_API_KEY':'present'})
        self.assertEqual(plan['selected_provider'], 'kokoro')
        self.assertFalse(plan['paid_providers_enabled'])
        self.assertFalse(plan['primary']['ready'])
        self.assertEqual(plan['voices']['dave']['voice_id'], 'am_fenrir')
        self.assertEqual(plan['voices']['points_monk']['voice_id'], 'am_michael')
        self.assertEqual(plan['voices']['narrator']['voice_id'], 'am_adam')
        self.assertTrue(plan['voices']['cashback_goblin']['nonverbal'])

    def test_active_configs_keep_publication_and_paid_routes_disabled(self):
        for name in ('free-voice-policy.json','voice-provider-routing-v2.json','voice-lock-v1.json','voice-engine-v3.json'):
            data=json.loads((ROOT/'control'/name).read_text())
            self.assertIs(data['publication_enabled'], False)
            self.assertIs(data['paid_providers_enabled'], False)

if __name__ == '__main__': unittest.main()
