import sys
from pathlib import Path
from lib.vision import init_vision_client, caption_image


def main():
    image_path = sys.argv[1]
    client, model = init_vision_client()
    image_bytes = Path(image_path).read_bytes()
    caption = caption_image(client, model, image_bytes, Path(image_path).name)
    print(caption)


if __name__ == '__main__':
    main()
