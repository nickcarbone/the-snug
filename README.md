# The Snug

A reader for plain text books. One HTML file, no build step, no dependencies,
no tracking, no accounts. Put it on GitHub Pages and it works.

It exists because Project Gutenberg's `.txt` files are hard-wrapped at about
62 characters, which is unreadable on a phone — you get ragged half-lines and
endless pinch-zooming. The Snug reflows the text, sets it in a real book measure,
and paginates it the way a Kindle does.

---

## Install

1. Create a repo (or use an existing Pages repo).
2. Drop `index.html` in at the path you want — root, or a `reader/` folder.
3. Settings → Pages → deploy from your default branch.
4. Open it on your phone and add it to your home screen. It runs full-screen
   and works offline once loaded.

That's the whole install. The relay below is optional.

---

## Getting books in

Five ways, in order of how well they work:

| | How | Works offline | Needs setup |
|---|---|---|---|
| **File** | Choose or drag a `.txt` / `.epub` | yes | no |
| **Paste** | Paste any text | yes | no |
| **Search** | Search the catalogue, tap to download the EPUB, add via File | no | no |
| **Link** | Paste a book URL | no | yes — see below |
| **Import** | Load a whole reading list from a `.json` file | no | yes — see below |

**Search** uses [Gutendex](https://gutendex.com), a community JSON API for
Gutenberg's catalogue. It sends `Access-Control-Allow-Origin: *`, so searching
works with no setup. Reading the book is the part that's blocked.

Without a relay, tapping a result downloads the EPUB and you add it from the
**File** tab — two taps instead of one. The Snug asks for Gutenberg's text-only
EPUB rather than the illustrated one Gutendex advertises: for *Pride and
Prejudice* that's 558 KB instead of 24.8 MB, the same book. EPUBs also carry a
real table of contents, so chapters come from the file rather than from the
heuristics described below.

With a relay, results open straight into the reader.

---

## Shelves

A book can sit on any number of shelves. A shelf is only a label that at least
one book carries, so there is nothing to create and nothing to delete: name one
and it appears, take the last book off it and it goes.

The row of shelf names sits above the grid. Tap one to see only those books, tap
**All** to come back. Hover a book (or focus it) and the **#** button lets you
type its shelves as a comma-separated list. Your choice of shelf is remembered
between visits.

---

## Import and export

**Import** takes a `.json` file listing books and where their texts can be had,
and puts them all on a shelf at once. Nothing is downloaded at import time — a
book is fetched the first time you open it — so a fifty-book library is a few
kilobytes. Use the **Import** button above the grid, or drag the `.json` onto
the page.

Books that haven't been fetched yet show a dashed cover and a small label.
Tapping one fetches it through your relay; without a relay it downloads instead,
and you add it from the **File** tab as usual.

Re-importing the same list does not duplicate anything. A book you already have
keeps its reading position and simply joins the new shelf.

**Export** writes the current shelf back out in the same format, so a library
can be moved between devices or kept in version control.

### The file format

```json
{
  "snugLibrary": 1,
  "name": "Telegraph 50 Best",
  "books": [
    {
      "rank": 21,
      "title": "Persuasion",
      "author": "Jane Austen",
      "year": "1817",
      "tags": ["Telegraph 50 Best"],
      "kind": "epub",
      "status": "public-domain",
      "fetch":  "https://standardebooks.org/ebooks/jane-austen/persuasion/downloads/jane-austen_persuasion.epub",
      "source": "https://standardebooks.org/ebooks/jane-austen/persuasion",
      "cover":  "https://standardebooks.org/ebooks/jane-austen/persuasion/downloads/cover.jpg",
      "note":   "Anything worth knowing about this edition."
    }
  ]
}
```

Only `title` is required. `tags` falls back to `name`, and `name` falls back to
the filename. `fetch` is the file itself; `source` is the human-readable page it
came from. `rank` sets the order of books you haven't opened yet — without it
they fall in file order.

`status` is a note to the reader, and decides what tapping the book does:

| `status` | Meaning | Tapping it |
|---|---|---|
| `public-domain` | Out of copyright | Fetches and opens the text |
| `lending` | In copyright, free to borrow | Opens the library record — these can't be downloaded |
| `in-copyright` | No legitimate free copy | Opens `source` if there is one, otherwise says so |

`snug-library-telegraph-50.json` in this folder is a worked example: the 50
books in *The Daily Telegraph*'s "50 greatest books of all time" (Jake Kerridge,
9 August 2026), with a verified source for each of the 46 that have one.

### Why Link needs a relay

Gutenberg serves its text files without an `Access-Control-Allow-Origin`
header. The file is public and the request succeeds, but the browser refuses
to let JavaScript from another origin read the response. This is the browser's
same-origin policy, not a bug, and there is no client-side way around it.

