import pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class CharacterLockTests(unittest.TestCase):
    def test_shared_renderer_contains_locked_character_signatures(self):
        src=(ROOT/"remotion/CharacterSystem.jsx").read_text()
        self.assertIn("DaveFace",src)
        self.assertIn("MonkFace",src)
        self.assertIn("GoblinFace",src)
        self.assertIn('M-38 -82 L-76 -103 L-60 -60',src)
        self.assertIn("deadpan_point",src)
        self.assertIn("coin_scamper",src)
    def test_board_is_rendered_from_same_character_system(self):
        src=(ROOT/"remotion/CharacterBoardComposition.jsx").read_text()
        self.assertIn('from "./CharacterSystem"',src)
        self.assertIn("<Dave ",src)
        self.assertIn("<PointsMonk ",src)
        self.assertIn("<CashbackGoblin ",src)
    def test_video_clone_renderer_uses_same_character_system(self):
        src=(ROOT/"remotion/ReferenceCloneComposition.jsx").read_text()
        self.assertIn('from "./CharacterSystem"',src)
if __name__=="__main__":unittest.main()
