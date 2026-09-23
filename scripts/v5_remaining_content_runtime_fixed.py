#!/usr/bin/env python3
from v5_remaining_content_runtime import RANGES, main

# Bind the six unfinished content domains to their actual V5 task-ID ranges.
# This wrapper exists so the runtime can proceed without mutating the historical
# executor while retaining a deterministic, reviewable correction.
RANGES.update({
    'orchestration': (1, 20),
    'render': (41, 60),
    'caption': (81, 100),
    'research': (101, 120),
    'story': (121, 140),
    'repair': (161, 180),
})

if __name__ == '__main__':
    main()
