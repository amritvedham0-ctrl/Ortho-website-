
export async function onRequest(context) {
  const url = new URL(context.request.url);

  const backendUrl = "https://ortho-website-roan.vercel.app";

  const targetUrl = new URL(
    url.pathname + url.search,
    backendUrl
  );

  try {
    const response = await fetch(
      new Request(targetUrl, context.request)
    );

    return response;
  } catch (error) {
    console.error("Proxy error:", error);

    return new Response(
      JSON.stringify({
        error: "Backend unavailable",
        details: error.message
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}
