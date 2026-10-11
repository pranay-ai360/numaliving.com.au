"""In-page JavaScript used by page_probe.py (kept apart so the Python stays readable).

Every snippet is an arrow function evaluated with ``page.evaluate`` and returns
plain JSON; they only read the DOM. The one exception is JS_CONSOLE_HOOK, an init
script that records what the page itself logs (see its comment).
"""

# CloakBrowser's stealth patches suppress Runtime.enable, so Playwright's "console" and
# "pageerror" events never report what the page logs or throws (only browser-generated
# messages such as failed resource loads arrive). This init script records them instead.
JS_CONSOLE_HOOK = r"""
(() => {
  if (window.__qaEvents) return;
  const events = { errors: [], warnings: [] };
  Object.defineProperty(window, '__qaEvents', { value: events, enumerable: false });
  const describe = (value) => {
    if (value instanceof Error) return value.stack || value.message || String(value);
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value); } catch (error) { return String(value); }
    }
    return String(value);
  };
  const push = (bucket, text) => bucket.push(String(text).slice(0, 600));
  const wrap = (level, bucket) => {
    const original = console[level];
    console[level] = function (...args) {
      push(bucket, args.map(describe).join(' '));
      return original.apply(this, args);
    };
  };
  wrap('error', events.errors);
  wrap('warn', events.warnings);
  const originalAssert = console.assert;
  console.assert = function (condition, ...args) {
    if (!condition) push(events.errors, 'Assertion failed: ' + args.map(describe).join(' '));
    return originalAssert.apply(this, [condition, ...args]);
  };
  window.addEventListener('error', (event) => {
    push(events.errors, '[uncaught] ' + (event.message || 'error') + ' at ' + (event.filename || '?') + ':' + (event.lineno || 0));
  });
  window.addEventListener('unhandledrejection', (event) => {
    push(events.errors, '[unhandled rejection] ' + describe(event.reason));
  });
})();
"""

JS_READ_CONSOLE_HOOK = r"""
() => window.__qaEvents
  ? { errors: Array.from(window.__qaEvents.errors), warnings: Array.from(window.__qaEvents.warnings) }
  : { errors: [], warnings: [] }
"""

JS_DOCUMENT_FACTS = r"""
() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const count = (selector) => document.querySelectorAll(selector).length;
  const robots = Array.from(document.querySelectorAll('meta[name]'))
    .filter((meta) => meta.getAttribute('name').toLowerCase() === 'robots')
    .map((meta) => clean(meta.getAttribute('content')));
  return {
    title: clean(document.title),
    lang: clean(document.documentElement.getAttribute('lang')),
    h1Count: count('h1'),
    metaRobots: robots,
    landmarks: {
      header: count('header, [role="banner"]'),
      main: count('main, [role="main"]'),
      footer: count('footer, [role="contentinfo"]'),
      nav: count('nav, [role="navigation"]'),
    },
    visibleText: clean(document.body ? document.body.innerText : '').slice(0, 2000),
  };
}
"""

JS_IMAGES = r"""
() => Array.from(document.images).map((img) => ({
  src: img.currentSrc || img.src || img.getAttribute('src') || '',
  complete: img.complete,
  naturalWidth: img.naturalWidth,
  rendered: img.getClientRects().length > 0,
  alt: img.getAttribute('alt'),
  role: img.getAttribute('role'),
  ariaHidden: img.getAttribute('aria-hidden'),
}))
"""

JS_LINKS = r"""
() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const absolute = (raw) => {
    try { return new URL(raw, document.baseURI).href; } catch (error) { return null; }
  };
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const links = anchors
    .map((a) => ({ href: absolute(a.getAttribute('href')), text: clean(a.innerText || a.getAttribute('aria-label')).slice(0, 80) }))
    .filter((link) => link.href !== null);
  const targetMissing = (raw) => {
    let id = raw.slice(1);
    try { id = decodeURIComponent(id); } catch (error) { /* keep the raw id */ }
    return !document.getElementById(id) && document.getElementsByName(id).length === 0;
  };
  const deadAnchors = anchors
    .map((a) => a.getAttribute('href'))
    .filter((raw) => raw.length > 1 && raw.startsWith('#') && targetMissing(raw));
  const headResources = Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]'))
    .map((link) => ({ rel: link.getAttribute('rel'), href: absolute(link.getAttribute('href')) }))
    .filter((resource) => resource.href !== null);
  return { links, deadAnchors: Array.from(new Set(deadAnchors)), headResources };
}
"""

