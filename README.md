<p align="center">
  <img src="icons/logo-sm.png" alt="MC Rangers" width="200">
</p>

<h1 align="center">Trail Bingo</h1>

<p align="center">
  An icebreaker bingo game for hikes, made by <strong>MC Rangers</strong> with CCIA &amp; SHHOISA.<br>
  <a href="https://mcrangers.github.io/hike-bingo/"><strong>Play it live →</strong></a>
</p>

---

Mixed-college hikes have a habit of splitting back into the same friend groups. Trail Bingo gives everyone a reason to talk to someone new: each player gets a shuffled 5×5 card and fills squares by finding hikers who match the prompts, mostly from **other colleges** (only a few squares can be signed by their own college).

## Features

- **Shuffled cards:** every player gets a different 5×5 card with a free centre square.
- **Rules built in:** same-college signatures are blocked, and each person can sign a limited number of squares on one card.
- **Exco tiles:** gold squares that only MC Rangers exco can sign, using a shared code.
- **Winning card:** the first player to finish shows an MC Rangers exco a summary with their finish time and the whole signed board.
- **Works offline:** a service worker keeps the app working on the trail with no signal, and players can install it to their home screen.
- **No backend:** each card is saved on the phone, and nothing is tracked or sent anywhere.
- **Admin page:** organisers can change settings live from a phone, without touching code.

## How it works

The project is a static site on GitHub Pages: plain HTML, CSS and JavaScript, with no build step or dependencies.

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The game |
| `config.json` | Live settings, read by the game on launch and written by the admin page |
| `admin.html`, `admin.css`, `admin.js` | Settings dashboard for organisers |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen install |

### Admin page

`admin.html` reads and writes `config.json` through the GitHub Contents API. Saving a setting creates a commit, Pages redeploys it, and phones pick up the change the next time they open the app. Settings come from a small schema (`SETTINGS` in `admin.js`), so adding a toggle only takes one line there plus a key in `REMOTE_KEYS` in `app.js`.

## Keep it simple

This is a one-day fun game, so it keeps security light on purpose:

- **Admin access:** the admin page needs a GitHub key with write access to this repo. You paste it once on each phone, and it stays only on that phone (never in the repo).
- **Exco code:** it's stored in `config.json`, so anyone who opens that file can read it. That's fine for a hike icebreaker.
- **Game rules:** every check runs on the phone, so the rules keep things fair for people playing along, but they aren't tamper-proof.

## Run locally

```bash
git clone https://github.com/mcrangers/hike-bingo.git
cd hike-bingo
python3 -m http.server 8000
# open http://localhost:8000
```

A local server is needed (rather than opening the file directly) for the service worker and `fetch("config.json")` to work.

## Customise

- **Prompts and colleges:** edit the `CONFIG` block at the top of `app.js`.
- **Live settings:** change these from the admin page. They include the win rule, signs per person, the loading screen and the exco tiles.
- **Force a refresh:** after a large change, bump `VERSION` in `sw.js` so installed copies update.

## License

The code is released under the [MIT License](LICENSE). The MC Rangers logo and name belong to MC Rangers and aren't covered by the license.
