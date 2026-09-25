"""Снятие метаданных с JPEG: выкидываем сегменты APP1 (EXIF), APP13 (IPTC/Photoshop),
COM (комментарий) и APP0 JFIF оставляем. Картинка при этом не перекодируется —
байты сжатых данных не трогаются, поэтому качество не меняется.

Зачем: фото из загрузок приходят с EXIF (камера, а иногда и геометка), а в репозиторий
и в сборку они не нужны. Astro/sharp метаданные в выдачу и так не переносит, но исходник
в git лучше держать чистым.

Использование: python3 strip_exif.py <файл> [<файл> ...]
"""
import sys
from pathlib import Path

KEEP = {0xE0}          # APP0 (JFIF) — оставляем
DROP = {0xE1, 0xE2, 0xED, 0xEC, 0xEE}  # APP1/APP2/APP13/APP12/APP14 — метаданные
SKIP = {0xFE}          # COM


def strip(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:2] != b"\xff\xd8":
        raise ValueError(f"{path}: не JPEG")
    out = bytearray(data[:2])
    i = 2
    dropped = 0
    while i < len(data):
        if data[i] != 0xFF:
            raise ValueError(f"{path}: сломанный маркер на {i}")
        # заполнители 0xFF в начале маркера
        while i < len(data) and data[i] == 0xFF:
            i += 1
        marker = data[i]
        i += 1
        if marker == 0xDA:  # SOS — дальше сжатые данные
            out += data[i - 2:]
            break
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            out += bytes([0xFF, marker])
            continue
        seg_len = int.from_bytes(data[i:i + 2], "big")
        seg_end = i + seg_len
        if marker in DROP or marker in SKIP:
            dropped += 1
        else:
            out += data[i - 2:seg_end]
        i = seg_end
    path.write_bytes(bytes(out))
    return dropped, len(data) - len(out)


if __name__ == "__main__":
    for name in sys.argv[1:]:
        p = Path(name)
        n, saved = strip(p)
        print(f"{p.name}: сегментов метаданных удалено {n}, минус {saved} байт")
