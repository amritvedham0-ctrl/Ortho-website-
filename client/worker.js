
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy API requests to Vercel backend
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = "https://ortho-website-roan.vercel.app";

      const targetUrl = new URL(
        url.pathname + url.search,
        backendUrl
      );

      try {
        const response = await fetch(
          new Request(targetUrl, request)
        );

        return response;
      } catch (error) {
        console.error("Vercel API proxy error:", error);

        return new Response(
          JSON.stringify({
            message: "Backend proxy failed",
            error: error.message
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

    // Serve React frontend for all other requests
    return env.ASSETS.fetch(request);
  },
};
