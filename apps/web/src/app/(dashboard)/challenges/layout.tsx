import { isModuleEnabled } from '@/lib/module-config'
import { ModuleDisabled } from '@/components/module-disabled'

export default async function ChallengesLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled('challenges')
  if (!enabled) return <ModuleDisabled moduleName="Challenges" />
  return <>{children}</>
}
