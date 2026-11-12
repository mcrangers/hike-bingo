(() => {
  "use strict";

  const STORAGE_KEY = "trailbingo:availability:v1";

  let panel;
  let message;
  let checkButton;
  let requestRunning = false;
  let locked = true;

  const previouslyInert = new Map();

  function readSavedState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      return saved && typeof saved.lockdown === "boolean"
        ? saved.lockdown
        : true;
    } catch {
      return true;
    }
  }

  function saveState(value) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lockdown: value,
          checkedAt: Date.now()
        })
      );
    } catch {
      // Storage is optional.
    }
  }

  function applyLock(value) {
    locked = value;

    if (locked) {
      for (const element of document.body.children) {
        if (
          element === panel ||
          ["SCRIPT", "STYLE"].includes(element.tagName)
        ) {
          continue;
        }

        if (!previouslyInert.has(element)) {
          previouslyInert.set(element, element.inert);
        }

        element.inert = true;
      }

      panel.hidden = false;

      document.documentElement.classList.add(
        "bingo-lockdown-active"
      );
    } else {
      const focusWasInside = panel.contains(
        document.activeElement
      );

      panel.hidden = true;

      document.documentElement.classList.remove(
        "bingo-lockdown-active"
      );

      for (const [element, originalValue] of previouslyInert) {
        if (element.isConnected) {
          element.inert = originalValue;
        }
      }

      previouslyInert.clear();

      if (focusWasInside) {
        document.body.setAttribute("tabindex", "-1");
        document.body.focus();
      }
    }
  }

  async function checkAvailability() {
    if (requestRunning) return;

    requestRunning = true;
    checkButton.disabled = true;
    checkButton.textContent = "Checking…";

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      10000
    );

    try {
      const response = await fetch(
        `config.json?availability=${Date.now()}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error("Settings unavailable");
      }

      const settings = await response.json();

      if (typeof settings.lockdown !== "boolean") {
        throw new Error("Availability setting not published yet");
      }

      saveState(settings.lockdown);
      applyLock(settings.lockdown);

      message.textContent = settings.lockdown
        ? "The game hasn’t opened yet. We’ll unlock it at the meeting point."
        : "";
    } catch {
      applyLock(readSavedState());

      if (locked) {
        message.textContent =
          "Couldn’t confirm that the game is open. Connect to the internet and tap Check again.";
      }
    } finally {
      clearTimeout(timeout);

      requestRunning = false;
      checkButton.disabled = false;
      checkButton.textContent = "Check again";
    }
  }

  function init() {
    const style = document.createElement("style");

    style.textContent = `
      html.bingo-lockdown-active,
      html.bingo-lockdown-active body {
        overflow: hidden !important;
      }

      #bingo-lockdown {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        overflow-y: auto;
        padding: 28px 20px;
        background: #f3f4ed;
        color: #173e32;
        font-family: system-ui, -apple-system, sans-serif;
      }

      #bingo-lockdown[hidden] {
        display: none !important;
      }

      #bingo-lockdown .lock-content {
        width: min(100%, 430px);
        text-align: center;
      }

      #bingo-lockdown .lock-brand {
        margin: 0 0 28px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 3px;
      }

      #bingo-lockdown .lock-tag {
        display: inline-block;
        margin-bottom: 18px;
        padding: 8px 12px;
        border-radius: 999px;
        background: #e1eadd;
        font-size: 12px;
      }

      #bingo-lockdown h1 {
        margin: 0 0 16px;
        font-size: clamp(36px, 9vw, 52px);
        line-height: 1.1;
        letter-spacing: -1.5px;
      }

      #bingo-lockdown .lock-message {
        min-height: 52px;
        margin: 0 0 26px;
        color: #65756b;
        font-size: 15px;
        line-height: 1.7;
      }

      #bingo-lockdown button {
        width: 100%;
        min-height: 52px;
        border: 0;
        border-radius: 13px;
        background: #173e32;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      #bingo-lockdown button:disabled {
        opacity: 0.6;
        cursor: wait;
      }

      #bingo-lockdown a {
        display: inline-block;
        margin-top: 20px;
        padding: 10px;
        color: #173e32;
        font-size: 13px;
      }

      #bingo-lockdown button:focus-visible,
      #bingo-lockdown a:focus-visible {
        outline: 3px solid #be9135;
        outline-offset: 4px;
      }

      #bingo-lockdown a.lock-demo-link {
        display: block;
        width: 100%;
        margin: 0 0 12px;
        padding: 15px;
        border-radius: 13px;
        background: #173e32;
        color: white;
        font-size: 15px;
        font-weight: 700;
        text-decoration: none;
        text-align: center;
      }
    `;

    document.head.appendChild(style);

    panel = document.createElement("section");
    panel.id = "bingo-lockdown";
    panel.setAttribute("aria-label", "Bingo availability");

    panel.innerHTML = `
      <div class="lock-content">
        <p class="lock-brand">MC RANGERS</p>

        <span class="lock-tag">Trail Bingo</span>

        <h1>Available on<br>hike day.</h1>

        <p
          class="lock-message"
          id="lock-message"
          role="status"
          aria-live="polite"
        >
          Checking game availability…
        </p>

        <a class="lock-demo-link" href="demo.html">
          Try a demo
        </a>

        <button id="lock-check" type="button">
          Check again
        </button>

        <a href="/">Back to MC Rangers</a>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.classList.add("availability-ready");

    message = panel.querySelector("#lock-message");
    checkButton = panel.querySelector("#lock-check");

    checkButton.addEventListener(
      "click",
      checkAvailability
    );

    // Block the interface until the initial check finishes.
    applyLock(true);
    checkAvailability();

    // Keep newly added game interface elements blocked too.
    new MutationObserver(() => {
      if (locked) applyLock(true);
    }).observe(document.body, {
      childList: true
    });

    window.addEventListener(
      "online",
      checkAvailability
    );

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        checkAvailability();
      }
    });

    setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        checkAvailability();
      }
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
