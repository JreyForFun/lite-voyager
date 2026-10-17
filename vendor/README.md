# SheetJS CE

`xlsx-0.20.3.tgz` was downloaded on 2026-10-17 from the official
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz endpoint, following
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/.

SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
The lockfile also pins SHA-512 integrity. This is a reproducibility fingerprint
of the retrieved official bytes, not a separately signed publisher attestation.
License: Apache-2.0 (`package/LICENSE`, copied intact to `dist/xlsx-LICENSE`).
The tarball is a build input excluded from the VSIX; its workbook parser is
bundled into the two XLSX workers. No runtime download or external CLI is used.

Official advisories reviewed on that date:
https://cdn.sheetjs.com/advisories/CVE-2023-30533 (fixed in 0.19.3) and
https://cdn.sheetjs.com/advisories/CVE-2024-22363 (fixed in 0.20.2).
Do not substitute the outdated npm registry `xlsx` 0.18.5.
