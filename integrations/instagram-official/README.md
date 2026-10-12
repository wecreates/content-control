# Official Instagram read adapter

Extends Content Control using Meta's official GitHub SDK:
https://github.com/facebook/facebook-python-business-sdk
Pinned package: facebook-business 26.0.2, Graph API v26.0.

This route uses Instagram API with Facebook Login, requiring a professional
Instagram account linked to a Facebook Page, an authorized Meta app, and the
appropriate Instagram read permissions (including instagram_basic; Page
discovery/management permissions depend on the authorization flow).
It is distinct from Instagram Login's instagram_business_basic route.

Run the owner-only “Instagram official read-only integration” workflow on main
after secure authorization provisions INSTAGRAM_ACCESS_TOKEN and
INSTAGRAM_USER_ID as repository secrets. META_APP_SECRET is optional for app
secret proof. Never put these values in chat, source, URLs, or reports.
The adapter does not implement OAuth or claim authorization exists.

Push builds install and test the actual SDK without account calls. Manual
owner runs make two bounded GET requests: account identity and up to five media
metadata records. No pagination, retry loops, posting, messaging, ads, spending,
media downloads, browser cookies, or private API login. Receipt contains only
status and aggregate counts; raw provider errors and private identifiers are
excluded. Tokens are not refreshed automatically.

Existing Watch intake, capability-queue, and Money Factory evidence references
remain the routes for analysis. A successful read proves account/API access
only: it does not establish access to arbitrary reels or full audiovisual
analysis and never promotes a finding or enables publication. Missing or
rejected authorization returns BLOCKED. This is not a workaround for a rejected
Cloud Browser session.

Sources checked 2026-10-12:
- https://pypi.org/project/facebook-business/26.0.2/
- https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login
