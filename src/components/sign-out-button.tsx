'use client'

import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface SignOutButtonProps {
  variant?: 'default' | 'sidebar'
  className?: string
}

export function SignOutButton({ variant = 'default', className }: SignOutButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          variant === 'sidebar' ? (
            <button
              type="button"
              className={cn(
                'flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive',
                className,
              )}
            />
          ) : (
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                className,
              )}
            />
          )
        }
      >
        {variant === 'sidebar' && <LogOut className="h-3.5 w-3.5" />}
        Sign Out
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be redirected to the login page and will need to enter your credentials again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
