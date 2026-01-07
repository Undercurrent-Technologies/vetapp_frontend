interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return response;
    }

    const url = new URL(request.url);
    url.pathname = "/index.html";

    return env.ASSETS.fetch(
      new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
      }),
    );
  },
};
