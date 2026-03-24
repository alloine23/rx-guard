from dedup import compute_phash, hamming_distance


def test_phash_returns_hex_string():
    # Create a simple 10x10 white PNG image
    from PIL import Image
    from io import BytesIO
    img = Image.new("RGB", (10, 10), color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    result = compute_phash(buf.getvalue())
    assert isinstance(result, str)
    assert len(result) > 0


def test_identical_images_have_zero_distance():
    from PIL import Image
    from io import BytesIO
    img = Image.new("RGB", (100, 100), color="red")
    buf = BytesIO()
    img.save(buf, format="PNG")
    h1 = compute_phash(buf.getvalue())
    h2 = compute_phash(buf.getvalue())
    assert hamming_distance(h1, h2) == 0


def test_different_images_have_nonzero_distance():
    from PIL import Image
    from io import BytesIO
    img1 = Image.new("RGB", (100, 100), color="red")
    buf1 = BytesIO()
    img1.save(buf1, format="PNG")

    img2 = Image.new("RGB", (100, 100), color="blue")
    buf2 = BytesIO()
    img2.save(buf2, format="PNG")

    h1 = compute_phash(buf1.getvalue())
    h2 = compute_phash(buf2.getvalue())
    assert hamming_distance(h1, h2) > 0
