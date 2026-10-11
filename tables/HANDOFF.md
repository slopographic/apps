# Slop Tables: handoff

Status: **building**. Only the engine exists (step 1 of 5). There is no UI and no `tables/index.html` yet, so keep `status: 'building'` in shared/apps.js.

## Done (step 1, engine)
The engine has no DOM and runs in both Node and the browser as ES modules. Entry point: `tables/js/engine/index.js`.
- `engine/values.js`: value model. Cells hold number, string, boolean, null or FErr. It also has the error constants (#DIV/0! #N/A #NAME? #VALUE! #REF! #NUM! #NULL! #CIRC! #SPILL! #CALC!), Excel-style text-to-number coercion and the type-ordered `compare`.
- `engine/refs.js`: A1 and R1C1 parsing and printing, `$` absolute refs, whole rows and columns, the `Ref` and `RefList` classes, and sheet-name quoting.
- `engine/lexer.js`, `engine/parser.js`: a Pratt parser.
  - Excel precedence: unary minus binds tighter than `^`, `^` is left-associative, then `%`, `& = <> < > <= >=`.
  - Array literals, union `(A1,B2)`, dynamic ranges `A1:INDEX(...)`, spill refs `A1#`, `@` and `LAMBDA(...)(x)`.
- `engine/printer.js`: turns an AST back into A1 or R1C1 text, `shiftAst` for copy/fill, `adjustForStructure` for inserting/deleting rows and columns (not yet wired into the workbook), and sheet renames.
- `engine/sheet.js`: the sparse sheet: a Map keyed by `r*16384+c`, row/col properties, merges, freeze, spill maps, and placeholder fields for CF, DV, filter, charts and print.
- `engine/workbook.js`: sheets, deduplicated styles, defined names (global or sheet-scoped), and `input()`. `input()` parses what a user types: formulas, numbers, %, currency, dates and `'text`, and sets the matching number format. Also `setValue`, `setFormula`, `clear`, `batch` and `recalc`.
- `engine/deps.js`, `engine/calc.js`: the dependency index and recalculation.
  - Dependencies are recorded while evaluating, so INDIRECT, OFFSET and names are covered.
  - The index uses tiles for ranges.
  - Only dirty cells recalculate. The evaluator uses an explicit stack (no recursion), so long chains are fine.
  - A cycle gives #CIRC!.
  - Dynamic arrays spill, and a blocked spill gives #SPILL!.
- `engine/evaluator.js`: the evaluation context. Arrays broadcast through operators, scalar functions lift over arrays, plus implicit intersection, LET/LAMBDA scopes and lazy arguments.
- `engine/datetime.js`: the 1900 date system, including the Lotus bug at serial 60, and parsing of typed dates and times.
- `fn/*.js`: 324 functions across math, stats, distributions, logic (including LET, LAMBDA, MAP, REDUCE…), text (including REGEX* and SPLIT), date and lookup. `fn/registry.js` defines `def(name, f(ctx,...args), {min,max,sc,lazy,vol,fmt,help})`.
- `fmt/parse.js`, `fmt/format.js`: Excel number format codes:
  - sections, conditions and colours;
  - grouping, scaling and %;
  - scientific, fractions, dates and elapsed times;
  - text sections and the General format;
  - locale separators and month/day names from Intl.
- Tests: `tests/tables/engine.test.html`, 11 tests, all passing (`node tests/run.mjs tables`).

## Half-done / not started
- **Function families still missing:**
  - dynamic arrays: FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, TRANSPOSE, HSTACK/VSTACK, TAKE/DROP, MMULT…; planned file `fn/array.js`.
  - financial: PMT, FV, PV, NPV, IRR, RATE, XIRR, ‑SLN/DDB…; planned `fn/financial.js`.
  - information: ISBLANK, ISNUMBER, ISERROR, N, NA, TYPE, ERROR.TYPE, SHEET…; planned `fn/info.js`.
  - engineering: BIN2DEC…, BITAND, ERF, CONVERT; planned `fn/eng.js`.
  - database: DSUM…; planned `fn/database.js`.
  - Add each new file to `fn/index.js`.
- **Format hints:** `cell.fh` is set from functions like DATE and TODAY. The UI should use `style.nf || cell.fh`.
- **Structural edits:** `printer.adjustForStructure` exists, but there is no `Workbook.insertRows/deleteRows` yet. It needs to move cell keys, row/col properties and merges, then call `calc.dirtyAll()`.

## Next steps, in order
1. Write the missing function families above, with Excel-known values in the tests.
2. Build the grid UI: `tables/index.html` (copy the pdf/ head/OG/theme pattern) and the `js/grid` canvas renderer for the viewport only, then selection, editing, the formula bar, formatting, conditional formatting, data validation, sort/filter, find, comments, tabs, undo and zoom. Wire up SlopCmd, SlopHub (`?drive=`, Ctrl+S save-back) and SlopGuard.
3. Charts (SVG) and the pivot builder.
4. Import/export:
   - XLSX and ODS using `shared/office/zip.js` (readZip/writeZip; Docs owns it);
   - CSV/TSV;
   - PDF with page setup and a matching print preview.
5. UI tests, smoke tests at desktop and 390x844, templates, and the offline single-file build. The modules use plain `import`/`export` so a small bundler can rewrite them into one file.
