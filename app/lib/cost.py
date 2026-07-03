# Pricing for OpenCode Zen's deepseek-v4-flash (the model this repo is pinned to
# — see CLAUDE.md), current as of https://opencode.ai/docs/zen/. Update these if
# OPENCODE_MODEL ever changes.
INPUT_PRICE_PER_1M = 0.14
OUTPUT_PRICE_PER_1M = 0.28


def calculate_cost(prompt_tokens, completion_tokens):
    """Estimated USD cost for a given token count, in dollars (not cents)."""
    return (
        (prompt_tokens / 1_000_000) * INPUT_PRICE_PER_1M
        + (completion_tokens / 1_000_000) * OUTPUT_PRICE_PER_1M
    )
