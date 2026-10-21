# KDP weekly paperback submission guard

Amazon KDP currently limits first-time submissions to two new titles per book
format each week and resets the allowance every Sunday at 00:00 UTC. The current
Content Control KDP lane supports paperback only.

`PodDB.claimPublish` therefore counts distinct KDP jobs reserved for the account
since the current Sunday UTC boundary. It refuses a third distinct paperback job
before moving it to `publishing` or writing a quota reservation. A retry of the
same job is already counted only when its reservation is in the current week or
the durable job has a provider receipt. An older unreceipted attempt is treated
as a new first submission in the current week. Other marketplaces retain the
existing rolling 24-hour attempt cap.

Source checked October 21, 2026:
[KDP — Create a Book, New title creation and submission limits](https://kdp.amazon.com/en_US/help/topic/G202172740).

This local reservation guard cannot observe titles created or submitted outside
this worker and does not prove remaining live KDP account headroom. The separate
KDP creation limit also requires authorized account-side evidence before launch.
Publication remains disabled, and live adapter/account acceptance remains open.
