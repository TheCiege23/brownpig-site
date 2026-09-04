/* Brown Pig LLC — shared behaviour. No dependencies. */
(function () {
  "use strict";

  /* ---- mobile nav ------------------------------------------------------ */
  var toggle = document.querySelector(".navtoggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    var sync = function () {
      var wide = window.matchMedia("(min-width: 861px)").matches;
      if (wide) { nav.hidden = false; toggle.setAttribute("aria-expanded", "false"); }
      else if (toggle.getAttribute("aria-expanded") !== "true") { nav.hidden = true; }
    };
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.hidden = open;
    });
    window.addEventListener("resize", sync);
    sync();
  }

  /* ---- current year ---------------------------------------------------- */
  var y = document.querySelectorAll("[data-year]");
  for (var i = 0; i < y.length; i++) { y[i].textContent = new Date().getFullYear(); }

  /* ---- live site previews ---------------------------------------------
     Each .shot[data-site] renders a live screenshot of the target URL.
     Two providers are tried in order, then we fall back to a branded tile.
     To use your own images instead, drop a file at assets/shots/<slug>.png
     and set data-local="assets/shots/<slug>.png" on the .shot element.
     --------------------------------------------------------------------- */
  var providers = [
    function (url) { return "https://image.thum.io/get/width/1000/crop/700/noanimate/" + url; },
    function (url) { return "https://s.wordpress.com/mshots/v1/" + encodeURIComponent(url) + "?w=1000&h=700"; }
  ];

  var shots = document.querySelectorAll(".shot[data-site]");
  Array.prototype.forEach.call(shots, function (shot) {
    var url = shot.getAttribute("data-site");
    var local = shot.getAttribute("data-local");
    var attempt = 0;

    var note = document.createElement("span");
    note.className = "shot__skeleton";
    note.textContent = "loading preview…";
    shot.appendChild(note);

    var img = document.createElement("img");
    img.alt = (shot.getAttribute("data-label") || "Site") + " — homepage preview";
    img.loading = "lazy";
    img.decoding = "async";

    img.addEventListener("load", function () {
      if (note.parentNode) { note.parentNode.removeChild(note); }
    });

    img.addEventListener("error", function () {
      attempt++;
      if (attempt < providers.length + (local ? 1 : 0)) { next(); }
      else {
        if (img.parentNode) { img.parentNode.removeChild(img); }
        if (note.parentNode) { note.parentNode.removeChild(note); }
        shot.classList.add("shot--fallback");
      }
    });

    function next() {
      if (local && attempt === 0) { img.src = local; return; }
      var p = providers[local ? attempt - 1 : attempt];
      if (p) { img.src = p(url); }
    }

    shot.appendChild(img);
    next();
  });
})();
