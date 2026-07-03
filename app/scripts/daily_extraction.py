from lib.extraction import run_extraction


def main():
    """Drain the extraction queue for one invocation. Meant to be run once/day by an external scheduler (cron/systemd) — see README's "Extração diária" section."""
    while True:
        summary = run_extraction(max_batches=10)
        print(
            f"lote: {summary['messages_processed']} processadas, "
            f"{summary['activities_extracted']} atividades, "
            f"{summary['total_tokens_used']} tokens, "
            f"{summary['messages_remaining']} restantes"
        )
        if summary['errors']:
            print(f"erros: {summary['errors']}")
        if summary['messages_remaining'] == 0 or summary['messages_processed'] == 0:
            break


if __name__ == '__main__':
    main()
