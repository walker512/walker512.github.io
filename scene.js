const places = {
  research: { name: "研究", building: "天文台", image: "assets/research.webp", door: [1307, 297], zoom: 1.98 },
  projects: { name: "项目", building: "工坊", image: "assets/workshop.webp", door: [1133, 490], zoom: 1.91 },
  writing: { name: "写作", building: "小屋", image: "assets/cabin.webp", door: [1062, 765], zoom: 1.89 },
};

const scene = document.querySelector(".scene");
const ui = scene.querySelector(".scene-ui");
const header = document.querySelector(".site-header");
const outside = scene.querySelector(".outside-art");
const inside = scene.querySelector(".inside-art");
const canvas = scene.querySelector(".motion-art");
const snowfield = scene.querySelector(".snowfield");
const snowToggle = header.querySelector(".snow-toggle");
const paint = canvas.getContext("2d", { alpha: false });
const veil = document.createElement("canvas");
const mask = veil.getContext("2d");
const menu = document.querySelector(".place-menu");
const locationBar = document.querySelector(".mobile-places");
const explore = document.querySelector(".explore");
const placesLink = document.querySelector("[data-show-places]");
const closeMenuButton = document.querySelector(".menu-close");
const homeTitle = document.querySelector("#home-title");
const homeParts = document.querySelectorAll(".home-nav, .home-intro, .source-preview, .hotspots, .mobile-places, .snow-toggle");
const roomNav = document.querySelector(".room-nav");
const roomSections = document.querySelectorAll(".room-intro");
const selectables = document.querySelectorAll(".hotspot, .mobile-places a, .place-menu > a");
const narrow = matchMedia("(max-width: 760px)");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const assets = new Map();
const homeTitleText = document.title;

let active = "home";
let transition = null;
let menuOpener = explore;

function setMenu(open, focus = true, opener = explore) {
  if (open) menuOpener = opener;
  menu.hidden = !open;
  explore.setAttribute("aria-expanded", String(open));
  placesLink.setAttribute("aria-expanded", String(open));
  if (focus) (open ? menu.querySelector("a") : menuOpener).focus({ preventScroll: true });
}

