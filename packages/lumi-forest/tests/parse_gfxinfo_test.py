"""Small fixture test of the Android framestats parser. No device required."""
import importlib.util
from pathlib import Path
import unittest

p = Path(__file__).resolve().parents[1] / 'tools/device/parse-gfxinfo.py'
spec = importlib.util.spec_from_file_location('gfxparser', p)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class GfxParserTest(unittest.TestCase):
    def test_sample(self):
        row = 'Flags,IntendedVsync,FrameCompleted\n0,1000000000,1010000000\n0,1020000000,1040000000\n1,1050000000,1080000000\n'
        result = module.parse('header\n---PROFILEDATA---\n' + row + '---PROFILEDATA---\n', 60)
        self.assertEqual(result['samples'], 2)
        self.assertEqual(result['framesExceedingRefreshBudgetPercent'], 50.0)

    def test_missing(self):
        with self.assertRaises(ValueError):
            module.parse('no profile', 60)

if __name__ == '__main__':
    unittest.main()
