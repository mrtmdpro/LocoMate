export const REMOTE_IMAGE_HOSTS = [
  "images.unsplash.com",
  "randomuser.me",
  "images.pexels.com",
  "upload.wikimedia.org",
  "lh3.googleusercontent.com",
] as const;

type Header = {
  key: string;
  value: string;
};

export function buildSecurityHeaders(): Header[] {
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    ...REMOTE_IMAGE_HOSTS.map((host) => `https://${host}`),
  ];
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src " + imageSources.join(" "),
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");

  return [
    { key: "Content-Security-Policy-Report-Only", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=(self)",
        "payment=(self)",
        "usb=()",
      ].join(", "),
    },
  ];
}