The usual advice is to route through a public CORS proxy. Don't build on one —
when this was written, `api.allorigins.win` returned 522, `corsproxy.io`
returned 403, and `r.jina.ai` returned 524. Public proxies also see every book
you read.

So: run your own. `gutenberg-relay.js` is a Cloudflare Worker, about a hundred
lines, free tier, five minutes:

```bash
npm install -g wrangler
wrangler login
wrangler deploy gutenberg-relay.js --name gutenberg-relay --compatibility-date 2026-08-01
```

Then edit `ALLOWED_ORIGINS` in the file to your Pages origin and deploy again.
In The Snug: **Link → Set relay →** paste `https://gutenberg-relay.<you>.workers.dev/`.

It's restricted to an allow-list of book hosts and to your own site, so it
can't be used as an open proxy by anyone else. It caches at Cloudflare's edge,
so a book is only pulled from Gutenberg once.

**You never need this.** Search-then-File, Paste, and dragging in a file all
work without it. The relay only removes one tap.

Two things I checked so you don't have to. Gutenberg serves `.txt` as
`text/plain`, which browsers *render* in a tab rather than saving — that's why
the download path uses the EPUB instead. And the Internet Archive does mirror
Gutenberg with `Access-Control-Allow-Origin: *`, but its item identifiers are
unguessable, each item holds several differently-named text files, and the
copies are 1998-era transcriptions, so it isn't usable as an automatic source.

---

## Reading

| Action | Phone | Keyboard |
|---|---|---|
| Turn page | tap left/right edge, or swipe | `←` `→` `space` `PgUp` `PgDn` |
| Show/hide controls | tap the middle | — |
| Contents | top-left icon | `T` |
| Settings | top-right icon | `S` |
| Text size | settings | `+` `−` |
| Full screen | corner icon | `F` |
| Back to shelf | back arrow | `Esc` |
| Start / end | drag the progress bar | `Home` `End` |

Your place is kept per book, along with text size, spacing, margins, theme,
and layout. Reopening a book returns you to the paragraph you were on — not
the page number, so your place survives changing the type size.

### Settings worth knowing

**Turn pages** — off gives continuous scrolling instead.

**Typeface → Source** — shows the file exactly as the volunteer typed it:
fixed width, original line breaks, no reflow. Useful for verse, tables, and
ASCII diagrams that reflowing would destroy. It shrinks the type automatically
so a full 70-character line fits without re-wrapping, which on a phone in
portrait means quite small text — turn the device sideways for this one.

**Chapter detection** — plain text files contain no chapter markers, so the
contents list is a guess from the shape of the lines.

- *Auto* accepts `Chapter`/`Book`/`Part`/`Canto`/`Act` headings, roman
  numerals, and all-caps lines. Best for most books.
- *Strict* accepts only the explicit words. Use it when Auto invents chapters
  out of a list of illustrations or a letter signature.
- *Off* gives no contents list.

Tested against seven books: *Pride and Prejudice* (61 chapters + preface),
*Moby-Dick* (135), *Frankenstein* (4 letters + 24), *Alice*, *Huckleberry
Finn*, *Dubliners*, *Leaves of Grass*. Auto found the right structure in all
seven. Strict finds nothing in *Dubliners* or the Sherlock Holmes stories,
because their sections are titled rather than numbered — that's the trade-off.

---

## What it does to the text

- Strips the Gutenberg licence header and footer at the `*** START ***` and
  `*** END ***` markers, including the older `*END*THE SMALL PRINT` format.
- Reflows hard-wrapped paragraphs into real paragraphs.
- Keeps line breaks in verse and indented blocks instead of reflowing them.
- Renders `_underscores_` as italics and `=equals=` as small caps, which is how
  Gutenberg marks emphasis. (There are 845 of them in *Huckleberry Finn* alone.)
- Handles the `/* RIGHT ... */` block-alignment directive.
- Pulls title and author from the file header.
- Turns `[Illustration: ...]` into a caption rather than dropping it.

EPUB files are read directly — real chapters, real emphasis, no guessing. The
unzip library loads from a CDN only when you actually open an EPUB, so plain
text stays dependency-free.

---

## Storage and privacy

Books go in IndexedDB, settings, shelves and reading positions in localStorage,
both on your device. Nothing is uploaded. There is no server, no analytics, no account.

If storage is unavailable — private browsing, or opening the file directly via
`file://` — it falls back to memory and still works for the session. Serve it
over http/https rather than opening the file directly if you want books to
persist; GitHub Pages does this by default.

Removing a book from the shelf deletes its text.

---

## Known limits

- Chapter detection on plain text is heuristic. That's inherent to the format,
  which is why the Strict/Off escape hatch exists.
- Very large books (*Moby-Dick* is 1.2 MB) take about a second to paginate on
  first open.
- Tables and complex layouts in plain text won't survive reflowing. Switch the
  typeface to **Source** for those passages.
- No highlights, notes, or cross-device sync. Say the word if you want them —
  highlights are the natural next addition.
