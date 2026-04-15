"use client"

import { useCallback, useRef } from "react"

// basically Exclude<React.ClassAttributes<T>["ref"], string>
type UserRef<T> =
  | ((instance: T | null) => void)
  | React.RefObject<T | null>
  | null
  | undefined

const updateRef = <T>(ref: NonNullable<UserRef<T>>, value: T | null) => {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref && typeof ref === "object" && "current" in ref) {
    // Safe assignment without MutableRefObject
    ;(ref as { current: T | null }).current = value
  }
}

export const useComposedRef = <T extends HTMLElement>(
  libRefParam: React.RefObject<T | null>,
  userRef: UserRef<T>
) => {
  const prevUserRefValue = useRef<UserRef<T>>(null)

  return useCallback(
    (instance: T | null) => {
      // Update library ref using updateRef helper to satisfy lint rules
      if (libRefParam) {
        updateRef(libRefParam, instance)
      }

      if (prevUserRefValue.current) {
        updateRef(prevUserRefValue.current, null)
      }

      prevUserRefValue.current = userRef

      if (userRef) {
        updateRef(userRef, instance)
      }
    },
    [libRefParam, userRef]
  )
}

export default useComposedRef
