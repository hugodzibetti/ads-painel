import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.daily_extraction import main


@patch('scripts.daily_extraction.run_extraction')
def test_main_loops_until_queue_drained(mock_run_extraction):
    """main() must keep calling run_extraction(max_batches=10) until messages_remaining hits 0."""
    mock_run_extraction.side_effect = [
        {'total_tokens_used': 100, 'activities_extracted': 2, 'messages_processed': 30, 'messages_remaining': 15, 'errors': []},
        {'total_tokens_used': 50, 'activities_extracted': 1, 'messages_processed': 15, 'messages_remaining': 0, 'errors': []},
    ]

    main()

    assert mock_run_extraction.call_count == 2
    mock_run_extraction.assert_called_with(max_batches=10)


@patch('scripts.daily_extraction.run_extraction')
def test_main_stops_when_a_batch_processes_nothing(mock_run_extraction):
    """A batch that processes 0 messages (e.g. missing API key) must stop the loop, not spin forever."""
    mock_run_extraction.return_value = {
        'total_tokens_used': 0, 'activities_extracted': 0, 'messages_processed': 0,
        'messages_remaining': 5, 'errors': ['OPENCODE_API_KEY is not set'],
    }

    main()

    assert mock_run_extraction.call_count == 1


if __name__ == '__main__':
    test_main_loops_until_queue_drained()
    print("✓ test_main_loops_until_queue_drained")

    test_main_stops_when_a_batch_processes_nothing()
    print("✓ test_main_stops_when_a_batch_processes_nothing")

    print("\nAll tests passed!")
