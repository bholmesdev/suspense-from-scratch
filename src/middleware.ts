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

    const suspendedChunks: SuspendedChunk[] = [];
    for (const [idx, suspended] of ctx.locals.suspended.entries()) {
      try {
        const chunk = suspended.read();
        yield withSuspendedTemplate({ chunk, idx });
      } catch (e) {
        if (e instanceof Promise) {
          const { read } = suspended;
          suspendedChunks.push({ read, promise: e });
        } else {
          throw e;
        }
      }
    }

    const stream = new ReadableStream<{ chunk: string; idx: number }>({
      start(controller) {
        let remaining = suspendedChunks.length;
        suspendedChunks.forEach(async (readable, idx) => {
          await readable.promise;
          const chunk = readable.read();

          controller.enqueue({ chunk, idx });
          remaining--;
          if (remaining === 0) {
            controller.close();
          }
        });
      },
    });

    // @ts-expect-error ReadableStream does not have asyncIterator
    for await (const { chunk, idx } of stream) {
      yield withSuspendedTemplate({ chunk, idx });
    }
  }

  // @ts-expect-error generator not assignable to ReadableStream
  return new Response(render(), response.headers);
});

function withSuspendedTemplate({ chunk, idx }: { chunk: string; idx: number }) {
  return `<template data-suspense-id=${JSON.stringify(idx)}>${chunk}</template>
<script>
(() => {
	const template = document.querySelector(\`template[data-suspense-id="${idx}"]\`).content;
	const dest = document.querySelector(\`div[data-suspense-fallback="${idx}"]\`);
	dest.replaceWith(template);
})();
</script>`;
}
