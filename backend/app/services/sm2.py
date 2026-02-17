from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class SM2Result:
    interval: int
    repetition: int
    ease_factor: float
    next_review: date


def compute_sm2(
    *,
    previous_interval: int,
    previous_repetition: int,
    previous_ease_factor: float,
    quality: int,
) -> SM2Result:
    if quality not in (0, 2, 3, 5):
        raise ValueError("quality must be one of 0, 2, 3, 5")

    ease_factor = max(previous_ease_factor, 1.3)

    if quality == 0:
        repetition = 0
        interval = 1
    else:
        repetition = previous_repetition + 1
        if repetition == 1:
            interval = 1
        elif repetition == 2:
            interval = 3
        else:
            if quality == 2:
                interval = max(1, int(round(previous_interval * 1.2)))
            elif quality == 3:
                interval = max(1, int(round(previous_interval * ease_factor)))
            else:
                interval = max(1, int(round(previous_interval * ease_factor * 1.3)))

    quality_map = {0: 0, 2: 3, 3: 4, 5: 5}
    q = quality_map[quality]
    ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ease_factor = max(1.3, round(ease_factor, 3))

    next_review = date.today() + timedelta(days=interval)
    return SM2Result(
        interval=interval,
        repetition=repetition,
        ease_factor=ease_factor,
        next_review=next_review,
    )
