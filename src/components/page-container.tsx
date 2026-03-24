'use client'

import { Heading } from './heading'

interface PageContainerProps {
  children: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
}

export function PageContainer({ children, title, description, action }: PageContainerProps) {
  return (
    <div className="flex flex-1 flex-col space-y-6">
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && <Heading title={title} description={description} />}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