function setView(id) {
  const place = places[id];
  const isRoom = Boolean(place);
  if (place) {
    if (inside.getAttribute("src") === place.image && inside.complete && !inside.naturalWidth) {
      inside.removeAttribute("src");
    }
    if (inside.getAttribute("src") !== place.image) inside.src = place.image;
  }
  active = id;
  scene.dataset.view = id;
  outside.hidden = isRoom;
  inside.hidden = !isRoom;
  document.body.classList.toggle("is-interior", isRoom);
  homeParts.forEach(part => { part.hidden = isRoom; });
  roomNav.hidden = !isRoom;
  roomSections.forEach(part => { part.hidden = part.id !== id; });
  roomNav.querySelectorAll("a").forEach(link => {
    if (link.hash === "#" + id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = place ? place.name + " · " + place.building : homeTitleText;
  scene.style.setProperty("--room-shade", isRoom ? "1" : "0");
  setMenu(false, false);
}

function startSnow() {
  const flakes = document.createDocumentFragment();
  for (let index = 0; index < 16; index++) {
    const flake = document.createElement("span");
    const size = 1 + Math.random() * 1.7;
    const duration = 15 + Math.random() * 22;
    flake.className = "snowflake";
    flake.style.setProperty("--flake-start", `${(index + Math.random()) * 6.25}%`);
    flake.style.setProperty("--flake-size", `${size}px`);
    flake.style.setProperty("--flake-opacity", String(0.15 + size * 0.12));
    flake.style.setProperty("--flake-time", `${duration}s`);
    flake.style.setProperty("--flake-delay", `${-Math.random() * duration}s`);
    flake.style.setProperty("--flake-drift", `${5 + Math.random() * 13}vw`);
    flakes.append(flake);
  }
  snowfield.append(flakes);
  snowfield.hidden = false;
  scene.classList.toggle("page-hidden", document.hidden);
}

function hashRoute(hash) {
  const name = hash.slice(1);
  return Object.hasOwn(places, name) ? name : "home";
}

function getArt(id) {
  if (assets.has(id)) return assets.get(id);
  const image = id === "home" ? outside : new Image();
  if (id !== "home") image.src = places[id].image;
  const result = image.decode().then(() => image, () => {
    assets.delete(id);
    return null;
  });
  assets.set(id, result);
  return result;
}

function markSelection(id) {
  selectables.forEach(link => {
    link.classList.toggle("is-selected", link.hash === "#" + id);
  });
}

function finish(job, { focus = true } = {}) {
  if (transition !== job) return;

  cancelAnimationFrame(job.frame);
  transition = null;
  canvas.hidden = true;
  ui.style.opacity = "";
  header.style.opacity = "";
  setView(job.target);
  scene.removeAttribute("aria-busy");
  markSelection("");

  window.scrollTo({ top: 0, behavior: "instant" });
  if (focus) (job.target === "home" ? homeTitle : document.getElementById(job.target + "-title")).focus({ preventScroll: true });
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(value, max));
}

function between(start, end, amount) {
  return start + (end - start) * amount;
}

function ease(start, end, time) {
  const t = clamp((time - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function fittedCrop(image, width, height, alignment) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = width / scale;
  const h = height / scale;
  return {
    x: (image.naturalWidth - w) * alignment[0],
    y: (image.naturalHeight - h) * alignment[1],
    w,
    h,
  };
}

function cropBetween(from, to, amount) {
  return {
    x: between(from.x, to.x, amount),
    y: between(from.y, to.y, amount),
    w: between(from.w, to.w, amount),
    h: between(from.h, to.h, amount),
  };
}

function draw(context, image, crop) {
  context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
}

function imageAlignment(element) {
  return getComputedStyle(element).objectPosition.split(" ").map(value => parseFloat(value) / 100);
}

function scenicPainter(outdoor, indoor, id) {
  const mobile = narrow.matches;
  const width = canvas.width;
  const height = canvas.height;
  const start = fittedCrop(outdoor, width, height, imageAlignment(outside));
  const room = fittedCrop(indoor, width, height, imageAlignment(inside));
  const { door, zoom } = places[id];
  const w = start.w / (mobile ? 1.48 : zoom);
  const h = start.h / (mobile ? 1.48 : zoom);
  const doorX = outdoor.naturalWidth * door[0] / 1536;
  const doorY = outdoor.naturalHeight * door[1] / 1024;
  const destination = {
    x: clamp(doorX - w * (mobile ? 0.57 : 0.69), 0, outdoor.naturalWidth - w),
    y: clamp(doorY - h * 0.55, 0, outdoor.naturalHeight - h),
    w,
    h,
  };
  const restingRoom = {
    x: room.x + room.w * 0.01923,
    y: room.y + room.h * 0.01923,
    w: room.w / 1.04,
    h: room.h / 1.04,
  };

  return function paintScene(time) {
    const reveal = ease(0.40, 0.84, time);
    const interiorCrop = cropBetween(room, restingRoom, ease(0.43, 1, time));

    if (reveal === 1) {
      draw(paint, indoor, interiorCrop);
      return;
    }

    draw(paint, outdoor, cropBetween(start, destination, ease(0.09, 0.86, time)));
    if (reveal === 0) return;

    mask.clearRect(0, 0, width, height);
    draw(mask, indoor, interiorCrop);
    const feather = width * 0.12;
    const edge = between(width + feather * 2, -feather * 2, reveal);
    const gradient = mask.createLinearGradient(edge - feather, height * 0.56, edge + feather, height * 0.45);
    gradient.addColorStop(0.12, "transparent");
    gradient.addColorStop(0.52, "rgba(0,0,0,.52)");
    gradient.addColorStop(0.88, "#000");
    mask.globalCompositeOperation = "destination-in";
    mask.fillStyle = gradient;
    mask.fillRect(0, 0, width, height);
    mask.globalCompositeOperation = "source-over";
    paint.drawImage(veil, 0, 0);

    const shadow = paint.createLinearGradient(edge - feather, height * 0.56, edge + feather, height * 0.45);
    shadow.addColorStop(0, "transparent");
    shadow.addColorStop(0.51, "rgba(5,12,23,.58)");
    shadow.addColorStop(1, "transparent");
    paint.fillStyle = shadow;
    paint.fillRect(0, 0, width, height);
  };
}

function roomPainter(from, to) {
  const alignment = imageAlignment(inside);
  const crop = image => {
    const fit = fittedCrop(image, canvas.width, canvas.height, alignment);
    return {
      x: fit.x + fit.w * 0.01923,
      y: fit.y + fit.h * 0.01923,
      w: fit.w / 1.04,
      h: fit.h / 1.04,
    };
  };
  const start = crop(from);
  const end = crop(to);
  return time => {
    draw(paint, from, start);
    paint.globalAlpha = ease(0.12, 0.92, time);
    draw(paint, to, end);
    paint.globalAlpha = 1;
  };
}

function animate(job, fromImage, toImage) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
  const bounds = scene.getBoundingClientRect();
  canvas.width = veil.width = Math.round(bounds.width * pixelRatio);
  canvas.height = veil.height = Math.round(bounds.height * pixelRatio);
  const outward = job.target === "home";
  const scenic = job.from === "home" || outward;
  const render = scenic
    ? scenicPainter(outward ? toImage : fromImage, outward ? fromImage : toImage, outward ? job.from : job.target)
    : roomPainter(fromImage, toImage);
  const duration = scenic ? (outward ? 980 : 1320) : 390;
  const switchAt = scenic ? 0.80 : 0.52;
  let first;

  render(outward ? 1 : 0);
  canvas.hidden = false;
  job.frame = requestAnimationFrame(function step(now) {
    if (transition !== job) return;
    first ??= now;
    const progress = clamp((now - first) / duration);
    const arriving = progress >= switchAt;
    render(outward ? 1 - progress : progress);
    if (arriving && active !== job.target) setView(job.target);

    const opacity = arriving ? ease(switchAt, 1, progress) : 1 - ease(0.07, 0.28, progress);
    ui.style.opacity = header.style.opacity = String(opacity);
    const shade = scenic ? (outward ? 1 - ease(0.08, 0.30, progress) : ease(switchAt, 1, progress)) : 1;
    scene.style.setProperty("--room-shade", String(shade));

    if (progress === 1) finish(job);
    else job.frame = requestAnimationFrame(step);
  });
}

async function go(target, hash, fromHistory = false) {
  if (transition || target === active) return;
  const job = { from: active, target, hash, frame: 0 };
  transition = job;
  if (!fromHistory && location.hash !== hash) history.pushState(null, "", hash);
  markSelection(target);
  scene.setAttribute("aria-busy", "true");

  const stageVisible = Math.abs(scene.getBoundingClientRect().top) <= 26;
  if (!paint || !mask || reduceMotion.matches || document.hidden) {
    finish(job);
    return;
  }
  if (!stageVisible) {
    finish(job);
    ui.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 240, easing: "ease-out" },
    );
    return;
  }

  let budget;
  const art = await Promise.race([
    Promise.all([getArt(job.from), getArt(target)]),
    new Promise(resolve => { budget = setTimeout(() => resolve(null), 650); }),
  ]);
  clearTimeout(budget);
  if (transition !== job) return;
  if (art?.every(Boolean)) animate(job, ...art);
  else finish(job);
}

function syncAddress() {
  const hash = location.hash;
  if (transition?.hash === hash) return;
  if (transition) {
    cancelAnimationFrame(transition.frame);
    transition = { target: hashRoute(hash), hash, frame: 0 };
    finish(transition);
  } else {
    go(hashRoute(hash), hash, true);
  }
}

explore.hidden = false;
placesLink.setAttribute("aria-controls", "place-menu");
setView(hashRoute(location.hash));
document.body.classList.add("visual-navigation");
startSnow();
if (active !== "home") window.scrollTo({ top: 0, behavior: "instant" });

snowToggle.addEventListener("click", () => {
  const paused = scene.classList.toggle("snow-paused");
  snowToggle.setAttribute("aria-pressed", String(!paused));
});
explore.addEventListener("click", () => setMenu(menu.hidden));
closeMenuButton.addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !menu.hidden) setMenu(false);
});

