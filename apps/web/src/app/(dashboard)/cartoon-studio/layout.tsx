import { isModuleEnabled } from '@/lib/module-config'
import { ModuleDisabled } from '@/components/module-disabled'

export default async function CartoonStudioLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled('cartoon_studio')
  if (!enabled) return <ModuleDisabled moduleName="Cartoon Studio" />
  return <>{children}</>
}
