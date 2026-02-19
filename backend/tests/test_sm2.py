from app.services.sm2 import compute_sm2


def test_sm2_again_resets_repetition() -> None:
    result = compute_sm2(
        previous_interval=6,
        previous_repetition=3,
        previous_ease_factor=2.5,
        quality=0,
    )
    assert result.repetition == 0
    assert result.interval == 1


def test_sm2_good_increases_interval() -> None:
    result = compute_sm2(
        previous_interval=6,
        previous_repetition=3,
        previous_ease_factor=2.5,
        quality=3,
    )
    assert result.repetition == 4
    assert result.interval >= 10
