(function () {
  const nav = document.querySelector(".help-nav");
  const links = Array.from(
    document.querySelectorAll('.help-nav a[href^="#"]'),
  );
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (!nav || links.length === 0 || sections.length === 0) return;

  function setActiveById(id) {
    links.forEach((a) => {
      const target = a.getAttribute("href").slice(1);
      a.classList.toggle("active", target === id);
      if (target === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  // Initial state (hash or top of page)
  if (location.hash) {
    const id = location.hash.slice(1);
    setActiveById(id);
  } else {
    setActiveById(sections[0].id);
  }

  // Keep active state in sync with manual hash changes
  window.addEventListener("hashchange", () => {
    if (!location.hash) return;
    setActiveById(location.hash.slice(1));
  });

  // Scrollspy: track which section is currently in view.
  // Uses IntersectionObserver to avoid scroll event spam.
  let current = null;
  const observer = new IntersectionObserver(
    (entries) => {
      // Consider only intersecting entries, pick the one closest to the top.
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        );

      if (visible.length === 0) return;
      const id = visible[0].target.id;
      if (id && id !== current) {
        current = id;
        setActiveById(id);
      }
    },
    {
      root: null,
      // Bias toward "reading position" slightly below the top.
      rootMargin: "-15% 0px -70% 0px",
      threshold: [0, 0.1],
    },
  );

  sections.forEach((s) => observer.observe(s));
})();

// Copy to clipboard functionality for code blocks
(function () {
  const codeBlocks = document.querySelectorAll(".code-block");

  codeBlocks.forEach((block) => {
    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    // Create copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-code-btn";
    copyBtn.innerHTML = `
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
    </svg>
    <span>Copy</span>
  `;

    copyBtn.addEventListener("click", async () => {
      const code = block.textContent.trim();

      try {
        await navigator.clipboard.writeText(code);

        // Visual feedback
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>Copied!</span>
      `;

        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <span>Copy</span>
        `;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });

    wrapper.appendChild(copyBtn);
  });
})();