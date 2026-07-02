from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.cost import calculate_cost, INPUT_PRICE_PER_1M, OUTPUT_PRICE_PER_1M


def test_calculate_cost_zero_tokens():
    assert calculate_cost(0, 0) == 0.0


def test_calculate_cost_input_only():
    cost = calculate_cost(1_000_000, 0)
    assert cost == INPUT_PRICE_PER_1M


def test_calculate_cost_output_only():
    cost = calculate_cost(0, 1_000_000)
    assert cost == OUTPUT_PRICE_PER_1M


def test_calculate_cost_mixed():
    cost = calculate_cost(500_000, 250_000)
    expected = 0.5 * INPUT_PRICE_PER_1M + 0.25 * OUTPUT_PRICE_PER_1M
    assert abs(cost - expected) < 1e-9


if __name__ == '__main__':
    test_calculate_cost_zero_tokens()
    print("✓ test_calculate_cost_zero_tokens")

    test_calculate_cost_input_only()
    print("✓ test_calculate_cost_input_only")

    test_calculate_cost_output_only()
    print("✓ test_calculate_cost_output_only")

    test_calculate_cost_mixed()
    print("✓ test_calculate_cost_mixed")

    print("\nAll tests passed!")
