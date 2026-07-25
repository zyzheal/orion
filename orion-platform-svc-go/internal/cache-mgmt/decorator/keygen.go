package decorator

import (
	"encoding/json"
	"hash/fnv"
	"strconv"
)

// KeyGenerator produces a deterministic string cache key from the arguments
// passed to a decorated method. Implementations must be safe for concurrent
// use.
type KeyGenerator interface {
	// Key returns a cache key for the given arguments.
	Key(args ...interface{}) string
}

// KeyGenFunc is an adapter that lets any func(...interface{})string implement
// KeyGenerator.
type KeyGenFunc func(args ...interface{}) string

// Key delegates to the underlying function.
func (f KeyGenFunc) Key(args ...interface{}) string {
	return f(args...)
}

// DefaultKeyGenerator returns a generator that concatenates the stringified
// representation of each argument separated by a colon, then hashes the result
// with FNV-32a. This is cheap and produces stable short keys.
func DefaultKeyGenerator() KeyGenerator {
	return KeyGenFunc(func(args ...interface{}) string {
		return hashStringArgs(args)
	})
}

// StringJoinKeyGenerator returns a generator that joins stringified arguments
// with a colon separator. Useful when keys must remain human-readable.
func StringJoinKeyGenerator() KeyGenerator {
	return KeyGenFunc(func(args ...interface{}) string {
		parts := make([]string, len(args))
		for i, a := range args {
			switch v := a.(type) {
			case string:
				parts[i] = v
			case int:
				parts[i] = strconv.FormatInt(int64(v), 10)
			case int64:
				parts[i] = strconv.FormatInt(v, 10)
			case float64:
				parts[i] = strconv.FormatFloat(v, 'f', -1, 64)
			case bool:
				parts[i] = strconv.FormatBool(v)
			case nil:
				parts[i] = ""
			default:
				b, _ := json.Marshal(a)
				parts[i] = string(b)
			}
		}
		return ":" + joinStringParts(parts)
	})
}

// JSONKeyGenerator serializes each argument to JSON and joins with a colon.
// This is stable and handles arbitrary types but is slower than the default.
func JSONKeyGenerator() KeyGenerator {
	return KeyGenFunc(func(args ...interface{}) string {
		parts := make([][]byte, len(args))
		for i, a := range args {
			b, err := json.Marshal(a)
			if err != nil {
				b = []byte("nil")
			}
			parts[i] = b
		}
		return joinBytes(parts)
	})
}

// MethodKeyGenerator prepends a method name prefix to the generated key.
// Useful when sharing a single cache between multiple methods.
type MethodKeyGenerator struct {
	prefix     string
	generator  KeyGenerator
	separator  string
}

// NewMethodKeyGenerator returns a KeyGenerator that prefixes keys with the
// given method name.
func NewMethodKeyGenerator(method string, generator KeyGenerator) KeyGenerator {
	if generator == nil {
		generator = DefaultKeyGenerator()
	}
	return &MethodKeyGenerator{
		prefix:    method,
		generator: generator,
		separator: ":",
	}
}

func (g *MethodKeyGenerator) Key(args ...interface{}) string {
	return g.prefix + g.separator + g.generator.Key(args...)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func hashStringArgs(args []interface{}) string {
	h := fnv.New32a()
	for _, a := range args {
		switch v := a.(type) {
		case string:
			_, _ = h.Write([]byte(v))
		case []byte:
			_, _ = h.Write(v)
		case int:
			_, _ = h.Write(strconv.AppendInt(nil, int64(v), 10))
		case int64:
			_, _ = h.Write(strconv.AppendInt(nil, v, 10))
		case uint:
			_, _ = h.Write(strconv.AppendUint(nil, uint64(v), 10))
		case uint64:
			_, _ = h.Write(strconv.AppendUint(nil, v, 10))
		case float64:
			_, _ = h.Write(strconv.AppendFloat(nil, v, 'f', -1, 64))
		case bool:
			if v {
				_, _ = h.Write([]byte("1"))
			} else {
				_, _ = h.Write([]byte("0"))
			}
		case nil:
			// write nothing for nil
		default:
			b, _ := json.Marshal(a)
			_, _ = h.Write(b)
		}
		// Write a delimiter byte between arguments.
		_, _ = h.Write([]byte{0})
	}
	return strconv.FormatUint(uint64(h.Sum32()), 16)
}

func joinStringParts(parts []string) string {
	b := make([]byte, 0, 64)
	for i, p := range parts {
		if i > 0 {
			b = append(b, ':')
		}
		b = append(b, p...)
	}
	return string(b)
}

func joinBytes(parts [][]byte) string {
	b := make([]byte, 0, 128)
	for i, p := range parts {
		if i > 0 {
			b = append(b, ':')
		}
		b = append(b, p...)
	}
	return string(b)
}
