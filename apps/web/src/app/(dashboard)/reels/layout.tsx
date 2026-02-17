import { isModuleEnabled } from '@/lib/module-config'
import { ModuleDisabled } from '@/components/module-disabled'

export default async function ReelsLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled('reels')
  if (!enabled) return <ModuleDisabled moduleName="My Reels" />
  return <>{children}</>
}
