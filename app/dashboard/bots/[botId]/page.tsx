import { redirect } from 'next/navigation'

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = await params
  redirect(`/dashboard/bots/${botId}/personality`)
}
