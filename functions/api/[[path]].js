export async function onRequest(context) {
  const url = new URL(context.request.url);

  const backendUrl =
    "https://ortho-website-roan.vercel.app";

  const targetUrl = new URL(
    url.pathname + url.search,
    backendUrl
  );

  const request = new Request(targetUrl, context.request);

  return fetch(request);
}
