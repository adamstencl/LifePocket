# Dobrovolné příspěvky (QR platba)

Appka je zdarma. V Nastavení se může zobrazit sekce **☕ Podpořit LifePocket** s českou QR platbou
(formát SPAYD, který umí naskenovat všechny české bankovní aplikace). Appka platby nezpracovává,
QR kód jen předá bankovní aplikaci číslo účtu, částku a zprávu.

Sekce se řídí souborem [`support.json`](../support.json) v kořeni repa. Dokud v něm není
`"enabled": true` a platný český IBAN, sekce se **nezobrazí** (výchozí stav).

## Co vyplnit

```json
{"enabled": true, "iban": "CZ6508000000192000145399", "accountName": "Jan Novak", "message": "LifePocket", "amounts": [50, 100, 200]}
```

| Pole | Co tam patří |
|---|---|
| `enabled` | `true` = sekce se zobrazí, `false` = skrytá. |
| `iban` | Číslo účtu ve tvaru **IBAN**: `CZ` + 22 číslic (mezery nevadí). IBAN najdeš v internetovém bankovnictví u účtu (bývá u „Detail účtu“ nebo „Číslo účtu / IBAN“). Appka kontroluje kontrolní číslice; při překlepu se sekce nezobrazí. |
| `accountName` | Jméno příjemce, jak se ukáže v bance (max. 35 znaků). Může zůstat prázdné. |
| `message` | Zpráva pro příjemce v platbě (max. 60 znaků). Diakritika se v QR kódu odstraní kvůli kompatibilitě bank. |
| `amounts` | Předvolené částky v Kč, celá čísla (1 až 6 hodnot, max. 100 000). Uživatel může zadat i vlastní částku. |

Příklad IBAN výše je ukázkový z dokumentace (neexistující platba), **použij svůj**.

Pozor na JSON: uvozovky `"` kolem textů, čárky mezi položkami, `true`/`false` bez uvozovek.
Chybu v JSON odhalí CI kontrola (záložka Actions na GitHubu) a appka sekci prostě nezobrazí.

## Jak to upravit z mobilu (web GitHubu)

1. Otevři v prohlížeči `https://github.com/adamstencl/LifePocket` a přihlas se.
2. Klepni na soubor **`support.json`** (v seznamu souborů v kořeni).
3. Vpravo nahoře klepni na **tužku** (Edit this file). Na úzkém displeji může být schovaná
   v nabídce **⋯**.
4. Přepiš obsah, např. `"enabled": true`, doplň `"iban": "CZ…"` a `"accountName": "…"`.
5. Klepni na **Commit changes…**, nech vybráno „Commit directly to the main branch“ a potvrď
   **Commit changes**.
6. Za 1–2 minuty GitHub Pages nasadí změnu. Appka soubor načítá vždy čerstvý (bez cache),
   stačí znovu otevřít Nastavení.

Vypnutí: stejným postupem nastav `"enabled": false`.

## Technicky

- Načítá se `fetch('/support.json', {cache:'no-store'})`; chyba nebo offline = sekce skrytá.
- QR kód se generuje přímo v appce (vlastní malý generátor v `app.js`), nic se neposílá ven.
- Řetězec: `SPD*1.0*ACC:{IBAN}*AM:{částka}.00*CC:CZK*MSG:{zpráva}*RN:{jméno}`; znak `*` ve
  zprávě a jménu se kóduje jako `%2A`.
- V aplikaci z Google Play (TWA) je celá podpora projektu skrytá (`html.is-twa .lp-support`).
- Změna `support.json` nevyžaduje novou verzi appky ani bump `CACHE`.
