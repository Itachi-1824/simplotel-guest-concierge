import unittest
from .signals import relevance_signal


class RelevanceTests(unittest.TestCase):
    def test_low_confidence_rejection_does_not_become_high_relevance(self):
        self.assertLess(relevance_signal("B", .2), .5)
        self.assertGreater(relevance_signal("A", .2), .5)

    def test_missing_or_invalid_signal_is_neutral(self):
        for value in (None, "invalid", float("nan"), float("inf")):
            self.assertEqual(relevance_signal("A", value), .5)
        self.assertEqual(relevance_signal("unknown", 1), .5)

    def test_signal_is_bounded(self):
        self.assertEqual(relevance_signal("A", 10), 1)
        self.assertEqual(relevance_signal("B", 10), 0)
        self.assertEqual(relevance_signal("B", -1), .5)


if __name__ == "__main__":
    unittest.main()
