// Theme switch (remembers the choice) and in-page search. Loaded in <head> so the theme applies before paint.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try { var saved = localStorage.getItem("theme"); if (saved === "light" || saved === "dark") root.dataset.theme = saved; } catch { /* storage blocked */ }

  function isDark() {
    return root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".theme-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(isDark()));
      toggle.addEventListener("click", function () {
        var next = isDark() ? "light" : "dark";
        root.dataset.theme = next;
        toggle.setAttribute("aria-pressed", String(next === "dark"));
        try { localStorage.setItem("theme", next); } catch { /* storage blocked */ }
      });
    }

    // Close the language menu when clicking elsewhere or pressing Escape.
    var lang = document.querySelector("details.lang");
    if (lang) {
      document.addEventListener("click", function (e) { if (!lang.contains(e.target)) lang.open = false; });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") lang.open = false; });
    }

    var q = document.getElementById("q");
    if (q) {
      var items = Array.prototype.slice.call(document.querySelectorAll("[data-search]"));
      var none = document.getElementById("no-results");
      var run = function () {
        var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var shown = 0;
        items.forEach(function (li) {
          var text = li.getAttribute("data-search") || "";
          var ok = words.every(function (w) { return text.indexOf(w) !== -1; });
          li.hidden = !ok;
          if (ok) shown++;
        });
        if (none) none.hidden = shown > 0;
      };
      q.addEventListener("input", run);
      var initial = new URLSearchParams(window.location.search).get("q");
      if (initial) q.value = initial;
      run();
      q.form.addEventListener("submit", function (e) { e.preventDefault(); });
    }
  });
})();
