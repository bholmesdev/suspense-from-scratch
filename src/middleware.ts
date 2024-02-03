import { defineMiddleware } from "astro:middleware";

type SuspendedChunk = {
  chunk: string;
  idx: number;
};

export const onRequest = defineMiddleware(async (ctx, next) => {
  const response = await next();
  // ignore non-HTML responses
  if (!response.headers.get("content-type")?.startsWith("text/html")) {
    return response;
  }

  let streamController: ReadableStreamDefaultController<SuspendedChunk>;

  async function* render() {
    // Thank you owoce!
    // https://gist.github.com/lubieowoce/05a4cb2e8cd252787b54b7c8a41f09fc
    const stream = new ReadableStream<SuspendedChunk>({
      start(controller) {
        streamController = controller;
      },
    });

    let curId = 0;
    const pending = new Set<Promise<string>>();

    ctx.locals.suspend = (promise) => {
      const idx = curId++;
      pending.add(promise);
      promise
        .then((chunk) => {
          streamController.enqueue({ chunk, idx });
          pending.delete(promise);
          if (pending.size === 0) {
            streamController.close();
          }
        })
        .catch((e) => {
          streamController.error(e);
        });
      return idx;
    };

    // @ts-expect-error ReadableStream does not have asyncIterator
    for await (const chunk of response.body) {
      yield chunk;
    }

    if (!pending.size) return streamController.close();

    // @ts-expect-error ReadableStream does not have asyncIterator
    for await (const { chunk, idx } of stream) {
      yield `<template data-suspense-id=${JSON.stringify(
        idx
      )}>${chunk}</template>
<script>
(() => {
	const template = document.querySelector(\`template[data-suspense-id="${idx}"]\`).content;
	const dest = document.querySelector(\`div[data-suspense-fallback="${idx}"]\`);
	dest.replaceWith(template);
})();
</script>`;
    }
  }

  // @ts-expect-error generator not assignable to ReadableStream
  return new Response(render(), response.headers);
});
