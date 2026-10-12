# OpenMontage integration

Upstream: https://github.com/calesthio/OpenMontage
Pinned source commit: `9327439db69021ab4b0e2776729bf3b58fdb5a87`
License: AGPL-3.0. Review obligations before integrating upstream code into a hosted commercial product.

Installation verification: `.github/workflows/openmontage-install.yml` installs into an isolated temporary GitHub Actions runner. This does not install OpenMontage on Render or enable it in the live Content Control service.

Operating rules:
- Existing Remotion pipeline remains authoritative.
- No automatic publication, uploads, paid providers, or credentials.
- No automatic copying of OpenMontage code into the proprietary application until AGPL compliance is reviewed.
- Reuse concepts and permitted interoperable interfaces where appropriate.
- Local-only mode preferred; no desktop required for the GitHub Actions smoke test.
- Next acceptance milestone: real end-to-end original video render in a free compatible runner and verified artifact, followed by explicit integration into Content Control's production orchestration.
