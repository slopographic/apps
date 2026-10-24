/* Checksum: hashes a file with the browser's Web Crypto API, on this device. Classic script.
 * SHA-1 is included only for matching older published hashes; it is not collision-resistant. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  let file = null;
  let last = { alg: null, hash: null };

  /** The hash of the chosen file, computed once per algorithm. */
  async function hashOf(alg) {
    if (last.alg === alg && last.hash) return last.hash;
    const data = await file.arrayBuffer();
    const hash = hex(await crypto.subtle.digest(alg, data));
    last = { alg, hash };
    return hash;
  }

  /** Normalises a pasted hash: no spaces, lower case, and any "sha256:" style prefix removed. */
  function clean(s) {
    return String(s || '').trim().toLowerCase().replace(/^(sha-?\d+|sha256|md5)[:\s]+/, '').replace(/\s+/g, '');
  }

  async function show() {
    const alg = $('ck-alg').value;
    $('ck-copy').disabled = true;
    if (!file) { $('ck-hash').textContent = ''; $('ck-verdict').textContent = ''; return; }
    $('ck-status').textContent = `Reading ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`;
    const hash = await hashOf(alg);
    $('ck-hash').textContent = hash;
    $('ck-copy').disabled = false;
    $('ck-status').textContent = `${alg} of ${file.name}`;
    check();
  }

  function check() {
    const want = clean($('ck-expect').value);
    const have = last.hash;
    const v = $('ck-verdict');
    v.className = 'ck-verdict';
    if (!want) { v.textContent = ''; return; }
    if (!file || !have) { v.textContent = 'Choose a file first.'; return; }
    if (!/^[0-9a-f]+$/.test(want)) { v.textContent = 'That does not look like a hash (letters a to f and digits only).'; return; }
    if (want.length !== have.length) {
      v.textContent = `Length differs: the ${$('ck-alg').value} hash is ${have.length} characters. Check the algorithm.`;
      v.classList.add('bad');
      return;
    }
    const same = want === have;
    v.textContent = same ? 'Match: the file is the one that was published.' : 'No match: the file differs from the published hash.';
    v.classList.add(same ? 'ok' : 'bad');
  }

  function choose(f) {
    file = f || null;
    last = { alg: null, hash: null };
    show();
  }

  /** The algorithm a task page's link asks for (?alg=sha256|sha384|sha512|sha1), or null. This visit only: the choice
   *  is not stored, and unknown values are ignored. */
  const ALGS = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512', sha1: 'SHA-1' };
  function presetOf(search) {
    const a = new URLSearchParams(search || '').get('alg');
    return a && Object.prototype.hasOwnProperty.call(ALGS, a.toLowerCase()) ? ALGS[a.toLowerCase()] : null;
  }
  const preset = presetOf(location.search);
  if (preset) $('ck-alg').value = preset;

  $('ck-file').addEventListener('change', (e) => choose(e.target.files[0]));
  $('ck-alg').addEventListener('change', show);
  $('ck-expect').addEventListener('input', check);
  $('ck-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(last.hash); $('ck-copy').textContent = 'Copied'; }
    catch (e) { $('ck-copy').textContent = 'Copy failed'; }
    setTimeout(() => { $('ck-copy').textContent = 'Copy hash'; }, 1500);
  });
  const drop = $('ck-drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => choose(e.dataTransfer.files[0]));

  // Exposed for the browser test.
  window.SlopChecksum = { presetOf, hashOf: (alg, f) => { file = f; last = { alg: null, hash: null }; return hashOf(alg); }, clean };
})();
