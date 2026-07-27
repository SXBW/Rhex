import { incrementPostViewCount } from "@/lib/posts"

const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const postId = id.trim()

  if (!POST_ID_PATTERN.test(postId)) {
    return Response.json({ message: "帖子标识无效" }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    })
  }

  await incrementPostViewCount(postId)

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  })
}
