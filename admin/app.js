(function () {
  const config = window.HYPER001_ADMIN_CONFIG || {};
  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const publishCommand = "npm run publish:manual";

  const state = {
    overview: null,
    posts: [],
    filteredPosts: [],
    currentPostId: null,
    links: [],
    currentLinkIndex: null,
  };

  const els = {
    loginScreen: document.querySelector("#login-screen"),
    adminShell: document.querySelector("#admin-shell"),
    loginForm: document.querySelector("#login-form"),
    navButtons: [...document.querySelectorAll(".nav-btn")],
    jumpButtons: [...document.querySelectorAll("[data-jump]")],
    sections: [...document.querySelectorAll(".section")],
    siteTitle: document.querySelector("#site-title"),
    siteLink: document.querySelector("#site-link"),
    topbarSubtitle: document.querySelector("#topbar-subtitle"),
    statusSource: document.querySelector("#status-source"),
    logoutBtn: document.querySelector("#logout-btn"),
    overviewCards: document.querySelector("#overview-cards"),
    recentPosts: document.querySelector("#recent-posts"),
    postsList: document.querySelector("#posts-list"),
    postSearch: document.querySelector("#post-search"),
    postFilter: document.querySelector("#post-filter"),
    postForm: document.querySelector("#post-form"),
    postEditorTitle: document.querySelector("#post-editor-title"),
    postEditorMeta: document.querySelector("#post-editor-meta"),
    markdownPreview: document.querySelector("#markdown-preview"),
    newPost: document.querySelector("#new-post"),
    savePost: document.querySelector("#save-post"),
    deletePost: document.querySelector("#delete-post"),
    linksList: document.querySelector("#links-list"),
    linkForm: document.querySelector("#link-form"),
    linkEditorTitle: document.querySelector("#link-editor-title"),
    linkPreview: document.querySelector("#link-preview"),
    newLink: document.querySelector("#new-link"),
    saveLinks: document.querySelector("#save-links"),
    deleteLink: document.querySelector("#delete-link"),
    assetUrl: document.querySelector("#asset-url"),
    assetAlt: document.querySelector("#asset-alt"),
    assetTitle: document.querySelector("#asset-title"),
    assetMarkdown: document.querySelector("#asset-markdown"),
    assetCover: document.querySelector("#asset-cover"),
    copyPublishButtons: [
      document.querySelector("#copy-publish-command"),
      document.querySelector("#copy-publish-command-inline"),
      document.querySelector("#copy-publish-command-panel"),
    ].filter(Boolean),
    copyButtons: [...document.querySelectorAll("[data-copy-target]")],
    toast: document.querySelector("#toast"),
  };

  const blankPost = () => ({
    id: null,
    title: "",
    slug: "",
    date: toInputDate(new Date()),
    tags: [],
    categories: [],
    excerpt: "",
    cover: "",
    draft: false,
    content: "",
  });

  const blankLink = () => ({
    title: "",
    intro: "",
    link: "",
    avatar: "",
  });

  function field(form, name) {
    return form.elements.namedItem(name);
  }

  function toInputDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (input) => String(input).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromInputDate(value) {
    return value ? `${value.replace("T", " ")}:00` : "";
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (response.status === 204) return null;

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Request failed");
      error.details = payload.details || "";
      throw error;
    }

    return payload;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function switchSection(name) {
    for (const section of els.sections) {
      section.classList.toggle("is-active", section.dataset.section === name);
    }

    for (const button of els.navButtons) {
      button.classList.toggle("is-active", button.dataset.section === name);
    }
  }

  function renderOverview() {
    if (!state.overview) return;

    const { site, counts, recentPosts } = state.overview;
    els.siteTitle.textContent = `${site.title} 在线后台`;
    els.siteLink.href = site.url || "/";
    els.topbarSubtitle.textContent = `源码仓库已连接，当前永久链接规则为 ${site.permalink || "未配置"}`;
    els.statusSource.textContent = `已连接 ${site.author || "站点管理员"} 的源码仓库`;

    const metrics = [
      { label: "文章总数", value: counts.posts, hint: "当前源码仓库中的文章数量" },
      { label: "草稿数量", value: counts.drafts, hint: "这些文章不会直接出现在前台" },
      { label: "友链数量", value: counts.links, hint: "友链墙当前成员数量" },
      { label: "发布方式", value: "手动", hint: "保存后本地执行发布命令" },
    ];

    els.overviewCards.innerHTML = metrics.map((metric) => `
      <article class="metric-card glass">
        <span class="eyebrow">${metric.label}</span>
        <strong>${escapeHtml(metric.value)}</strong>
        <span>${escapeHtml(metric.hint)}</span>
      </article>
    `).join("");

    els.recentPosts.innerHTML = recentPosts.length
      ? recentPosts.map((post) => `
        <button class="list-item" data-open-post="${encodeURIComponent(post.id)}">
          <h4>${escapeHtml(post.title)}${post.draft ? '<span class="badge">草稿</span>' : ""}</h4>
          <div class="list-item__meta">${escapeHtml(post.date)} · ${escapeHtml(post.slug)}</div>
        </button>
      `).join("")
      : '<div class="list-item"><h4>还没有文章</h4><div class="list-item__meta">先去创建第一篇文章吧。</div></div>';

    for (const button of els.recentPosts.querySelectorAll("[data-open-post]")) {
      button.addEventListener("click", async () => {
        switchSection("posts");
        await openPost(decodeURIComponent(button.dataset.openPost));
      });
    }
  }

  function applyPostFilters() {
    const keyword = String(els.postSearch.value || "").trim().toLowerCase();
    const filter = els.postFilter.value;

    state.filteredPosts = state.posts.filter((post) => {
      if (filter === "draft" && !post.draft) return false;
      if (filter === "published" && post.draft) return false;

      if (!keyword) return true;

      const haystack = [
        post.title,
        post.slug,
        ...(post.tags || []),
        ...(post.categories || []),
      ].join(" ").toLowerCase();

      return haystack.includes(keyword);
    });
  }

  function renderPostsList() {
    applyPostFilters();

    if (!state.filteredPosts.length) {
      els.postsList.innerHTML = '<div class="list-item"><h4>没有匹配结果</h4><div class="list-item__meta">试试换个关键词，或者切回“全部文章”。</div></div>';
      return;
    }

    els.postsList.innerHTML = state.filteredPosts.map((post) => `
      <button class="list-item ${state.currentPostId === post.id ? "is-active" : ""}" data-post-id="${encodeURIComponent(post.id)}">
        <h4>${escapeHtml(post.title)}${post.draft ? '<span class="badge">草稿</span>' : ""}</h4>
        <div class="list-item__meta">${escapeHtml(post.date)} · ${escapeHtml(post.slug)}</div>
      </button>
    `).join("");

    for (const button of els.postsList.querySelectorAll("[data-post-id]")) {
      button.addEventListener("click", () => openPost(decodeURIComponent(button.dataset.postId)));
    }
  }

  function renderLinksList() {
    if (!state.links.length) {
      els.linksList.innerHTML = '<div class="list-item"><h4>还没有友链</h4><div class="list-item__meta">点击右上角按钮创建第一条友链。</div></div>';
      return;
    }

    els.linksList.innerHTML = state.links.map((link, index) => `
      <button class="list-item ${state.currentLinkIndex === index ? "is-active" : ""}" data-link-index="${index}">
        <h4>${escapeHtml(link.title || "未命名友链")}</h4>
        <div class="list-item__meta">${escapeHtml(link.link || "请补充链接地址")}</div>
      </button>
    `).join("");

    for (const button of els.linksList.querySelectorAll("[data-link-index]")) {
      button.addEventListener("click", () => openLink(Number(button.dataset.linkIndex)));
    }
  }

  function fillPostForm(post) {
    field(els.postForm, "title").value = post.title || "";
    field(els.postForm, "slug").value = post.slug || "";
    field(els.postForm, "date").value = toInputDate(post.date);
    field(els.postForm, "tags").value = (post.tags || []).join(", ");
    field(els.postForm, "categories").value = (post.categories || []).join(", ");
    field(els.postForm, "excerpt").value = post.excerpt || "";
    field(els.postForm, "cover").value = post.cover || "";
    field(els.postForm, "draft").checked = Boolean(post.draft);
    field(els.postForm, "content").value = post.content || "";
    els.postEditorTitle.textContent = post.title || "新建文章";
    els.postEditorMeta.textContent = post.id
      ? `当前文件：${post.id} · ${post.draft ? "草稿" : "已发布"}`
      : "填完标题和正文后保存，后台会自动创建新的 Markdown 文件。";
    renderMarkdownPreview(post.content || "");
  }

  function fillLinkForm(link) {
    field(els.linkForm, "title").value = link.title || "";
    field(els.linkForm, "link").value = link.link || "";
    field(els.linkForm, "intro").value = link.intro || "";
    field(els.linkForm, "avatar").value = link.avatar || "";
    els.linkEditorTitle.textContent = link.title || "新增友链";
    renderLinkPreview(link);
  }

  function renderLinkPreview(link) {
    const avatarStyle = link.avatar
      ? `style="background-image:url('${escapeAttribute(link.avatar)}'); background-size:cover; background-position:center;"`
      : "";

    els.linkPreview.innerHTML = `
      <div class="friend-card-preview__avatar" ${avatarStyle}></div>
      <div>
        <strong>${escapeHtml(link.title || "站点名称")}</strong>
        <p>${escapeHtml(link.intro || "一句话简介会显示在这里。")}</p>
        <span>${escapeHtml(link.link || "https://example.com/")}</span>
      </div>
    `;
  }

  function renderAssetHelper() {
    const url = String(els.assetUrl.value || "").trim();
    const alt = String(els.assetAlt.value || "").trim() || "图片描述";
    const title = String(els.assetTitle.value || "").trim();
    const markdown = title
      ? `![${alt}](${url || "https://example.com/image.jpg"} "${title}")`
      : `![${alt}](${url || "https://example.com/image.jpg"})`;
    const cover = `cover: ${url || "https://example.com/image.jpg"}`;

    els.assetMarkdown.textContent = markdown;
    els.assetCover.textContent = cover;
  }

  function renderMarkdownPreview(content) {
    if (!content.trim()) {
      els.markdownPreview.innerHTML = '<p class="muted">开始输入正文后，这里会显示实时预览。</p>';
      return;
    }

    if (window.marked && typeof window.marked.parse === "function") {
      els.markdownPreview.innerHTML = window.marked.parse(content);
      return;
    }

    els.markdownPreview.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
  }

  async function loadOverview() {
    state.overview = await api("/api/overview");
    renderOverview();
  }

  async function loadPosts(selectFirst = true) {
    state.posts = await api("/api/posts");
    renderPostsList();
    if (selectFirst && state.posts.length && !state.currentPostId) {
      await openPost(state.posts[0].id);
    }
  }

  async function loadLinks(selectFirst = true) {
    state.links = await api("/api/links");
    renderLinksList();
    if (selectFirst && state.links.length && state.currentLinkIndex === null) {
      openLink(0);
    }
  }

  async function openPost(postId) {
    state.currentPostId = postId;
    const post = await api(`/api/posts/${encodeURIComponent(postId)}`);
    fillPostForm(post);
    renderPostsList();
  }

  function openLink(index) {
    state.currentLinkIndex = index;
    fillLinkForm(state.links[index]);
    renderLinksList();
  }

  function collectPostForm() {
    return {
      title: field(els.postForm, "title").value.trim(),
      slug: field(els.postForm, "slug").value.trim(),
      date: fromInputDate(field(els.postForm, "date").value),
      tags: field(els.postForm, "tags").value,
      categories: field(els.postForm, "categories").value,
      excerpt: field(els.postForm, "excerpt").value.trim(),
      cover: field(els.postForm, "cover").value.trim(),
      draft: field(els.postForm, "draft").checked,
      content: field(els.postForm, "content").value,
    };
  }

  function collectLinkForm() {
    return {
      title: field(els.linkForm, "title").value.trim(),
      link: field(els.linkForm, "link").value.trim(),
      intro: field(els.linkForm, "intro").value.trim(),
      avatar: field(els.linkForm, "avatar").value.trim(),
    };
  }

  async function saveCurrentPost() {
    const payload = collectPostForm();
    if (!payload.title) {
      showToast("请先填写文章标题");
      return;
    }

    const method = state.currentPostId ? "PUT" : "POST";
    const url = state.currentPostId ? `/api/posts/${encodeURIComponent(state.currentPostId)}` : "/api/posts";
    const saved = await api(url, {
      method,
      body: JSON.stringify(payload),
    });

    state.currentPostId = saved.id;
    await Promise.all([loadOverview(), loadPosts(false)]);
    await openPost(saved.id);
    showToast("文章已保存到源码仓库。下一步记得在本地执行发布命令。");
  }

  async function removeCurrentPost() {
    if (!state.currentPostId) {
      showToast("当前没有可删除的文章");
      return;
    }

    if (!window.confirm("确定删除这篇文章吗？")) return;

    await api(`/api/posts/${encodeURIComponent(state.currentPostId)}`, { method: "DELETE" });
    state.currentPostId = null;
    fillPostForm(blankPost());
    await Promise.all([loadOverview(), loadPosts(false)]);
    if (state.posts[0]) {
      await openPost(state.posts[0].id);
    }
    showToast("文章已删除。别忘了再执行一次本地发布。");
  }

  async function saveAllLinks() {
    if (state.currentLinkIndex !== null) {
      state.links[state.currentLinkIndex] = collectLinkForm();
    }

    state.links = await api("/api/links", {
      method: "PUT",
      body: JSON.stringify({ items: state.links }),
    });

    await Promise.all([loadOverview(), loadLinks(false)]);
    if (state.links.length) {
      state.currentLinkIndex = Math.min(state.currentLinkIndex ?? 0, state.links.length - 1);
      openLink(state.currentLinkIndex);
    } else {
      state.currentLinkIndex = null;
      fillLinkForm(blankLink());
    }
    showToast("友链已写入源码仓库。发布前台时会一起生效。");
  }

  function removeCurrentLink() {
    if (state.currentLinkIndex === null) {
      showToast("当前没有可删除的友链");
      return;
    }

    if (!window.confirm("确定删除这个友链条目吗？")) return;

    state.links.splice(state.currentLinkIndex, 1);
    state.currentLinkIndex = state.links.length ? Math.min(state.currentLinkIndex, state.links.length - 1) : null;
    renderLinksList();
    if (state.currentLinkIndex !== null) {
      openLink(state.currentLinkIndex);
    } else {
      fillLinkForm(blankLink());
    }
    showToast("已从列表中移除，记得点击“保存友链墙”。");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const password = field(els.loginForm, "password").value;
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    showToast("登录成功");
    await bootstrapApp();
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    els.adminShell.hidden = true;
    els.loginScreen.hidden = false;
    showToast("已退出登录");
  }

  async function copyText(value, successText) {
    await navigator.clipboard.writeText(value);
    showToast(successText);
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", (event) => {
      handleLogin(event).catch((error) => showToast(error.message || "登录失败"));
    });

    els.logoutBtn.addEventListener("click", () => {
      logout().catch((error) => showToast(error.message || "退出失败"));
    });

    for (const button of els.navButtons) {
      button.addEventListener("click", () => switchSection(button.dataset.section));
    }

    for (const button of els.jumpButtons) {
      button.addEventListener("click", () => switchSection(button.dataset.jump));
    }

    els.newPost.addEventListener("click", () => {
      state.currentPostId = null;
      fillPostForm(blankPost());
      renderPostsList();
      showToast("已切换到新建文章");
    });

    els.savePost.addEventListener("click", () => {
      saveCurrentPost().catch((error) => showToast(error.message || "保存失败"));
    });

    els.deletePost.addEventListener("click", () => {
      removeCurrentPost().catch((error) => showToast(error.message || "删除失败"));
    });

    els.postSearch.addEventListener("input", renderPostsList);
    els.postFilter.addEventListener("change", renderPostsList);
    field(els.postForm, "content").addEventListener("input", (event) => renderMarkdownPreview(event.target.value));

    els.newLink.addEventListener("click", () => {
      state.currentLinkIndex = state.links.length;
      state.links.push(blankLink());
      renderLinksList();
      openLink(state.currentLinkIndex);
      showToast("已新增一个空白友链条目");
    });

    els.saveLinks.addEventListener("click", () => {
      saveAllLinks().catch((error) => showToast(error.message || "保存友链失败"));
    });

    els.deleteLink.addEventListener("click", removeCurrentLink);

    ["title", "link", "intro", "avatar"].forEach((name) => {
      field(els.linkForm, name).addEventListener("input", () => {
        const current = collectLinkForm();
        if (state.currentLinkIndex !== null) {
          state.links[state.currentLinkIndex] = current;
          renderLinksList();
        }
        renderLinkPreview(current);
      });
    });

    [els.assetUrl, els.assetAlt, els.assetTitle].forEach((input) => {
      input.addEventListener("input", renderAssetHelper);
    });

    for (const button of els.copyPublishButtons) {
      button.addEventListener("click", () => {
        copyText(publishCommand, "发布命令已复制").catch(() => showToast("复制失败，请手动复制"));
      });
    }

    for (const button of els.copyButtons) {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.copyTarget);
        if (!target) return;
        copyText(target.textContent, "内容已复制").catch(() => showToast("复制失败，请手动复制"));
      });
    }
  }

  async function bootstrapApp() {
    const session = await api("/api/session");
    if (!session.authenticated) {
      els.loginScreen.hidden = false;
      els.adminShell.hidden = true;
      return;
    }

    els.loginScreen.hidden = true;
    els.adminShell.hidden = false;

    await Promise.all([
      loadOverview(),
      loadPosts(),
      loadLinks(),
    ]);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return String(value).replace(/"/g, "&quot;");
  }

  function init() {
    const hasApiBase = apiBase && !apiBase.includes("your-admin-api");
    renderAssetHelper();
    fillPostForm(blankPost());
    fillLinkForm(blankLink());
    bindEvents();

    if (!hasApiBase) {
      showToast("请先在 /admin/config.js 中填好 Worker 地址");
      return;
    }

    bootstrapApp().catch((error) => {
      showToast(error.message || "初始化失败");
    });
  }

  init();
})();