document.addEventListener("click", event => {
  const link = event.target.closest("a[href^='#']");
  if (!menu.hidden && !event.target.closest(".place-menu, .explore, [data-show-places]")) setMenu(false, false);
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const { hash } = link;
  if (hash === "#main") {
    event.preventDefault();
    document.querySelector("#main").focus();
    return;
  }
  if (transition) {
    if (active !== transition.target) {
      event.preventDefault();
      return;
    }
    finish(transition, { focus: false });
  }
  if (link === placesLink) {
    event.preventDefault();
    if (getComputedStyle(locationBar).display !== "none") locationBar.querySelector("a").focus();
    else setMenu(menu.hidden, true, placesLink);
    return;
  }
  const target = hashRoute(hash);
  if (target === "home" && active === "home") return;
  event.preventDefault();
  go(target, hash);
});

for (const name of ["hashchange", "popstate", "pageshow"]) addEventListener(name, syncAddress);
addEventListener("resize", () => {
  if (transition) finish(transition, { focus: false });
  if (!menu.hidden && getComputedStyle(locationBar).display !== "none") {
    setMenu(false, false);
    locationBar.querySelector("a").focus({ preventScroll: true });
  }
});
document.addEventListener("visibilitychange", () => {
  scene.classList.toggle("page-hidden", document.hidden);
  if (document.hidden && transition) finish(transition, { focus: false });
});
reduceMotion.addEventListener("change", () => {
  if (transition && reduceMotion.matches) finish(transition);
});

const warmArt = () => Object.keys(places).forEach(id => { getArt(id); });
if ("requestIdleCallback" in window) requestIdleCallback(warmArt, { timeout: 1300 });
else setTimeout(warmArt, 700);
