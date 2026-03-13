import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main>
          <div className="p-8">{children}</div>
        </main>
      </div>
      <FullPageBannerModal />
    </div>
  )
}
