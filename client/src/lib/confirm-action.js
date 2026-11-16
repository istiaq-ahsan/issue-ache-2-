async function confirmAction({
  confirmText = 'Confirm',
  description,
  isDangerous = false,
  title = 'Are you sure?',
}) {
  const { default: Swal } = await import('sweetalert2')
  const result = await Swal.fire({
    title,
    text: description,
    icon: isDangerous ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: isDangerous ? '#dc2626' : '#2563eb',
    customClass: { popup: 'ui-swal-popup' },
  })

  return result.isConfirmed
}

async function promptAction({
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  inputLabel,
  inputPlaceholder,
  isDangerous = false,
  requiredMessage = 'A value is required',
  title,
}) {
  const { default: Swal } = await import('sweetalert2')
  const result = await Swal.fire({
    title,
    input: 'text',
    inputLabel,
    inputPlaceholder,
    inputValidator: (value) => (value?.trim() ? undefined : requiredMessage),
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: isDangerous ? '#dc2626' : '#2563eb',
    customClass: { popup: 'ui-swal-popup' },
  })

  return result.isConfirmed ? result.value.trim() : null
}

export { confirmAction, promptAction }
