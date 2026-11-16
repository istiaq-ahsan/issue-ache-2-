import { useEffect, useId, useRef } from 'react'
import { AlertCircle, ChevronDown, LoaderCircle, Search } from 'lucide-react'
import { cn } from '../../lib/utils.js'

const buttonVariants = {
  primary: 'ui-button-primary',
  secondary: 'ui-button-secondary',
  ghost: 'ui-button-ghost',
  danger: 'ui-button-danger',
}

function Button({ children, className, isLoading = false, variant = 'primary', ...props }) {
  return (
    <button
      className={cn('ui-button', buttonVariants[variant] || buttonVariants.primary, className)}
      {...props}
      disabled={props.disabled || isLoading}
    >
      {isLoading && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
      {children}
    </button>
  )
}

function Input({ className, error, label, id, ...props }) {
  const inputId = id || props.name
  return (
    <label className="ui-field" htmlFor={inputId}>
      {label && <span className="ui-field-label">{label}</span>}
      <input
        aria-invalid={Boolean(error) || undefined}
        className={cn('ui-input', error && 'ui-input-error', className)}
        id={inputId}
        {...props}
      />
      {error && <span className="ui-field-error" role="alert">{error}</span>}
    </label>
  )
}

function Select({ children, className, error, label, id, ...props }) {
  const selectId = id || props.name
  return (
    <label className="ui-field" htmlFor={selectId}>
      {label && <span className="ui-field-label">{label}</span>}
      <span className="ui-select-wrap">
        <select
          aria-invalid={Boolean(error) || undefined}
          className={cn('ui-input ui-select', error && 'ui-input-error', className)}
          id={selectId}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="ui-select-icon" size={16} />
      </span>
      {error && <span className="ui-field-error" role="alert">{error}</span>}
    </label>
  )
}

function Card({ children, className, ...props }) {
  return <section className={cn('ui-card', className)} {...props}>{children}</section>
}

function Badge({ children, className, status, ...props }) {
  const normalized = (status || children || '').toString().toLowerCase().replaceAll('_', '-')
  const variant = ['active', 'approved', 'successful'].includes(normalized)
    ? 'success'
    : ['pending', 'expiring'].includes(normalized)
      ? 'warning'
      : ['rejected', 'failed', 'urgent'].includes(normalized)
        ? 'danger'
        : normalized === 'resolved'
          ? 'resolved'
          : normalized === 'in-progress'
            ? 'info'
        : ['closed', 'archived'].includes(normalized)
          ? 'purple'
          : normalized === 'info'
            ? 'info'
            : 'neutral'
  return <span className={cn('ui-badge', `ui-badge-${variant}`, className)} {...props}>{children}</span>
}

function DataTable({ columns, emptyMessage = 'No records to display.', getRowKey, rows }) {
  if (!rows.length) return <EmptyState description={emptyMessage} />
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey ? getRowKey(row) : row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="ui-state" role="status">
      <LoaderCircle aria-hidden="true" className="ui-state-icon animate-spin" size={23} />
      <p>{label}</p>
    </div>
  )
}

function EmptyState({ action, description, title = 'Nothing here yet' }) {
  return (
    <div className="ui-state ui-state-empty">
      <span className="ui-state-icon-wrap"><Search aria-hidden="true" size={21} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function ErrorState({ message = 'Something went wrong. Please try again.', onRetry, title = 'Unable to load this page' }) {
  return (
    <div className="ui-error-state" role="alert">
      <AlertCircle aria-hidden="true" size={21} />
      <div><h3>{title}</h3><p>{message}</p></div>
      {onRetry && <Button onClick={onRetry} variant="secondary">Try again</Button>}
    </div>
  )
}

function Dropdown({ children, label }) {
  return (
    <details className="ui-dropdown">
      <summary>{label}<ChevronDown aria-hidden="true" size={15} /></summary>
      <div className="ui-dropdown-menu">{children}</div>
    </details>
  )
}

function Dialog({ children, footer, onClose, open, title }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-labelledby={titleId}
      className="ui-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose?.()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose?.()
      }}
      ref={dialogRef}
    >
      <div className="ui-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close dialog" className="icon-button ui-dialog-close" onClick={onClose} type="button">×</button>
      </div>
      <div className="ui-dialog-body">{children}</div>
      {footer && <div className="ui-dialog-footer">{footer}</div>}
    </dialog>
  )
}

export {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Dropdown,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
}
