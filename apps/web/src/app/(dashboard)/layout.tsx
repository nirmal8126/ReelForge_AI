import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { FullPageBannerModal } from '@/components/banners/full-page-banner-modal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
      <FullPageBannerModal />
    </div>
  )
}
