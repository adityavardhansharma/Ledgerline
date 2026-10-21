from ledgerline_engine.signing import sign, verify


def test_valid_signature():
    sig = sign("s3cret", 1000, "post", "/forecast/run", b'{"a":1}')
    assert verify("s3cret", "1000", sig, "POST", "/forecast/run", b'{"a":1}', now=1010)


def test_tampered_body_rejected():
    sig = sign("s3cret", 1000, "POST", "/forecast/run", b'{"a":1}')
    assert not verify("s3cret", "1000", sig, "POST", "/forecast/run", b'{"a":2}', now=1010)


def test_replay_outside_window_rejected():
    sig = sign("s3cret", 1000, "POST", "/x", b"")
    assert not verify("s3cret", "1000", sig, "POST", "/x", b"", window_seconds=300, now=1400)


def test_missing_headers_rejected():
    assert not verify("s3cret", None, None, "POST", "/x", b"")
    assert not verify("", "1000", "abc", "POST", "/x", b"", now=1000)
