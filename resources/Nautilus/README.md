# Nautilus System (New Wave Systems, Inc.)

Read-only reference material from the **Nautilus System** — a family of hull-design programs
by **New Wave Systems, Inc.** (Jamestown, Rhode Island), authored by **Stephen M. Hollister**.

Website: https://www.newavesys.com/

Do not edit the files here; treat them as archived primary sources. Cite by relative path
when referencing.

## Why this is in the repo

The wiki page [wiki/research/nautilus-system.md](../../wiki/research/nautilus-system.md)
treats Nautilus as a first-class reference alongside BearBoatSP/BearBoatXL. ProSurf, ProBasic,
and ProChine are the three flagship hull-design programs in the Nautilus family. Many
mid-size production kayak hulls of the 1990s–2000s were designed in this family of tools;
the technique vocabulary (NURB rows/columns, edit-points-on-the-surface, Move%, K-curves,
Gaussian curvature mapping, ruling-line plate development) is the standard most modern
hull-design tools — including bArcas — must reckon with.

## Contents

| Path | What it is |
|---|---|
| `prosurf3.exe` | Original ProSurf 3 InstallShield-wrapped MSI installer (Win32, May 2001). Primary archived source. |
| `ProBasic3.exe` | Original ProBasic 3 installer (subset of ProSurf 3). |
| `ProChine3.exe` | Original ProChine 3 installer (chine-hull subset). |
| `docs/` | Plain-text conversions of the bundled Word documents — tutorials, technical articles, hull-design guides. Extracted via `7z` → `Data.Cab` → `textutil`. |

Original document filenames inside the installer were `Fxxxxx_<Name>.doc`; the `docs/`
copies drop the `Fxxxxx_` prefix.

## Key documents (in `docs/`)

| File | Subject |
|---|---|
| `Overview3.txt` | High-level program tour (views, edits, hydro calcs, plate dev). |
| `Entities3.txt` | Geometric entities: points, lines, polylines, NURB curves, NURB surfaces, surface rows/columns. |
| `HullDesign3.txt` | Round-bilge hull design + fairing example, end-to-end. |
| `NewBoat3.txt` | Creating a new boat: from-scratch wizard, offset tables, station files (SHCP, GHS, NWS, OFF), digitizing. |
| `Fairing3.txt` | Curve and surface fairing using "K-curves" (dynamic curvature overlay) and Gaussian curvature color mapping. |
| `DirtyLittleSecrets.txt` | Hollister's article: what NURB-based hull design programs can and can't do. **Read this first.** |
| `HullVary.txt` | Automatic hull variation paper — Lackenby form, "one minus prismatic", Geosim resistance breakdown, Holtrop references. |
| `DesignSpiral.txt` | Full design-spiral tutorial — concept → preliminary → detail design, with weight, resistance, stability discussions. |
| `PlateDevelopment.txt` | Plate development vs. expansion; ruling-line algorithm; finite-element flattening; Gaussian-curvature acceptance criteria. |
| `ReverseEngineering.txt`, `RevEngr1.txt` | Fitting NURB surfaces to digitized stations / scanned body plans. |
| `5axis.txt` | 5-axis CNC machining context. |
| `README.TXT` | Original Nautilus README (May 2001). Notes the bundled sample directories (`DB`, `DB\KAYAK`, `AIRFOILS`, `ARTICLES`, `TUTORIALS`). |

## What we did not commit

The installers' `Data.Cab` archives contain the program binaries (~1600 files, including the
`ProSurf3.exe` runtime, `.HLP` help files, ~30 sample `.SRF` hull files including kayak
designs `GRNLAND`, `NOKOMIS`, `NGRN199` ("North Greenland Figure 199"), `NUK`, `POLAR`,
`UNALASKA`, and the 1000+ UIUC airfoil shape files). These are large, mostly binary, and
recoverable from the `.exe` installers via:

```sh
brew install p7zip
7z x prosurf3.exe -o<tmpdir>/prosurf3
7z x <tmpdir>/prosurf3/Data.Cab -o<tmpdir>/prosurf3/files
```

The `.SRF` files are a proprietary New Wave Systems binary format; the header includes a
human-readable hull name (e.g. `"Greenland Kayak"`, `"Nokomis"`) followed by serialized
`CSurfModel` state.

## License

The Nautilus programs are commercial software (ProSurf 3 was \$395 at the time of this
snapshot; ProBasic 3 was \$195; ProChine 3 was \$95). The installer redistributables and
their bundled `.doc` tutorials are © 1987–2001 New Wave Systems, Inc., all rights reserved.
We retain these copies under fair use for **research and citation** in the wiki — we do
**not** run, redistribute, or extract program code from them.
