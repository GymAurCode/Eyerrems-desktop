export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  color = null,
  size = 'sm',
}) {
  const activeColor = color || '#6366F1'
  const isSm = size === 'sm'

  return (
    <div
      onClick={() => { if (!disabled) onChange(!checked) }}
      style={{
        width: isSm ? '32px' : '40px',
        height: isSm ? '18px' : '22px',
        borderRadius: '999px',
        background: disabled
          ? '#374151'
          : checked
            ? activeColor
            : '#4B5563',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        transform: `translateY(-50%) translateX(${checked ? (isSm ? '16px' : '20px') : '2px'})`,
        width: isSm ? '14px' : '18px',
        height: isSm ? '14px' : '18px',
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'transform 0.2s ease',
      }} />
    </div>
  )
}
