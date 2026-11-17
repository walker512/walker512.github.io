(() => {
  const account = "walker512";
  const endpoint = `https://api.github.com/users/${account}/repos?type=owner&sort=pushed&direction=desc&per_page=100`;
  const preview = document.querySelector(".source-preview-list");
  const list = document.querySelector(".repo-list");
  const heading = document.querySelector("#repo-title");
  const excluded = new Set([account, `${account}.github.io`, ".github"]);

  function isProject(repo) {
    return typeof repo?.name === "string" && /^[a-z\d._-]{1,100}$/i.test(repo.name) &&
      !excluded.has(repo.name.toLowerCase()) && repo.name !== "." && repo.name !== ".." &&
      typeof repo.owner?.login === "string" && repo.owner.login.toLowerCase() === account && repo.private === false &&
      repo.fork === false && repo.archived === false &&
      typeof repo.license?.spdx_id === "string" && repo.license.spdx_id !== "NOASSERTION";
  }

  function entry(repo, compact) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `https://github.com/${account}/${encodeURIComponent(repo.name)}`;
    link.target = "_blank";
    link.rel = "noopener";

    const name = document.createElement(compact ? "span" : "strong");
    name.textContent = repo.name;
    const arrow = document.createElement("span");
    arrow.className = "repo-arrow";
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    link.append(name, arrow);

    if (!compact && typeof repo.description === "string" && repo.description.trim()) {
      const description = document.createElement("span");
      description.className = "repo-description";
      description.textContent = repo.description;
      link.append(description);
    }
    item.append(link);
    return item;
  }

  function populate(container, repositories, compact) {
    // Keep a repository link in place while someone is using it with the keyboard.
    if (container.contains(document.activeElement)) {
      container.addEventListener("focusout", () => {
        setTimeout(() => populate(container, repositories, compact), 0);
      }, { once: true });
      return;
    }
    container.replaceChildren(...repositories.map(repo => entry(repo, compact)));
    if (!compact) heading.textContent = "最近更新的开源项目";
  }

  async function updateProjects() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, { credentials: "omit", signal: controller.signal });
      if (!response.ok) return;
      const payload = await response.json();
      if (!Array.isArray(payload)) return;
      const repositories = payload.filter(isProject).slice(0, 3);
      if (repositories.length < 3) return;
      populate(preview, repositories.slice(0, 2), true);
      populate(list, repositories, false);
    } catch {
      // The HTML includes working links for offline and rate-limited visits.
    } finally {
      clearTimeout(timeout);
    }
  }

  if ("requestIdleCallback" in window) requestIdleCallback(updateProjects, { timeout: 1500 });
  else setTimeout(updateProjects, 700);
})();
