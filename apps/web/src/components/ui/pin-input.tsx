import { useRef, useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PinInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  /** Whether to show the visibility toggle. Defaults to true */
  showToggle?: boolean
}

export function PinInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  showToggle = true,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  // Focus next empty input when value changes
  useEffect(() => {
    if (value.length < length && inputRefs.current[value.length]) {
      inputRefs.current[value.length]?.focus()
    }
  }, [value, length])

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (disabled) return

      // Only accept digits
      if (digit && !/^\d$/.test(digit)) return

      const newValue = value.split('')
      newValue[index] = digit
      const result = newValue.join('').slice(0, length)

      onChange(result)

      // Call onComplete when all digits are entered
      if (result.length === length && onComplete) {
        onComplete(result)
      }
    },
    [disabled, value, length, onChange, onComplete]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        if (value[index]) {
          // Clear current digit
          handleChange(index, '')
        } else if (index > 0) {
          // Move to previous input and clear it
          inputRefs.current[index - 1]?.focus()
          handleChange(index - 1, '')
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault()
        inputRefs.current[index - 1]?.focus()
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        e.preventDefault()
        inputRefs.current[index + 1]?.focus()
      }
    },
    [disabled, value, length, handleChange]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      if (disabled) return

      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
      if (pastedData) {
        onChange(pastedData)
        if (pastedData.length === length && onComplete) {
          onComplete(pastedData)
        }
      }
    },
    [disabled, length, onChange, onComplete]
  )

  // Get the display value for a digit (masked or visible)
  const getDisplayValue = (index: number): string => {
    const digit = value[index]
    if (!digit) return ''
    return isVisible ? digit : '•'
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
        {Array.from({ length }).map((_, index) => (
          <div key={index} className="relative">
            {/* Hidden actual input for typing */}
            <input
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={value[index] || ''}
              onChange={(e) => {
                const digit = e.target.value.slice(-1)
                handleChange(index, digit)
              }}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              disabled={disabled}
              className={cn(
                'w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-semibold',
                'bg-zinc-900/50 border rounded-lg transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
                'caret-transparent selection:bg-transparent',
                disabled && 'opacity-50 cursor-not-allowed',
                error
                  ? 'border-red-500/50 focus:ring-red-500/50'
                  : focusedIndex === index
                    ? 'border-emerald-500 focus:ring-emerald-500/50'
                    : value[index]
                      ? 'border-zinc-700'
                      : 'border-zinc-800'
              )}
              style={{ color: 'transparent' }}
            />
            {/* Display overlay */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center pointer-events-none',
                'text-xl sm:text-2xl font-mono font-semibold',
                error ? 'text-red-400' : value[index] ? 'text-white' : 'text-zinc-400'
              )}
            >
              {getDisplayValue(index)}
            </div>
          </div>
        ))}
      </div>

      {/* Visibility toggle */}
      {showToggle && (
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            'text-xs text-zinc-500 hover:text-zinc-300',
            'transition-colors duration-200',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isVisible ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide PIN</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Show PIN</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
