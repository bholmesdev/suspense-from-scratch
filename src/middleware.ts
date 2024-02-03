import { defineMiddleware } from "astro:middleware";

export type Suspended = { read: () => string };
type SuspendedChunk = Suspended & { promise: Promise<void> };

export const onRequest = defineMiddleware(async (ctx, next) => {
  const response = await next();
  // ignore non-HTML responses
  if (!response.headers.get("content-type")?.startsWith("text/html")) {
    return response;
  }

  ctx.locals.suspended = [];

  async function* render() {
    // @ts-expect-error ReadableStream does not have asyncIterator
    for await (const chunk of response.body) {
      yield chunk;
    }

    // Thank you owoce!
    // https://gist.github.com/lubieowoce/05a4cb2e8cd252787b54b7c8a41f09fc
    const stream = new ReadableStream<{ chunk: string; idx: number }>({
      start(controller) {
        let remaining = ctx.locals.suspended.length;
        ctx.locals.suspended.forEach(async (readable, idx) => {
          try {
            try {
              const chunk = readable.read();
              controller.enqueue({ chunk, idx });
            } catch (e) {
              if (!(e instanceof Promise)) {
                throw e;
              }
              await e;
              const chunk = readable.read();
              controller.enqueue({ chunk, idx });
            }
          } catch (e) {
            controller.error(e);
            return;
          }
          remaining--;
          if (remaining === 0) {
            controller.close();
          }
        });
      },
    });

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