# http: URLs written into the markup of subresource-bearing elements (mixed content candidates).
JS_INSECURE_REFERENCES = r"""
() => {
  const targets = [
    ['img', 'src'], ['img', 'srcset'], ['source', 'src'], ['source', 'srcset'], ['script', 'src'],
    ['iframe', 'src'], ['video', 'src'], ['audio', 'src'], ['embed', 'src'], ['object', 'data'], ['form', 'action'],
  ];
  const insecure = (url) => /^http:\/\//i.test(url);
  const found = [];
  for (const [tag, attr] of targets) {
    for (const el of document.querySelectorAll(tag + '[' + attr + ']')) {
      for (const candidate of (el.getAttribute(attr) || '').split(',')) {
        const url = candidate.trim().split(/\s+/)[0];
        if (insecure(url)) found.push({ tag, attr, url });
      }
    }
  }
  const subresourceRels = ['stylesheet', 'icon', 'preload', 'modulepreload', 'apple-touch-icon', 'manifest'];
  for (const el of document.querySelectorAll('link[href]')) {
    const rels = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    const href = el.getAttribute('href') || '';
    if (rels.some((rel) => subresourceRels.includes(rel)) && insecure(href)) found.push({ tag: 'link', attr: 'href', url: href });
  }
  return found;
}
"""

# Links/buttons that expose no accessible name (approximation of the accname algorithm).
JS_UNNAMED_CONTROLS = r"""
() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => el.checkVisibility({ checkVisibilityCSS: true });
  const skipped = (el) => el.getAttribute('aria-hidden') === 'true' || !visible(el);
  const referencedText = (ids) => ids.split(/\s+/)
    .map((id) => document.getElementById(id)).filter(Boolean)
    .map((node) => clean(node.textContent)).join(' ').trim();
  const contentName = (el) => {
    let name = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) name += node.textContent;
      else if (node.nodeType === Node.ELEMENT_NODE && !skipped(node)) name += ' ' + elementName(node) + ' ';
    }
    return clean(name);
  };
  const inputName = (el) => {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'submit' || type === 'reset') return clean(el.value) || type;
    if (type === 'image') return clean(el.getAttribute('alt')) || clean(el.value) || clean(el.getAttribute('title'));
    return clean(el.value) || clean(el.getAttribute('title'));
  };
  const elementName = (el) => {
    const label = clean(el.getAttribute('aria-label'));
    if (label) return label;
    const labelledBy = el.getAttribute('aria-labelledby');
    const referenced = labelledBy ? referencedText(labelledBy) : '';
    if (referenced) return referenced;
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return clean(el.getAttribute('alt')) || clean(el.getAttribute('title'));
    if (tag === 'input') return inputName(el);
    if (tag === 'svg') {
      const title = el.querySelector(':scope > title');
      return clean(title && title.textContent) || contentName(el) || clean(el.getAttribute('title'));
    }
    return contentName(el) || clean(el.getAttribute('title'));
  };
  const selector = 'a[href], button, [role="button"], [role="link"], input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]';
  return Array.from(document.querySelectorAll(selector))
    .filter((el) => !el.closest('[aria-hidden="true"], [inert]') && visible(el))
    .filter((el) => elementName(el) === '')
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      href: el.getAttribute('href'),
      html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 160),
    }));
}
"""

# Page-level horizontal overflow plus the outermost elements that stick out (when it overflows).
JS_OVERFLOW = r"""
() => {
  const doc = document.documentElement;
  const innerWidth = window.innerWidth;
  const result = {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    innerWidth,
    bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
    offenders: [],
  };
  if (doc.scrollWidth <= innerWidth || !document.body) return result;
  const sticksOut = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && (rect.right > innerWidth + 0.5 || rect.left < -0.5);
  };
  const excluded = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') return true;
      if (node !== el && style.overflowX !== 'visible') return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (!sticksOut(el) || excluded(el)) continue;
    if (el.parentElement && el.parentElement !== document.body && sticksOut(el.parentElement)) continue;
    const rect = el.getBoundingClientRect();
    result.offenders.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className.slice(0, 80) : null,
      left: Math.round(rect.left),
      right: Math.round(rect.right),
    });
    if (result.offenders.length >= 8) break;
  }
  return result;
}
"""
