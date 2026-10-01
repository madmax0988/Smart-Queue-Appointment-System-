function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Vercel gives every deployment of a project its own unique URL
// (e.g. my-app-8z5cccxxy.vercel.app) in addition to the stable
// production alias (my-app.vercel.app). Both are the same app and
// must be allowed, so for any configured *.vercel.app origin we also
// allow other deployment URLs of that same project by matching on
// the project's name prefix.
function buildAllowedOriginMatchers(originsEnv, fallback) {
  const configured = (originsEnv || fallback)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const matchers = configured.map((origin) => {
    try {
      const { protocol, hostname } = new URL(origin);
      if (hostname.endsWith('.vercel.app')) {
        const projectSlug = hostname.slice(0, -'.vercel.app'.length);
        const pattern = new RegExp(
          `^${escapeRegex(protocol)}//${escapeRegex(projectSlug)}(-[a-z0-9]+)*\\.vercel\\.app$`
        );
        return (candidate) => pattern.test(candidate);
      }
    } catch {
      // not a valid absolute URL; fall through to exact match below
    }
    return (candidate) => candidate === origin;
  });

  return matchers;
}

function createCorsOriginChecker(originsEnv, fallback = 'http://localhost:5173') {
  const matchers = buildAllowedOriginMatchers(originsEnv, fallback);

  return (requestOrigin, callback) => {
    // No Origin header: same-origin requests, curl, server-to-server, etc.
    if (!requestOrigin) return callback(null, true);
    const allowed = matchers.some((matches) => matches(requestOrigin));
    callback(null, allowed);
  };
}

module.exports = { createCorsOriginChecker };
