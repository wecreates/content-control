# V2 parity diagnosis (2026-10-11)

Candidate: 59c3ac3b7dc7edf2e768ea2fbeab7381e12e07dd90b003fc02499af168436485

Source run: https://github.com/wecreates/content-control/actions/runs/38157835426

## Verified result

The rendered candidate remains FAIL. Mean distance is 0.35522750823376226 (limit 0.14); p90 is 0.3607817486851511 (limit 0.21). No threshold, metric weight, acceptance condition, publication lock or exact audiovisual review requirement is changed.

## Why the comparison fails

All ten repository reference frames use warm paper backgrounds; the approved output brief requires white. The existing white-fraction metric counts only grayscale pixels greater than 245. Average reference white fraction is 0.01801 versus 0.95678 for the candidate. That term contributes 0.32857, or 92.50% of the total distance. Recoloring the requested white output to pass this metric would be the wrong repair.

Supplemental contrast-relative foreground statistics also identify a genuine layout gap: candidate foreground occupies 3.86% versus 7.28% in references, and the candidate bottom quarter contains no dark foreground. These statistics describe the sampled images; they do not prove entertainment value or semantic quality.

## Change

The report now shows per-metric contributions, reference hashes, explicit unchanged thresholds, and supplemental foreground occupancy/position. Diagnostics cannot override the gate. A blank frame and displaced-subject tests prevent confusing absent content or similar global coverage with successful composition.

## Validation

Seven focused Python tests pass. Running the modified script on the actual failed artifact reproduces every original comparison output exactly and exits 2. The candidate still requires an explicitly justified reference-benchmark review, composition refinement, complete audiovisual review, and two full competitor comparisons before any handoff.
