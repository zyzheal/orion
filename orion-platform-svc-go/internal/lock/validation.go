package lock

import "fmt"

type LockValidator struct { MaxKeyLength int }

func DefaultLockValidator() *LockValidator { return &LockValidator{MaxKeyLength: 512} }

func (v *LockValidator) ValidateKey(key string) error {
    if key == "" { return ErrLockInvalidInput }
    if len(key) > v.MaxKeyLength { return fmt.Errorf("lock: key too long") }
    return nil
}
