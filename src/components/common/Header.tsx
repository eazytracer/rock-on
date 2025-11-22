import React from 'react'

interface HeaderProps {
  title?: string
  showLogo?: boolean
  className?: string
  onLogoClick?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  className = '',
  onLogoClick,
}) => {
  return (
    <header className={`header ${className}`}>
      <div className="h-full px-4 flex items-center justify-between">
        {showLogo && (
          <div
            className="flex items-center cursor-pointer"
            onClick={onLogoClick}
          >
            <img
              src="/rockon-logo.png"
              alt="Rock-On"
              className="logo mr-3"
              onError={e => {
                // Fallback to text if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent && !parent.querySelector('.logo-text')) {
                  const textElement = document.createElement('span')
                  textElement.className =
                    'logo-text text-energy-orange font-bold text-xl md:text-2xl'
                  textElement.textContent = 'Rock-On'
                  parent.appendChild(textElement)
                }
              }}
            />
            {title && (
              <h1 className="text-smoke-white font-semibold text-lg md:text-xl">
                {title}
              </h1>
            )}
          </div>
        )}

        {!showLogo && title && (
          <h1 className="text-smoke-white font-semibold text-lg md:text-xl">
            {title}
          </h1>
        )}

        <div className="flex items-center space-x-2">
          {/* Space for future header actions like settings, search, etc. */}
        </div>
      </div>
    </header>
  )
}

export default Header
