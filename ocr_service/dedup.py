import imagehash
from PIL import Image
from io import BytesIO


def compute_phash(image_bytes: bytes, hash_size: int = 8) -> str:
    """Compute perceptual hash of an image. Returns hex string (16 chars for hash_size=8)."""
    img = Image.open(BytesIO(image_bytes))
    return str(imagehash.phash(img, hash_size=hash_size))


def compute_crop_resistant_hash(image_bytes: bytes) -> str:
    """Compute crop-resistant hash. Robust against screenshots and edge trimming."""
    img = Image.open(BytesIO(image_bytes))
    return str(imagehash.crop_resistant_hash(img, min_segment_size=500, segmentation_image_size=1000))


def hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two hex hash strings."""
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return h1 - h2
