import { isModuleEnabled } from '@/lib/module-config'
import { ModuleDisabled } from '@/components/module-disabled'

export default async function LongFormLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled('long_form')
  if (!enabled) return <ModuleDisabled moduleName="My Videos" />
  return <>{children}</>
}
