import { isModuleEnabled } from '@/lib/module-config'
import { ModuleDisabled } from '@/components/module-disabled'

export default async function QuotesLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled('quotes')
  if (!enabled) return <ModuleDisabled moduleName="Quotes" />
  return <>{children}</>
}
