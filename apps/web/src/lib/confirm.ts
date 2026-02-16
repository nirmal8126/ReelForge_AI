import Swal from 'sweetalert2'

interface ConfirmOptions {
  title: string
  text?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export async function confirmAction({
  title,
  text,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
}: ConfirmOptions): Promise<boolean> {
  const colorMap = {
    danger: { confirm: '#DC2626', icon: 'warning' as const },
    warning: { confirm: '#F59E0B', icon: 'warning' as const },
    info: { confirm: '#6366F1', icon: 'question' as const },
  }

  const colors = colorMap[type]

  const result = await Swal.fire({
    title,
    text,
    icon: colors.icon,
    showCancelButton: true,
    confirmButtonColor: colors.confirm,
    cancelButtonColor: '#374151',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: '#111827',
    color: '#F9FAFB',
    customClass: {
      popup: 'rounded-xl border border-white/10',
      title: 'text-lg font-semibold',
      htmlContainer: 'text-sm text-gray-400',
      confirmButton: 'rounded-lg px-4 py-2.5 text-sm font-medium',
      cancelButton: 'rounded-lg px-4 py-2.5 text-sm font-medium',
    },
  })

  return result.isConfirmed
}
