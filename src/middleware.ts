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
  const suspendedChunks: SuspendedChunk[] = [];

  async function* render() {
    // @ts-expect-error ReadableStream does not have asyncIterator
    for await (const chunk of response.body) {
      while (ctx.locals.suspended.length > 0) {
        const suspended = ctx.locals.suspended.shift()!;
        try {
          yield suspended.read();
        } catch (e) {
          if (e instanceof Promise) {
            const { read } = suspended;
            suspendedChunks.push({ read, promise: e });
          } else {
            throw e;
          }
        }
      }
      yield chunk;
    }
    for (const [idx, { read, promise }] of suspendedChunks.entries()) {
      await promise;
      yield `<template data-suspense-id=${JSON.stringify(
        idx
      )}>${read()}</template>
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
